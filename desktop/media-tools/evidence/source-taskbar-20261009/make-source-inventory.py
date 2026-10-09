"""Generate auditable inventory. Presence of an archive never implies completeness."""
import hashlib,json,pathlib,re,shutil,tarfile
out=pathlib.Path(__file__).resolve().parent
root=out.parents[1];source=root/'release/source-review-0.2.2-beta.2-r2-INCOMPLETE'
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
receipts=[]
for name in ('exact-input-receipts.json','recipe-input-receipts.json','build-provenance-receipts.json','js-native-receipts.json'):
    data=read(out/name);receipts+=data['files'] if isinstance(data,dict) else data
old=root/'release/source-review-0.2.2-beta.1'
oldreview=read(root/'release/review-0.2.2-beta.2-11549c34e61f/evidence/public-beta/source-review.json')
for row in oldreview['files']:
    p=old/row['file'];assert sha(p)==row['sha256'];assert p.stat().st_size==row['bytes']
    target=source/'baseline'/row['file'];target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target)
    receipts.append(dict(file='baseline/'+row['file'],sha256=row['sha256'],bytes=row['bytes'],status='PASS',origin='verified prior source-review archive',url={
        'FFmpeg-946fcce07b.tar.gz':'https://github.com/FFmpeg/FFmpeg/archive/946fcce07b6dcd0331c8cc609192aeff5e1924f8.tar.gz',
        'yt-dlp-2026.08.19.tar.gz':'https://github.com/yt-dlp/yt-dlp/releases/download/2026.08.19/yt-dlp.tar.gz',
        'FFmpeg-README.txt':'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip',
        'FFmpeg-GPLv3.txt':'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip',
        'yt-dlp-THIRD_PARTY_LICENSES.txt':'https://github.com/yt-dlp/yt-dlp/releases/download/2026.08.19/THIRD_PARTY_LICENSES.txt',
        'yt-dlp-SHA2-256SUMS.txt':'https://github.com/yt-dlp/yt-dlp/releases/download/2026.08.19/SHA2-256SUMS',
    }.get(row['file'],'repository dependencies.lock.json')))
# Bind README/license to the exact original binary ZIP, never the mutable current download.
import zipfile
zipfile_path=root/'cache/ffmpeg-9.0.2-essentials.zip'
assert sha(zipfile_path)=='60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba'
with zipfile.ZipFile(zipfile_path) as z:
    assert hashlib.sha256(z.read('ffmpeg-9.0.2-essentials_build/README.txt')).hexdigest()==sha(old/'FFmpeg-README.txt')
    for filename in ('ffmpeg.exe','ffprobe.exe'):
        assert hashlib.sha256(z.read('ffmpeg-9.0.2-essentials_build/bin/'+filename)).hexdigest()==sha(root/'vendor'/filename)
rows=[]
def row(component,version,license,evidence,archives=None,gaps=None,closure=None,presence='confirmed'):
    archives=archives or []
    files=[]
    for name in archives:
        r=next(r for r in receipts if r.get('file')==name and r['status']=='PASS');assert sha(source/name)==r['sha256']
        files.append({k:r[k] for k in ('file','url','bytes','sha256')})
    rows.append(dict(component=component,version=version,presence=presence,license=license,notices=evidence,
                     sourceArchives=files,buildEvidence=evidence,correspondingSourceStatus='BLOCKED',
                     missing=gaps or ['Exact publisher build configuration, patch declaration and linkage to this binary not complete'],
                     closure=closure or 'Obtain exact source/patch set/build recipe from binary publisher; verify against this binary hash before closing'))
row('FFmpeg / FFprobe core (avcodec,avformat,avutil,avfilter,avdevice,swresample,swscale)',
    '9.0.2; 946fcce07b6dcd0331c8cc609192aeff5e1924f8','GPLv3 combined build; component licenses in pinned source',
    'baseline/FFmpeg-README.txt; baseline/FFmpeg-GPLv3.txt; ffmpeg-version.log; ffprobe-version.log',
    ['baseline/FFmpeg-946fcce07b.tar.gz'],['Gyan patch/no-patch declaration for core and every dependency','Exact configure/link commands, config.log/config.h/link map, per-library build flags','Original source inputs for direct and transitive static libraries','Pinned MSYS2/UCRT package sources/PKGBUILDs/patches and toolchain manifest'])
