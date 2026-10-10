"""Fetch source archives and candidate package recipes. Does not execute recipes."""
import json
from collect_upstream import OUT, batch, fetch

PINS = {
    'bzip2': '4660b7d07063b222cfe8f7c20d465e6948f1ba41',
    'fontconfig': 'ba8b44a275d6d4a4f5d9790cc6ae6edeabce4aeb',
    'gmp': 'c9e5b84b9bd7ac93517ffc177522606b9762c1e5',
    'gnutls': '7d02a6f9d520f8df4b346a1144765c499d115c48',
    'libiconv': '045d46aedb9fdbd93b0900b1e20c1a6c73f23072',
    'xz': 'bcf3f933e6c743a5d58b563d0e7da81b32ae35ae',
    'libxml2': '0ad48dc76ac86be21b42921866b20943c2183ae3',
    'zlib-ng': '89d5266ec82321d24e6926cd0df8d1bbd1f8939a',
}

if __name__ == '__main__':
    jobs = []
    for package, pin in PINS.items():
        jobs.append((fetch, ('upstream/msys2-'+package+'-directory.json',
                            'https://api.github.com/repos/msys2/MINGW-packages/contents/mingw-w64-'+package+'?ref='+pin)))
    jobs.extend([
        (fetch, ('upstream/gmp-hgtags.txt','https://gmplib.org/repo/gmp/raw-file/tip/.hgtags')),
        (fetch, ('upstream/gmp-branch-hgtags.txt','https://gmplib.org/repo/gmp-6.3/raw-file/tip/.hgtags')),
        (fetch, ('upstream/libxml2-compare.json','https://api.github.com/repos/GNOME/libxml2/compare/v2.15.0...31094e5d0f65a528965e8c32a488e5a7f36118ca')),
        (fetch, ('upstream/zlib-ng-compare.json','https://api.github.com/repos/zlib-ng/zlib-ng/compare/v1.2.8_jtkv4...9174ab6bf58ac9a518dbe197b948c897f74834f5')),
        (fetch, ('archives/bzip2-1.0.8.tar.gz','https://sourceware.org/pub/bzip2/bzip2-1.0.8.tar.gz')),
        (fetch, ('archives/fontconfig-2.18.3.tar.xz','https://www.freedesktop.org/software/fontconfig/release/fontconfig-2.18.3.tar.xz')),
        (fetch, ('archives/gmp-6.3.0.tar.xz','https://ftp.gnu.org/gnu/gmp/gmp-6.3.0.tar.xz')),
        (fetch, ('archives/gnutls-3.8.13.tar.xz','https://www.gnupg.org/ftp/gcrypt/gnutls/v3.8/gnutls-3.8.13.tar.xz')),
        (fetch, ('archives/libiconv-1.19.tar.gz','https://ftp.gnu.org/gnu/libiconv/libiconv-1.19.tar.gz')),
        (fetch, ('archives/xz-5.8.4.tar.xz','https://github.com/tukaani-project/xz/releases/download/v5.8.4/xz-5.8.4.tar.xz')),
        (fetch, ('archives/libxml2-31094e5d.tar.gz','https://codeload.github.com/GNOME/libxml2/tar.gz/31094e5d0f65a528965e8c32a488e5a7f36118ca')),
        (fetch, ('archives/zlib-ng-9174ab6.tar.gz','https://codeload.github.com/zlib-ng/zlib-ng/tar.gz/9174ab6bf58ac9a518dbe197b948c897f74834f5')),
    ])
    batch(jobs)
    jobs = []
    for package in PINS:
        path = OUT / ('upstream/msys2-'+package+'-directory.json')
        if not path.exists():
            continue
        for item in json.loads(path.read_text(encoding='utf8')):
            if item['type']=='file':
                jobs.append((fetch, ('recipes/'+package+'/'+item['name'],item['download_url'])))
    batch(jobs)
