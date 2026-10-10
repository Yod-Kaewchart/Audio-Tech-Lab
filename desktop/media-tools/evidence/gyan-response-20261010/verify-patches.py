"""Check candidate recipe patches on disposable source trees, without building.

Only pristine source tarballs in archives/ are read. No original source archive,
vendor binary or release artifact is changed. A successful git apply check is
not evidence that Gyan used the patch.
"""
import hashlib, json, pathlib, shutil, subprocess, tarfile, tempfile
from inspect_inputs import NAMES

OUT = pathlib.Path(__file__).resolve().parent
PATCH_EXE = pathlib.Path(shutil.which('git')).parents[1]/'usr'/'bin'/'patch.exe'
PATCHES = {
    'bzip2': [('bzip2-cygming-1.0.6.src.all.patch',1),('bzip2-buildsystem.all.patch',1),('bzip2-1.0.6-progress.all.patch',1)],
    'fontconfig': [('0011-conf-copy-instead-of-symlink.patch',1),('0012-conf-copy-drive-relative.patch',1)],
    'gmp': [('do-not-use-dllimport.diff',2),('gmp-staticlib.diff',1)],
    'gnutls': [('0001-fix-build-with-mingw-w64-clang.patch',1),('0003-gnutls-fix-external-libtasn1-detection.patch',1),('0004-disable-broken-examples.patch',1),('0005-remove-coverage-rules.patch',1)],
    'libiconv': [('0002-fix-cr-for-awk-in-configure.all.patch',1),('fix-pointer-buf.patch',1),('0003-add-cp65001-as-utf8-alias.patch',1)],
}

if __name__ == '__main__':
    results = []
    for name, patches in PATCHES.items():
        archive = OUT/'archives'/NAMES[name]
        scratch_root = OUT/'archives'/'patch-check'
        scratch_root.mkdir(parents=True,exist_ok=True)
        tree = pathlib.Path(tempfile.mkdtemp(prefix=name+'-',dir=scratch_root))
        assert tree.resolve().is_relative_to((OUT/'archives').resolve())
        with tarfile.open(archive) as source:
            for member in source.getmembers():
                if not member.isfile():
                    continue
                relative = pathlib.PurePosixPath(*pathlib.PurePosixPath(member.name).parts[1:])
                if relative.is_absolute() or '..' in relative.parts:
                    raise ValueError(member.name)
                target = tree/relative
                target.parent.mkdir(parents=True,exist_ok=True)
                target.write_bytes(source.extractfile(member).read())
        for filename, strip in patches:
            patch = OUT/'recipes'/name/filename
            args = ['git','apply','--no-index','--whitespace=nowarn','-p'+str(strip)]
            check = subprocess.run(args+['--check',str(patch)],cwd=tree,capture_output=True,text=True)
            applied = None
            if check.returncode==0:
                applied = subprocess.run(args+[str(patch)],cwd=tree,capture_output=True,text=True)
            gnu_check = None
            gnu_apply = None
            if check.returncode!=0 and PATCH_EXE.exists():
                gnu_args = [str(PATCH_EXE),'--batch','-p'+str(strip),'-i',str(patch)]
                gnu_check = subprocess.run(gnu_args+['--dry-run'],cwd=tree,capture_output=True,text=True)
                if gnu_check.returncode==0:
                    gnu_apply = subprocess.run(gnu_args,cwd=tree,capture_output=True,text=True)
            row = dict(component=name,patch=patch.relative_to(OUT).as_posix(),strip=strip,
                       sha256=hashlib.sha256(patch.read_bytes()).hexdigest(),
                       checkExitCode=check.returncode,checkOutput=check.stdout+check.stderr,
                       scratchApplyExitCode=applied.returncode if applied else None,
                       scratchApplyOutput=applied.stdout+applied.stderr if applied else None,
                       gnuDryRunExitCode=gnu_check.returncode if gnu_check else None,
                       gnuDryRunOutput=gnu_check.stdout+gnu_check.stderr if gnu_check else None,
                       gnuScratchApplyExitCode=gnu_apply.returncode if gnu_apply else None,
                       status=('PASS' if check.returncode==0 and applied.returncode==0 else
                               'PASS WITH GNU PATCH' if gnu_apply and gnu_apply.returncode==0 else 'CHECK FAILED'),
                       sourceArchive='archives/'+NAMES[name])
            results.append(row)
            print(name,filename,row['status'],row['checkOutput'].strip())
    (OUT/'patch-checks.json').write_text(json.dumps(dict(
        method='git apply --no-index --check; on failure use the recipe-style GNU patch --dry-run if installed; successful patches applied sequentially to disposable source trees only',
        publisherPatchUsageVerified=False, buildPerformed=False, results=results),indent=2)+'\n',encoding='utf8')