text=(old/'FFmpeg-README.txt').read_text(encoding='utf8')
version_lines=text.split("release-essentials external libraries' versions:")[1].strip().splitlines()
for line in version_lines:
    if not line.strip():continue
    name,version=line.split(' ',1)
    archive=[];license='GPLv3 combined binary; individual license/notices NOT VERIFIED for exact source'
    if name=='rubberband':archive=['archives/rubberband-v4.0.0.tar.gz'];license='GPLv2-or-later (COPYING / source headers); combined build GPLv3'
    if name=='vidstab':archive=['archives/vidstab-e2445c4.tar.gz'];license='LGPL-2.1-or-later (exact source LICENSE); combined build GPLv3'
    row('FFmpeg external: '+name,version,license,'Exact Gyan ZIP README versions/config; FFmpeg -version; upstream license in collected source where present',archive,
        (['Publisher patches/no-patch declaration and exact dependency build flags/link map'] if archive else ['Exact source archive/checksum for '+version,'Individual license/notices, patches and exact build flags/link map']))
for name in ('fontconfig','iconv','gnutls','libxml2','gmp','bzlib/bzip2','lzma/xz','zlib'):
    row('FFmpeg external: '+name,'UNKNOWN: enabled but no version in exact README','GPLv3 combined binary; individual license NOT VERIFIED',
        'Exact README External libraries section; ffmpeg/ffprobe configure output',gaps=['Publisher must identify actual version/commit/package hash','Then collect exact sources, notices, patches, flags; cannot use current MSYS2 package as substitute'])
row('FFmpeg hardware / SDK / transitive inputs', 'AMF/ffnvcodec/VAAPI/VPL versions above; remaining UNKNOWN','Exact header/library license and system-library scope NOT VERIFIED',
    'README / -version: cuda_llvm, cuvid, dxva2, d3d11va, d3d12va, libmfx/libvpl, nvdec/nvenc, mediafoundation',gaps=[
        'CUDA/LLVM, Windows SDK/Media Foundation header/runtime provenance; libmfx vs libvpl alias discrepancy needs publisher clarification',
        'Transitive graph is not disclosed: cairo/pixman/png, fontconfig/expat, gnutls/nettle/hogweed/p11-kit/tasn1, vorbis/ogg, rubberband FFT/resampler choices, pthread/compiler runtime as applicable',
        'Names above are candidate dependencies to resolve, NOT a claim that each is linked; require linker map / package manifest'])
tag=read(out/'publisher/yt-dlp-tag.json')['sha']
row('yt-dlp application', '2026.08.19; original 594bd50c2c78ac432f81600d309fdc4e0a92d82c; generated release '+tag,
    'Unlicense main; PyInstaller combined executable GPLv3+ per release README',
    'Pinned release source + full git source (bundle and workflows); SHA2-256SUMS; actual offline diagnostic',
    ['baseline/yt-dlp-2026.08.19.tar.gz','archives/yt-dlp-release-git-'+tag[:12]+'.tar.gz'],
    ['Full bundled native dependency closure below remains incomplete; source gate applies to combined EXE, not just yt-dlp main'])
row('PyInstaller bootloader / runtime hooks', '6.22.0; upstream 70fc17210920bce17f4ab09bbf8104b0dbd45338; custom recipe 5eb86b862d61adc3df0f44e6e0b815b7d74fa3f5',
    'GPL-2.0-or-later with bootloader exception; upstream COPYING',
    'win-x64-pyinstaller.txt wheel SHA pin; publisher release body; custom workflow / waf in exact archives',
    ['archives/PyInstaller-70fc17210920.tar.gz','archives/Pyinstaller-Builds-5eb86b862d61.tar.gz'],
    ['MSYS2 update:true/compiler packages are floating; exact runner/compiler/pkg snapshot not retained in collected evidence','Need confirm actual bootloader section against wheel and publisher patch/no-patch statement; no rebuild performed'])
row('CPython runtime / standard library', '3.10.11 (python310.dll and offline diagnostic)', 'PSF-2.0 + incorporated license notices in LICENSE',
    'yt-dlp-carchive.json PYZ names/151 CArchive entries; native file versions; PCbuild scripts in exact archive',
    ['archives/Python-3.10.11.tar.xz'],['Windows installer/runtime build provenance and external native input closure below; PCbuild scripts alone do not prove actual compiler/patch choices'])
