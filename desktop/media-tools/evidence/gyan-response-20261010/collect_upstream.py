"""Read-only upstream research; writes only this evidence folder. Never builds.

Raw response receipts include failures. Git tag objects and peeled commits are
kept distinct. Package recipes are candidates, never binary-input proof.
"""
import concurrent.futures, datetime, hashlib, json, pathlib, subprocess, urllib.request

OUT = pathlib.Path(__file__).resolve().parent
RECEIPTS = OUT / 'upstream-receipts.json'

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def fetch(name, url):
    path = OUT / name
    started = now()
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'AudioTechLabs-source-evidence/1.0'})
        with urllib.request.urlopen(request, timeout=40) as response:
            data = response.read()
            receipt = dict(file=name, url=url, finalUrl=response.url, httpStatus=response.status,
                           contentType=response.headers.get('Content-Type'), fetchedUtc=started,
                           bytes=len(data), sha256=hashlib.sha256(data).hexdigest(), status='FETCHED')
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return receipt
    except Exception as error:
        return dict(file=None, requestedFile=name, url=url, fetchedUtc=started, status='FAILED', error=str(error))

def refs(name, repo, pattern):
    result = subprocess.run(['git', '-c', 'credential.helper=', 'ls-remote', repo, pattern, pattern+'^{}'],
                            capture_output=True, text=True, timeout=50)
    body = dict(repository=repo, command=['git','ls-remote',repo,pattern,pattern+'^{}'],
                fetchedUtc=now(), exitCode=result.returncode, stdout=result.stdout, stderr=result.stderr)
    path = OUT / ('upstream/'+name+'-refs.json')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(body, indent=2)+'\n', encoding='utf8')
    return dict(file=path.relative_to(OUT).as_posix(), url=repo, fetchedUtc=body['fetchedUtc'],
                status='FETCHED' if result.returncode==0 and result.stdout else 'UNRESOLVED',
                bytes=path.stat().st_size, sha256=hashlib.sha256(path.read_bytes()).hexdigest())

def batch(jobs):
    old = json.loads(RECEIPTS.read_text(encoding='utf8')) if RECEIPTS.exists() else []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(function, *args) for function, args in jobs]
        for future in concurrent.futures.as_completed(futures):
            try:
                result = future.result()
            except Exception as error:
                result = dict(status='FAILED', error=str(error))
            old.append(result)
            print(json.dumps({key:result.get(key) for key in ('file','requestedFile','status','error')}, ensure_ascii=False), flush=True)
    RECEIPTS.write_text(json.dumps(old, indent=2, ensure_ascii=False)+'\n', encoding='utf8')

if __name__ == '__main__':
    jobs = [
        (refs, ('bzip2','https://sourceware.org/git/bzip2.git','refs/tags/bzip2-1.0.8')),
        (refs, ('fontconfig','https://gitlab.freedesktop.org/fontconfig/fontconfig.git','refs/tags/2.18.3')),
        (refs, ('gnutls','https://github.com/gnutls/gnutls.git','refs/tags/3.8.13')),
        (refs, ('libiconv','https://git.savannah.gnu.org/git/libiconv.git','refs/tags/v1.19')),
        (refs, ('xz','https://github.com/tukaani-project/xz.git','refs/tags/v5.8.4')),
        (refs, ('libxml2-tag','https://github.com/GNOME/libxml2.git','refs/tags/v2.15.0')),
        (refs, ('zlib-ng-base','https://github.com/zlib-ng/zlib-ng.git','refs/tags/v1.2.8_jtkv4')),
        (fetch, ('upstream/libxml2-commit.json','https://api.github.com/repos/GNOME/libxml2/commits/31094e5d')),
        (fetch, ('upstream/zlib-ng-commit.json','https://api.github.com/repos/zlib-ng/zlib-ng/commits/9174ab6')),
        (fetch, ('upstream/gmp-tags.html','https://gmplib.org/repo/gmp/tags')),
        (fetch, ('upstream/gmp-release.html','https://gmplib.org/list-archives/gmp-announce/2023-July/000050.html')),
    ]
    for package in ('bzip2','fontconfig','gmp','gnutls','libiconv','xz','libxml2','zlib-ng'):
        jobs.extend([
            (fetch, ('upstream/msys2-'+package+'.html','https://packages.msys2.org/packages/mingw-w64-ucrt-x86_64-'+package)),
            (fetch, ('upstream/msys2-'+package+'-history.json','https://api.github.com/repos/msys2/MINGW-packages/commits?path=mingw-w64-'+package+'/PKGBUILD&per_page=20')),
        ])
    batch(jobs)
