"""Read-only private destination verification. Never print or save credentials."""
from pathlib import Path
from datetime import datetime, timezone
import json
import os
import subprocess
import urllib.request
import urllib.error

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
EXPECTED = 'https://github.com/Yod-Kaewchart/Audio-Tech-Lab-Private-Backup.git'
REPO = 'Yod-Kaewchart/Audio-Tech-Lab-Private-Backup'


def verify():
    urls = [subprocess.check_output(['git', 'remote', 'get-url', 'private-backup'], cwd=ROOT, text=True).strip(),
            subprocess.check_output(['git', 'remote', 'get-url', '--push', 'private-backup'], cwd=ROOT, text=True).strip()]
    if urls != [EXPECTED, EXPECTED]:
        raise RuntimeError('Destination URLs do not match the authorized private repository')
    env = dict(os.environ, GIT_TERMINAL_PROMPT='0', GCM_INTERACTIVE='Never')
    proc = subprocess.run(['git', 'credential', 'fill'], cwd=ROOT,
        input='protocol=https\nhost=github.com\npath=' + REPO + '.git\n\n',
        capture_output=True, text=True, env=env, timeout=30)
    if proc.returncode:
        raise RuntimeError('Existing Git credential unavailable; details withheld')
    credential = dict(line.split('=', 1) for line in proc.stdout.splitlines() if '=' in line)
    if not credential.get('password'):
        raise RuntimeError('Existing Git credential does not provide authentication')
    request = urllib.request.Request('https://api.github.com/repos/' + REPO,
        headers={'Authorization': 'Bearer ' + credential['password'], 'Accept': 'application/vnd.github+json',
                 'User-Agent': 'Audio-Tech-Labs-private-backup-verification'})
    with urllib.request.urlopen(request, timeout=30) as response:
        data = json.load(response)
    if data.get('full_name') != REPO or data.get('private') is not True or data.get('visibility') != 'private':
        raise RuntimeError('Private visibility/identity not verified; push prohibited')
    if data.get('archived') or data.get('disabled') or not data.get('permissions', {}).get('push'):
        raise RuntimeError('Repository is not available for the authorized push')
    safe = {key: data.get(key) for key in ['id', 'full_name', 'html_url', 'private', 'visibility', 'archived', 'disabled', 'permissions']}
    safe.update({'checkedUtc': datetime.now(timezone.utc).isoformat(), 'fetchAndPushUrl': EXPECTED,
        'status': 'PRIVATE VERIFIED', 'method': 'Authenticated GitHub REST GET using existing Git credential in memory; secret not persisted or printed',
        'connectorMetadataCheck': 'Earlier connector returned 404 / NOT_FOUND; not evidence of repository visibility'})
    (HERE / 'private-destination-check.json').write_text(json.dumps(safe, indent=2) + '\n', encoding='utf-8', newline='\n')
    print('PRIVATE VERIFIED: exact authorized repository; fetch/push URL match; private=true, push permitted. Credential not persisted or printed.')


if __name__ == '__main__':
    try:
        verify()
    except urllib.error.HTTPError as error:
        raise SystemExit('Private verification failed: GitHub HTTP ' + str(error.code)) from None
    except Exception as error:
        raise SystemExit('Private verification failed: ' + (str(error) if isinstance(error, RuntimeError) else type(error).__name__)) from None