notice=(out/'bundle-metadata/THIRD_PARTY_LICENSES.txt').read_text(encoding='utf8')
notice_map=dict(re.findall(r'^([^\r\n]+) \| ([^\r\n]+)$',notice,re.M))
pkgrows=[('mutagen','1.48.1','mutagen'),('pycryptodomex','3.23.0','PyCryptodome'),('brotli','1.2.0','brotli'),('certifi','2026.7.22','certifi'),
         ('curl_cffi','0.16.0','curl_cffi'),('requests','2.34.2','requests'),('urllib3','2.7.0','urllib3'),('websockets','16.1.1','websockets'),
         ('cffi','2.1.1','cffi'),('charset-normalizer','3.5.0','charset-normalizer'),('idna','3.18','idna'),('pycparser','3.0','pycparser'),('typing-extensions','4.16.0','typing-extensions')]
modules=read(out/'yt-dlp-carchive.json')['modules']
for name,version,notice_name in pkgrows:
    r=next(r for r in receipts if r.get('component')==name and r.get('file','').startswith('archives/'))
    top={'pycryptodomex':'Cryptodome','charset-normalizer':'charset_normalizer','typing-extensions':'typing_extensions'}.get(name,name)
    present=any(m==top or m.startswith(top+'.') for m in modules)
    row('yt-dlp Python package: '+name,version,
        notice_map.get(notice_name,'See exact source LICENSE; missing from aggregate notices'),
        'Actual offline version where printed / embedded METADATA / PYZ module names + pinned Windows Python3.10 requirements; bundled notice',
        [r['file']],['Source archive and recipe version captured; compiled extension/wheel build inputs and patch attestation need verification' if name in ('pycryptodomex','brotli','cffi','charset-normalizer','curl_cffi','websockets') else 'Pure Python source collected; unmodified-source linkage/combined build audit still pending'],presence='module confirmed' if present else 'recipe only; not counted as bundled')
for name,version,license,archive in [('yt-dlp-ejs','0.8.0','Unlicense','yt_dlp_ejs-0.8.0.tar.gz'),('Meriyah','6.1.4','ISC','meriyah-6.1.4.tgz'),('Astring','1.9.0','MIT','astring-1.9.0.tgz')]:
    row('yt-dlp JS: '+name,version,license,'Actual EJS diagnostic and core.min.js/lib.min.js CArchive hashes; exact source package-lock.json; JS notices',
        ['archives/'+archive],['EJS minified output/source linkage needs publisher wheel byte comparison; collect preferred TS/JS sources if npm tarball only has compiled dist','Pinned build devDependency source closure / reproducible rollup invocation not fully audited'])
for name,version in [('bzip2','1.0.8 recipe'),('libffi','3.3.0 CPython recipe; separate cffi wheel copy may differ'),('OpenSSL 1.x','1.1.1t DLL/diagnostic'),('SQLite','3.40.1.0 DLL/diagnostic'),('liblzma','5.2.5 recipe'),('zlib','1.2.13 recipe; curl/bootloader copies separate'),('Expat','UNKNOWN exact embedded copy'),('mpdecimal','UNKNOWN exact embedded copy')]:
    row('yt-dlp CPython native: '+name,version,notice_map.get(name,'See exact Python LICENSE'),
        'Actual _bz2/_ctypes/_ssl/_hashlib/_sqlite3/_lzma/_decimal/pyexpat binaries; PCbuild/get_externals.bat; Python LICENSE',
        gaps=['Exact external archive/checksum/patches and Windows external-build scripts; recipe version is not independent binary proof','Embedded/static copy provenance must be distinguished from other copies in this EXE'])
row('yt-dlp curl-impersonate / libcurl', '2.0.0 per curl_cffi scripts/build.py; DLL FileVersion/string 8.21.0-IMPERSONATE', 'MIT wrapper / curl license; individual native notices in THIRD_PARTY_LICENSES',
    'curl-native-binding.json proves actual DLL SHA matches publisher cp310-abi3-win_amd64 wheel; source scripts/build.py',
    ['archives/curl-impersonate-v2.0.0.tar.gz','archives/curl_cffi-0.16.0.tar.gz'],
    ['Original Windows curl-impersonate release build flags, patches, exact transitive source graph and source archive checksums remain unverified','Version 2.0.0 is recipe selection; actual release-DLL vs impersonate release asset hash not yet compared'])
