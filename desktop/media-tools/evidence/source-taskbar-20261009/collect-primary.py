"""Collect publisher evidence and exact-version source files. No installation/build."""
import concurrent.futures, datetime, hashlib, json, pathlib, urllib.request

out = pathlib.Path(__file__).resolve().parent
jobs = [
 ('yt-dlp-build.yml', 'https://raw.githubusercontent.com/yt-dlp/yt-dlp/2026.08.19/.github/workflows/build.yml'),
 ('yt-dlp-release.json', 'https://api.github.com/repos/yt-dlp/yt-dlp/releases/tags/2026.08.19'),
 ('yt-dlp-tag.json', 'https://api.github.com/repos/yt-dlp/yt-dlp/commits/2026.08.19'),
 ('gyan-builds.html', 'https://www.gyan.dev/ffmpeg/builds/'),
 ('gyan-repository-tree.json', 'https://api.github.com/repos/GyanD/codexffmpeg/git/trees/master?recursive=1'),
 ('gyan-readme.md', 'https://raw.githubusercontent.com/GyanD/codexffmpeg/master/README.md'),
 ('ffmpeg-legal.html', 'https://ffmpeg.org/legal.html'),
 ('gpl-3.0.html', 'https://www.gnu.org/licenses/gpl-3.0.html'),
]
def fetch(job):
    name, url = job
    target = out/'publisher'/name
    if target.exists(): raise RuntimeError(f'Refusing overwrite: {target}')
    try:
        req = urllib.request.Request(url, headers={'User-Agent':'AudioTechLabs-private-source-review/1.0'})
        with urllib.request.urlopen(req, timeout=45) as response:
            data = response.read()
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            return dict(file=target.relative_to(out).as_posix(), url=url, finalUrl=response.url,
                        bytes=len(data), sha256=hashlib.sha256(data).hexdigest(),
                        fetchedUtc=datetime.datetime.now(datetime.timezone.utc).isoformat(), status='PASS')
    except Exception as error:
        return dict(file='publisher/'+name,url=url,status='BLOCKED',error=str(error))
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    receipts = list(pool.map(fetch,jobs))
(out/'publisher-receipts.json').write_text(json.dumps(receipts,indent=2),encoding='utf8')
print(json.dumps(receipts,indent=2))
