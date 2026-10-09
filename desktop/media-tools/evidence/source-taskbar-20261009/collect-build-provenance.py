"""Collect exact custom PyInstaller build recipe; verify embedded DLL against publisher wheel."""
import hashlib,json,pathlib,tarfile,urllib.request,zipfile,datetime
out=pathlib.Path(__file__).resolve().parent
source=out.parents[1]/'release/source-review-0.2.2-beta.2-r2-INCOMPLETE'
receipts=[]
def fetch(url,target):
    assert not target.exists()
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'AudioTechLabs-private-source-review/1.0'}),timeout=45) as r:
        data=r.read();target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
        receipt=dict(file=target.relative_to(source).as_posix() if target.is_relative_to(source) else target.relative_to(out).as_posix(),url=url,finalUrl=r.url,bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),status='PASS',fetchedUtc=datetime.datetime.now(datetime.timezone.utc).isoformat())
        receipts.append(receipt);return target
commit=json.loads((out/'publisher/pyinstaller-custom-tag.json').read_text(encoding='utf8'))['sha']
arc=fetch(f'https://github.com/yt-dlp/Pyinstaller-Builds/archive/{commit}.tar.gz',source/'archives'/f'Pyinstaller-Builds-{commit[:12]}.tar.gz')
fetch('https://github.com/pyinstaller/pyinstaller/archive/70fc17210920bce17f4ab09bbf8104b0dbd45338.tar.gz',source/'archives/PyInstaller-70fc17210920.tar.gz')
with tarfile.open(arc) as t:
    for m in t.getmembers():
        p=pathlib.PurePosixPath(*pathlib.PurePosixPath(m.name).parts[1:])
        if m.isfile() and (str(p).startswith(('.github/','patches/')) or str(p) in ('README.md','LICENSE')):
            dest=out/'pyinstaller-custom-recipe'/str(p)
            assert dest.resolve().is_relative_to((out/'pyinstaller-custom-recipe').resolve())
            dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(t.extractfile(m).read())
fetch('https://api.github.com/repos/GyanD/codexffmpeg/git/trees/main?recursive=1',out/'publisher/gyan-repository-tree-main.json')
# Exact Windows cp310 ABI3 wheel from the publisher's PyPI metadata, not installed.
meta=json.loads((out/'publisher/pypi-curl_cffi-0.16.0.json').read_text(encoding='utf8'))
wheel=next(r for r in meta['urls'] if r['filename'].endswith('cp310-abi3-win_amd64.whl'))
file=fetch(wheel['url'],source/'build-inputs'/wheel['filename']);assert hashlib.sha256(file.read_bytes()).hexdigest()==wheel['digests']['sha256']
bundle=json.loads((out/'yt-dlp-carchive.json').read_text(encoding='utf8'))
with zipfile.ZipFile(file) as z:
    entry=next(e for e in bundle['entries'] if 'libcurl-impersonate-' in e['name'])
    payload=z.read(entry['name'].replace('\\','/'));assert hashlib.sha256(payload).hexdigest()==entry['sha256']
    strings=[s.decode('ascii') for s in __import__('re').findall(rb'[\x20-\x7e]{8,}',payload) if __import__('re').search(rb'(libcurl/|BoringSSL|nghttp[23]/|ngtcp2/|zstd/|zlib/|brotli/|OpenSSL/|curl-impersonate)',s)]
    (out/'curl-native-binding.json').write_text(json.dumps(dict(wheel=wheel['filename'],wheelSha256=wheel['digests']['sha256'],embeddedFile=entry['name'],embeddedSha256=entry['sha256'],matched=True,strings=strings),indent=2),encoding='utf8')
(out/'build-provenance-receipts.json').write_text(json.dumps(receipts,indent=2),encoding='utf8')
print(json.dumps(dict(customRecipeCommit=commit,curlWheel=wheel['filename'],curlDllMatches=True,files=receipts),indent=2))