for name in ('BoringSSL','nghttp2','ngtcp2','nghttp3','zstd','brotli','zlib'):
    row('yt-dlp curl native: '+name,'UNKNOWN exact statically linked version/commit',notice_map.get(name,'zlib license in notices'),
        'Matched libcurl DLL strings / curl-impersonate recipe; notice is a union across platforms, not definitive presence/version proof',
        gaps=['Resolve actual Windows linker graph and exact dependency revisions/config/patches from publisher','Collect corresponding archives/hashes for actual graph, not current upstream releases'],presence='native graph not fully resolved')
row('Windows redistributable runtime DLLs', 'VCRUNTIME140 14.29.30139.0; UCRT/api-ms DLLs 10.0.26100.1742','Microsoft redistributable terms; provenance/notice coverage NOT VERIFIED',
    'Actual CArchive DLL hashes and native file versions',gaps=['Confirm redistributable source/licensing scope and original approved redistribution notices; closed-source system DLLs are not replaced with unrelated OSS tarballs'])
row('Platform-union notices not proven bundled', 'GNU Readline/ncurses/libstdc++/libgcc/libuuid/libintl/libidn2/libunistring/Tornado/httpx/SecretStorage/cryptography/Jeepney',
    'As listed in THIRD_PARTY_LICENSES (union)', 'No corresponding standalone DLL/PYZ modules found for these named packages; native static graph still needs publisher confirmation',
    gaps=['Do not claim all notice entries are Windows payload components','Resolve possible statically linked entries via link map; omit confirmed other-platform-only components from final Windows source set'],presence='notice-only / unresolved static copies')
for file in source.rglob('*'):
    if file.is_file() and file.suffix in ('.gz','.xz','.tgz','.whl'):
        assert any(r.get('file')==file.relative_to(source).as_posix() and r['status']=='PASS' for r in receipts)
inventory=dict(schema=1,version='0.2.2-beta.2',binarySourceCommit='df183f4970366597d539323760108dbaf234e049',reviewBaselineCommit='d701c1af3de9deccf5f563f276a9a0df7f2934ed',status='BLOCKED',label='INCOMPLETE',completeCorrespondingSource=False,
              vendorHashes={n:sha(root/'vendor'/n) for n in ('ffmpeg.exe','ffprobe.exe','yt-dlp.exe')},components=rows,
              sourceFiles=[r for r in receipts if r.get('file','').startswith(('archives/','build-inputs/','baseline/'))],
              unresolvedGraph='Direct/version rows are not exhaustive transitive SBOM; completeness cannot be claimed without publisher link graph and build-input closure')
(out/'source-inventory.json').write_text(json.dumps(inventory,indent=2,ensure_ascii=False),encoding='utf8')
(source/'SOURCE-INVENTORY-INCOMPLETE.json').write_text(json.dumps(inventory,indent=2,ensure_ascii=False),encoding='utf8')
lines=['# Corresponding source inventory — INCOMPLETE','',
       'Candidate 0.2.2-beta.2 / unsigned. Overall source gate **BLOCKED**. Exact archives collected is a narrower result than complete corresponding source. All per-component gates remain BLOCKED pending build/link audit. Unknowns are deliberately not replaced with nearby/current versions.','',
       'Binary identities, raw source/config/license evidence, URLs and SHA256 are in source-inventory.json and the receipts in this folder. Gyan README was compared byte-for-byte with the original ZIP (SHA 60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba) and both executable hashes. The mutable current publisher download is not the baseline.','',
       '| Component | Version / identity | License / notices scope | Sources | Missing / closure |',
       '| --- | --- | --- | --- | --- |']
for r in rows:
    files='<br>'.join(f"`{a['file']}` SHA `{a['sha256']}`" for a in r['sourceArchives']) or 'NOT COLLECTED / not identified'
    lines.append('| '+' | '.join(x.replace('|','/').replace('\n',' ') for x in [r['component'],r['version']+'; '+r['presence'],r['license']+'; '+r['notices'],files,'BLOCKED: '+'; '.join(r['missing'])+'. '+r['closure']])+' |')
lines+=['','## Source files / publisher provenance','', '| File | Publisher / URL | Bytes | SHA256 |','| --- | --- | ---: | --- |']
for r in inventory['sourceFiles']:lines.append(f"| `{r['file']}` | {r['url']} | {r['bytes']} | `{r['sha256']}` |")
(out/'SOURCE-INVENTORY.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
print(json.dumps(dict(componentRows=len(rows),sourceFiles=len(inventory['sourceFiles']),sourceGate='BLOCKED',label='INCOMPLETE')))
