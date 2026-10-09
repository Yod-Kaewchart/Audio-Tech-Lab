"""Extract source/config/license text for review, without executing it."""
import json,pathlib,re,tarfile
out=pathlib.Path(__file__).resolve().parent
source=out.parents[1]/'release/source-review-0.2.2-beta.2-r2-INCOMPLETE'
selected=[]
for arc in (source/'archives').glob('*'):
    with tarfile.open(arc) as t:
        for m in t.getmembers():
            p=pathlib.PurePosixPath(*pathlib.PurePosixPath(m.name).parts[1:]);name=p.name
            keep=(str(p) in ('PCbuild/get_externals.bat','PCbuild/python.props','libs.json','package.json','package-lock.json','scripts/download.py','hatch_build.py') or
                  (len(p.parts)<=2 and re.match(r'(?i)^(license|copying|copyright|authors)(\.|$)',name)))
            if m.isfile() and keep and m.size<1000000:
                payload=t.extractfile(m).read()
                target=out/'source-text'/arc.name/str(p)
                assert target.resolve().is_relative_to((out/'source-text').resolve())
                target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(payload)
                selected.append(str(target.relative_to(out)))
for f in (out/'source-text/curl_cffi-0.16.0.tar.gz').rglob('download.py'):
    print('\n'.join(line for line in f.read_text(encoding='utf8').splitlines() if any(s in line for s in ('version','github','impersonate','tag'))))
ejs=json.loads((out/'source-text/yt_dlp_ejs-0.8.0.tar.gz/package.json').read_text(encoding='utf8'))
lock=json.loads((out/'source-text/yt_dlp_ejs-0.8.0.tar.gz/package-lock.json').read_text(encoding='utf8'))
print(json.dumps(dict(ejsDependencies=ejs.get('dependencies'),ejsDevDependencies=ejs.get('devDependencies'),actualBundledJs={name:lock['packages'].get('node_modules/'+name) for name in ('meriyah','astring')}),indent=2))
print('\n'.join(line for f in (out/'pyinstaller-custom-recipe').rglob('*.yml') for line in f.read_text(encoding='utf8').splitlines() if any(s in line for s in ('patch','waf','git clone','PYINSTALLER','70fc','CFLAGS','windows','zlib'))))
(out/'source-text-files.json').write_text(json.dumps(selected,indent=2),encoding='utf8')
