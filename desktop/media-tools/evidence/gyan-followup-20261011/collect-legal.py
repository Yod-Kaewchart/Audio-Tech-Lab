"""Fetch the requested official license references; read-only HTTP."""
import concurrent.futures, datetime, hashlib, json, pathlib, urllib.request

OUT=pathlib.Path(__file__).resolve().parent
JOBS=[('legal/gpl-3.0.html','https://www.gnu.org/licenses/gpl-3.0.html'),
      ('legal/gpl-faq.en.html','https://www.gnu.org/licenses/gpl-faq.en.html'),
      ('legal/gpl-3.0.txt','https://www.gnu.org/licenses/gpl-3.0.txt')]
def fetch(job):
    name,url=job
    try:
        req=urllib.request.Request(url,headers={'User-Agent':'AudioTechLabs-source-review/1.0'})
        with urllib.request.urlopen(req,timeout=30) as response:
            data=response.read();status=response.status;final=response.url
        path=OUT/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
        return dict(file=name,url=url,finalUrl=final,httpStatus=status,bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),fetchedUtc=datetime.datetime.now(datetime.timezone.utc).isoformat(),status='FETCHED')
    except Exception as error:
        return dict(requestedFile=name,url=url,status='FAILED',error=str(error))
if __name__=='__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        results=list(pool.map(fetch,JOBS))
    (OUT/'legal-receipts.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf8')
    print(json.dumps(results,indent=2))
