"""Archive exact-version publisher sources, without running/installing any of them."""
import concurrent.futures, datetime, hashlib, json, pathlib, tarfile, urllib.request
out=pathlib.Path(__file__).resolve().parent
source=out.parents[1]/'release/source-review-0.2.2-beta.2-r2-INCOMPLETE'
assert not source.exists() or not any(source.iterdir()), 'Refusing nonempty existing source directory'
source.mkdir(parents=True,exist_ok=True)
receipts=[]
def download(url,target,expected=None):
    assert not target.exists(), f'Refusing overwrite {target}'
    req=urllib.request.Request(url,headers={'User-Agent':'AudioTechLabs-private-source-review/1.0'})
    with urllib.request.urlopen(req,timeout=45) as response:
        data=response.read()
        actual=hashlib.sha256(data).hexdigest()
        if expected: assert actual==expected, f'Publisher checksum mismatch {url}'
        target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
        return dict(file=target.relative_to(source).as_posix() if target.is_relative_to(source) else target.relative_to(out).as_posix(),
                    url=url,finalUrl=response.url,bytes=len(data),sha256=actual,
                    publisherSha256=expected,fetchedUtc=datetime.datetime.now(datetime.timezone.utc).isoformat(),status='PASS')
tag=json.loads((out/'publisher/yt-dlp-tag.json').read_text(encoding='utf8'))['sha']
jobs=[('yt-dlp-release-git-'+tag[:12]+'.tar.gz',f'https://github.com/yt-dlp/yt-dlp/archive/{tag}.tar.gz'),
      ('Python-3.10.11.tar.xz','https://www.python.org/ftp/python/3.10.11/Python-3.10.11.tar.xz'),
      ('rubberband-v4.0.0.tar.gz','https://github.com/breakfastquay/rubberband/archive/refs/tags/v4.0.0.tar.gz'),
      ('vidstab-e2445c4.tar.gz','https://github.com/georgmartius/vid.stab/archive/e2445c4.tar.gz')]
packages=[('mutagen','1.48.1'),('pycryptodomex','3.23.0'),('brotli','1.2.0'),('certifi','2026.7.22'),
          ('curl_cffi','0.16.0'),('requests','2.34.2'),('urllib3','2.7.0'),('websockets','16.1.1'),('yt-dlp-ejs','0.8.0')]
def get_archive(job):
    name,url=job
    try: return download(url,source/'archives'/name)
    except Exception as error: return dict(file='archives/'+name,url=url,status='BLOCKED',error=str(error))
def get_package(job):
    name,version=job;url=f'https://pypi.org/pypi/{name}/{version}/json'
    try:
        metadata_receipt=download(url,out/'publisher'/f'pypi-{name}-{version}.json')
        metadata=json.loads((out/metadata_receipt['file']).read_text(encoding='utf8'))
        sdist=next(r for r in metadata['urls'] if r['packagetype']=='sdist')
        receipt=download(sdist['url'],source/'archives'/sdist['filename'],sdist['digests']['sha256'])
        receipt.update(component=name,version=version,publisherMetadata=metadata_receipt['file'],projectUrls=metadata['info']['project_urls'])
        return [metadata_receipt,receipt]
    except Exception as error: return [dict(component=name,version=version,url=url,status='BLOCKED',error=str(error))]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    receipts+=list(pool.map(get_archive,jobs))
    for pair in pool.map(get_package,packages):receipts+=pair
# Read source text only. The release git archive has scripts omitted from the release sdist.
gitarchive=next((r for r in receipts if r.get('file','').startswith('archives/yt-dlp-release-git-') and r['status']=='PASS'),None)
if gitarchive:
    with tarfile.open(source/gitarchive['file']) as t:
        for member in t.getmembers():
            relative=pathlib.PurePosixPath(*pathlib.PurePosixPath(member.name).parts[1:])
            if member.isfile() and (str(relative).startswith(('bundle/','.github/workflows/')) or str(relative) in ('LICENSE','THIRD_PARTY_LICENSES.txt','pyproject.toml')):
                target=out/'yt-dlp-recipe'/str(relative)
                assert target.resolve().is_relative_to((out/'yt-dlp-recipe').resolve())
                target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(t.extractfile(member).read())
(out/'exact-input-receipts.json').write_text(json.dumps(dict(releaseGitCommit=tag,sourceDirectory=str(source),files=receipts),indent=2),encoding='utf8')
print(json.dumps(receipts,indent=2))
