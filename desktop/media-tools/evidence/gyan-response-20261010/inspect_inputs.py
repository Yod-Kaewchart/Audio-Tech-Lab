"""Select text evidence safely from source tarballs; never extract or run code.

Archive contents are read with extractfile and mapped below source-text after
path validation. Receipts bind every saved text file to its source archive.
"""
import hashlib, json, pathlib, re, tarfile

OUT = pathlib.Path(__file__).resolve().parent
NAMES = {
    'bzip2': 'bzip2-1.0.8.tar.gz',
    'fontconfig': 'fontconfig-2.18.3.tar.gz',
    'gmp': 'gmp-6.3.0.tar.xz',
    'gnutls': 'gnutls-3.8.13.tar.xz',
    'libiconv': 'libiconv-1.19.tar.gz',
    'xz': 'xz-5.8.4.tar.xz',
    'libxml2': 'libxml2-31094e5d.tar.gz',
    'zlib-ng': 'zlib-ng-9174ab6.tar.gz',
}
ROOT_NAMES = {'README','README.md','README.txt','NEWS','COPYING','LICENSE','LICENSE.md','Copyright',
              'COPYING.LIB','COPYING.LESSERv2','COPYING.LESSERv3','COPYINGv2','COPYINGv3',
              'COPYING.LESSERv2.1','COPYING.LESSER','configure','configure.ac','meson.build',
              'meson_options.txt','meson.options','VERSION','CMakeLists.txt','Makefile','Makefile-libbz2_so','zlib.h.in',
              'zlib.pc.cmakein','zlib.pc.in'}
EXTRAS = {'lib/COPYING','lib/COPYING.LESSER','libcharset/COPYING.LIB','lib/gnutls.pc.in',
          'src/liblzma/liblzma.pc.in','libxml-2.0.pc.in','meson_options.txt'}

if __name__ == '__main__':
    evidence = []
    for name, filename in NAMES.items():
        archive = OUT / 'archives' / filename
        if not archive.exists():
            print('MISSING',name)
            continue
        archive_sha = hashlib.sha256(archive.read_bytes()).hexdigest()
        with tarfile.open(archive) as source:
            members = source.getmembers()
            for member in members:
                if not member.isfile():
                    continue
                relative = pathlib.PurePosixPath(*pathlib.PurePosixPath(member.name).parts[1:])
                if relative.is_absolute() or '..' in relative.parts:
                    raise ValueError(member.name)
                if not ((len(relative.parts)==1 and (relative.name in ROOT_NAMES or relative.name.startswith('COPYING.'))) or relative.as_posix() in EXTRAS):
                    continue
                data = source.extractfile(member).read()
                target = OUT / 'source-text' / name / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
                evidence.append(dict(file=target.relative_to(OUT).as_posix(), member=member.name,
                                     sourceArchive='archives/'+filename, archiveSha256=archive_sha,
                                     bytes=len(data), sha256=hashlib.sha256(data).hexdigest()))
        print(name, archive_sha)
    (OUT/'source-text-receipts.json').write_text(json.dumps(evidence,indent=2)+'\n',encoding='utf8')
    for recipe in sorted((OUT/'recipes').glob('*/PKGBUILD')):
        text = recipe.read_text(encoding='utf8')
        package = recipe.parent.name
        print('\nRECIPE', package)
        for line in text.splitlines():
            if re.search(r'^(pkgver|pkgrel|depends|makedepends|optdepends|source|sha256sums)|patch |--(enable|disable|with|without)|-D[A-Z_]',line):
                print(line)
