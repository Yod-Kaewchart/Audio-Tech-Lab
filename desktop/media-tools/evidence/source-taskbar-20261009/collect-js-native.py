"""Collect source pinned by EJS and curl_cffi recipes; do not install/build."""
import base64,hashlib,json,pathlib,tarfile,urllib.request,datetime
out=pathlib.Path(__file__).resolve().parent
source=out.parents[1]/'release/source-review-0.2.2-beta.2-r2-INCOMPLETE'
receipts=[]
def fetch(url,name,integrity=None):
    target=source/'archives'/name;assert not target.exists()
    try:
        with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'AudioTechLabs-private-source-review/1.0'}),timeout=45) as r:
            data=r.read()
            if integrity:
                algo,digest=integrity.split('-',1);assert base64.b64encode(hashlib.new(algo,data).digest()).decode()==digest
            target.write_bytes(data)
            receipts.append(dict(file='archives/'+name,url=url,finalUrl=r.url,bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),publisherIntegrity=integrity,status='PASS',fetchedUtc=datetime.datetime.now(datetime.timezone.utc).isoformat()))
    except Exception as e:receipts.append(dict(file='archives/'+name,url=url,status='BLOCKED',error=str(e)))
lock=json.loads((out/'source-text/yt_dlp_ejs-0.8.0.tar.gz/package-lock.json').read_text(encoding='utf8'))
for name in ('meriyah','astring'):
    row=lock['packages']['node_modules/'+name]
    fetch(row['resolved'],name+'-'+row['version']+'.tgz',row['integrity'])
fetch('https://github.com/lexiforest/curl-impersonate/archive/refs/tags/v2.0.0.tar.gz','curl-impersonate-v2.0.0.tar.gz')
file=source/'archives/curl-impersonate-v2.0.0.tar.gz'
if file.exists():
    with tarfile.open(file) as t:
        for m in t.getmembers():
            p=pathlib.PurePosixPath(*pathlib.PurePosixPath(m.name).parts[1:])
            if m.isfile() and m.size<1000000 and (str(p).startswith(('.github/','patches/')) or p.name in ('Makefile','Makefile.in','configure.ac','LICENSE')):
                target=out/'curl-impersonate-recipe'/str(p)
                assert target.resolve().is_relative_to((out/'curl-impersonate-recipe').resolve())
                target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(t.extractfile(m).read())
(out/'js-native-receipts.json').write_text(json.dumps(receipts,indent=2),encoding='utf8')
print(json.dumps(receipts,indent=2))
