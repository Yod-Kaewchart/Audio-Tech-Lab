"""Additional sources proven by the pinned Windows x64/Python 3.10 recipe."""
import concurrent.futures, datetime, hashlib, json, pathlib, urllib.request
out=pathlib.Path(__file__).resolve().parent
source=out.parents[1]/'release/source-review-0.2.2-beta.2-r2-INCOMPLETE'
def fetch(url,target,expected=None):
    assert not target.exists(),f'Refusing overwrite {target}'
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'AudioTechLabs-private-source-review/1.0'}),timeout=45) as r:
        data=r.read();sha=hashlib.sha256(data).hexdigest()
        if expected:assert sha==expected,'Publisher checksum mismatch'
        target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
        return dict(file=target.relative_to(source).as_posix() if target.is_relative_to(source) else target.relative_to(out).as_posix(),url=url,finalUrl=r.url,bytes=len(data),sha256=sha,publisherSha256=expected,status='PASS',fetchedUtc=datetime.datetime.now(datetime.timezone.utc).isoformat())
packages=[('cffi','2.1.1'),('charset-normalizer','3.5.0'),('idna','3.18'),('pycparser','3.0'),('typing-extensions','4.16.0'),('pyinstaller','6.22.0'),('pyinstaller-hooks-contrib','2026.6')]
def package(job):
    name,version=job;url=f'https://pypi.org/pypi/{name}/{version}/json'
    try:
        meta=fetch(url,out/'publisher'/f'pypi-{name}-{version}.json')
        data=json.loads((out/meta['file']).read_text(encoding='utf8'))
        sdist=next(r for r in data['urls'] if r['packagetype']=='sdist')
        arc=fetch(sdist['url'],source/'archives'/sdist['filename'],sdist['digests']['sha256'])
        arc.update(component=name,version=version,publisherMetadata=meta['file'],projectUrls=data['info']['project_urls'])
        return [meta,arc]
    except Exception as error:return [dict(component=name,version=version,url=url,status='BLOCKED',error=str(error))]
jobs=[('pyinstaller-custom-release.json','https://api.github.com/repos/yt-dlp/Pyinstaller-Builds/releases/tags/2026.08.19.215425'),
      ('pyinstaller-custom-tag.json','https://api.github.com/repos/yt-dlp/Pyinstaller-Builds/commits/2026.08.19.215425'),
      ('gyan-repository.json','https://api.github.com/repos/GyanD/codexffmpeg')]
def document(job):
    name,url=job
    try:return fetch(url,out/'publisher'/name)
    except Exception as error:return dict(file='publisher/'+name,url=url,status='BLOCKED',error=str(error))
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    receipts=list(pool.map(document,jobs))
    for pair in pool.map(package,packages):receipts+=pair
wheelurl='https://github.com/yt-dlp/Pyinstaller-Builds/releases/download/2026.08.19.215425/pyinstaller-6.22.0-py3-none-win_amd64.whl'
try:receipts.append(fetch(wheelurl,source/'build-inputs/pyinstaller-6.22.0-py3-none-win_amd64.whl','294099ecb5fdd2a13ae4c29006d4e335b697a63b6a16cf052b90ec2b40bef05a'))
except Exception as error:receipts.append(dict(url=wheelurl,status='BLOCKED',error=str(error)))
(out/'recipe-input-receipts.json').write_text(json.dumps(receipts,indent=2),encoding='utf8')
print(json.dumps([dict(file=r.get('file'),component=r.get('component'),status=r['status'],error=r.get('error')) for r in receipts],indent=2))
