"""Meaningful docs/evidence checks only; no application invocation or build."""
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import unquote, urlsplit
import copy
import hashlib
import json
import re
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
WORK = HERE.parent / 'source-taskbar-20261009'
OLD = HERE.parent / 'gyan-response-20261010'
REQUESTS = HERE.parent / 'source-requests-20261009'
R2 = ROOT / 'desktop/media-tools/release/source-review-0.2.2-beta.2-r2-INCOMPLETE'
BASELINE = 'db1be04fdfa7cb663338156b1f839e7d8f9bcfae'
ALLOWED = {
    'desktop/media-tools/PUBLIC-BETA-REVIEW-20261009.md',
    'desktop/media-tools/evidence/gyan-response-20261010/README.md',
    'desktop/media-tools/evidence/gyan-response-20261010/GYAN-FOLLOWUP-DRAFT.md',
    'desktop/media-tools/evidence/source-requests-20261009/README-พี่ยอด.md',
    'desktop/media-tools/evidence/source-requests-20261009/contact-verification.json',
    'desktop/media-tools/evidence/source-taskbar-20261009/SOURCE-CLOSURE-PLAN.md',
    'desktop/media-tools/evidence/source-taskbar-20261009/SOURCE-INVENTORY.md',
    'desktop/media-tools/evidence/source-taskbar-20261009/source-inventory.json'
}
PREFIX = HERE.relative_to(ROOT).as_posix() + '/'
results = {}
hash_cache = {}


def git(*args):
    return subprocess.check_output(['git', '-c', 'core.quotepath=false', *args], cwd=ROOT, stderr=subprocess.PIPE)


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def sha(path):
    path = path.resolve()
    if path not in hash_cache:
        digest = hashlib.sha256()
        with path.open('rb') as handle:
            for block in iter(lambda: handle.read(1024 * 1024), b''):
                digest.update(block)
        hash_cache[path] = digest.hexdigest()
    return hash_cache[path]


def check_receipt(base, record, file_key='file', hash_key='sha256'):
    path = base / record[file_key]
    assert path.is_file(), f'Missing receipt target {path}'
    assert sha(path) == record[hash_key], f'Receipt SHA mismatch {path}'
    if 'bytes' in record:
        assert path.stat().st_size == record['bytes'], f'Receipt size mismatch {path}'


def paths(raw):
    return [p.decode('utf-8') for p in raw.split(b'\0') if p]


def scope_check():
    changed = paths(git('diff', BASELINE, '--name-only', '-z'))
    untracked = paths(git('ls-files', '--others', '--exclude-standard', '-z'))
    assert all(p in ALLOWED or p.startswith(PREFIX) for p in changed + untracked), 'Unexpected work outside authorized docs/evidence'
    assert all(not p.endswith(('.exe', '.dll', '.whl', '.zip', '.tgz', '.tar.gz', '.tar.xz')) for p in changed + untracked), 'Binary/archive included in docs change'
    return changed + untracked


def index_check():
    staged = paths(git('diff', '--cached', '--name-only', '-z'))
    assert staged, 'No staged docs/evidence'
    assert all(p in ALLOWED or p.startswith(PREFIX) for p in staged)
    assert all(not p.startswith(PREFIX + 'archives/') for p in staged)
    git('diff', '--cached', '--check')
    raw_targets = [HERE / 'gyan-reply-text.txt', HERE / 'user-task-instructions.txt', *sorted((HERE / 'legal').glob('*'))]
    for path in raw_targets:
        index_bytes = git('show', ':' + path.relative_to(ROOT).as_posix())
        assert index_bytes == path.read_bytes(), f'Index raw evidence altered: {path.name}'
    print(json.dumps({'status': 'PASS', 'stagedDocsFiles': len(staged), 'rawEvidenceBlobsByteIdentical': len(raw_targets), 'binaryArchivesStaged': False}))


def validate():
    changed = scope_check()
    git('diff', '--check')
    results['docsOnlyScope'] = {'status': 'PASS', 'pathsChecked': len(changed), 'runtimeBinaryDependencyVersionChanges': False}
    json_paths = sorted(HERE.glob('*.json')) + [WORK / 'source-inventory.json', REQUESTS / 'contact-verification.json']
    for path in json_paths:
        read_json(path)
    for path in HERE.glob('*.py'):
        compile(path.read_text(encoding='utf-8'), str(path), 'exec')
    results['syntax'] = {'jsonFilesParsed': len(json_paths), 'pythonFilesCompiledWithoutExecution': len(list(HERE.glob('*.py'))), 'status': 'PASS'}

    provenance = read_json(HERE / 'reply-provenance.json')
    for key in ['reply', 'userTaskInstructions']:
        check_receipt(HERE, provenance[key])
    reply = provenance['reply']
    text = (HERE / reply['file']).read_text(encoding='utf-8')
    assert reply['retainedReplyRecords'] == 1 and reply['suppliedCopies'] == 2
    assert text.count('Regards,') == 1 and text.count('On 2026-10-10 09:31 pm') == 1
    assert reply['responseSentDate'] is None and not reply['quotedTimeIsReplyTime']
    results['reply'] = {'status': 'PASS', 'singleRetainedRecord': True, 'replyTimestampNotInvented': True, 'sha256': reply['sha256']}

    legal = read_json(HERE / 'legal-receipts.json')
    for record in legal:
        check_receipt(HERE, record)
        assert urlsplit(record['url']).hostname == 'www.gnu.org' and record['httpStatus'] == 200
    assert '1. Source Code.' in (HERE / 'legal/gpl-3.0.txt').read_text(encoding='utf-8')
    assert 'MustSourceBuildToMatchExactHashOfBinary' in (HERE / 'legal/gpl-faq.en.html').read_text(encoding='utf-8')
    results['officialLegalReferences'] = {'status': 'PASS', 'rawReceiptsChecked': len(legal)}

    inv = read_json(WORK / 'source-inventory.json')
    previous = json.loads(git('show', f'{BASELINE}:{(WORK / "source-inventory.json").relative_to(ROOT).as_posix()}').decode('utf-8'))
    assert len(inv['components']) == 84 and len(inv['sourceFiles']) == 42
    assert inv['sourceFiles'] == previous['sourceFiles'] and inv['vendorHashes'] == previous['vendorHashes']
    for i, (now, before) in enumerate(zip(inv['components'], previous['components'])):
        for key in ['component', 'license', 'notices', 'sourceArchives', 'correspondingSourceStatus']:
            assert now[key] == before[key], f'Unexpected factual change in row {i}/{key}'
        if i != 42:
            assert now['version'] == before['version']
        if not 38 <= i <= 45:
            assert now['presence'] == before['presence'] and now['buildEvidence'] == before['buildEvidence']
        assert now['correspondingSourceStatus'] == 'BLOCKED'
    for s in inv['sourceFiles']:
        check_receipt(WORK if s['file'].startswith('../') else R2, s)
    for r in inv['components']:
        for s in r['sourceArchives']:
            check_receipt(WORK if s['file'].startswith('../') else R2, s)
    assessment = read_json(HERE / 'source-gap-assessment.json')
    issues = {r['id']: r for r in assessment['issues']}
    assert all(not x['blocksSourceGateByItself'] for x in issues.values() if x['category'] == 'B')
    assert not assessment['criterion']['bitIdenticalRebuildRequired']
    assert assessment['ffmpeg']['remainingKnownExternalCount'] == 35
    assert not assessment['ytDlp']['newTechnicalEvidenceFromGyan']
    assert len(assessment['componentReviews']) == 84
    for r in inv['components']:
        assert all(k in issues for k in r['gapAssessment']['issueIds'])
    latest = read_json(HERE / 'confirmed-source-review.json')
    confirmed = {r['component']: r for r in latest['rows']}
    assert {k for k,r in confirmed.items() if r['publisherConfirmation'].get('msys2PackageOriginConfirmed')} == {'bzip2','gnutls','libiconv','gmp'}
    assert {k for k,r in confirmed.items() if r['publisherConfirmation'].get('repositoryAndFullCommitConfirmed')} == {'libxml2','zlib-ng'}
    assert confirmed['zlib-ng']['publisherConfirmation']['zlibCompatibility'] == 'ON'
    assert {k for k,r in confirmed.items() if r['publisherBuildConfigurationReceived']} == {'libxml2','zlib-ng'}
    assert not any(r['publisherFullBuildConfigurationReceived'] for r in confirmed.values())
    assert confirmed['gmp']['fullCommit'] is None and not confirmed['gmp']['mercurialMetadataRequiredForReleaseRecipe']
    assert not any(r['binaryBindingVerified'] for r in latest['rows'])
    results['inventoryAndAssessment'] = {'status': 'PASS', 'componentRows': 84, 'retainedInputFiles': 42, 'uncollectedKnownFfmpegRows': 35, 'publisherConfirmedGitInputs': 2, 'publisherConfirmedMsysOrigins': 4, 'allSourceGates': 'BLOCKED / INCOMPLETE', 'ytDlpTechnicalFactsPreserved': True}

    receipt_count = 0
    for name in ['upstream-receipts.json', 'source-text-receipts.json']:
        for s in read_json(OLD / name):
            if s.get('sha256') and s.get('file'):
                check_receipt(OLD, s)
                receipt_count += 1
    for r in latest['recipeReview']:
        check_receipt(HERE, r, 'recipeFile', 'recipeSha256')
    checks = read_json(OLD / 'patch-checks.json')['results']
    assert len(checks) == 14
    for p in checks:
        check_receipt(OLD, p, 'patch')
    results['retainedSourceRecipePatchReceipts'] = {'status': 'PASS', 'previousFetchTextReceiptsChecked': receipt_count, 'recipeHashesChecked': 8, 'patchHashesChecked': 14, 'patchApplicabilityRerun': False}

    contact = read_json(REQUESTS / 'contact-verification.json')
    assert len(contact['responseEvidence']) == 2
    for s in contact['responseEvidence']:
        check_receipt(REQUESTS, s)
    gyan = next(c for c in contact['contacts'] if c['publisher'] == 'Gyan')
    yt = next(c for c in contact['contacts'] if c['publisher'] == 'yt-dlp')
    assert gyan['followupStatus'] == 'RESPONDED — user-provided email text'
    assert yt['responseStatus'] == 'AWAITING RESPONSE' and not contact['sentByAgent']
    draft = OLD / 'GYAN-FOLLOWUP-DRAFT.md'
    before = git('show', f'{BASELINE}:{draft.relative_to(ROOT).as_posix()}').decode('utf-8')
    def body(s):
        return s.split('<!-- EMAIL BODY START -->', 1)[1].split('<!-- EMAIL BODY END -->', 1)[0]
    assert body(before) == body(draft.read_text(encoding='utf-8'))
    for path in [OLD/'gyan-user-provided-email.txt', REQUESTS/'GYAN-REQUEST-DRAFT.md', REQUESTS/'YT-DLP-REQUEST-DRAFT.md']:
        original = git('show', f'{BASELINE}:{path.relative_to(ROOT).as_posix()}')
        assert original == path.read_bytes().replace(b'\r\n', b'\n') or original == path.read_bytes()
    results['contactDraftHistory'] = {'status': 'PASS', 'replyRecords': 2, 'oldDraftBodyUnchanged': True, 'noAgentSending': True}

    r2_sums = read_json(R2 / 'SHA256SUMS.json')
    for s in r2_sums:
        check_receipt(R2, s)
    archived = read_json(R2 / 'SOURCE-INVENTORY-INCOMPLETE.json')
    assert archived['sourceFiles'] == previous['sourceFiles'][:34]
    results['archivedR2Preservation'] = {'status': 'PASS', 'manifestFilesRehashed': len(r2_sums), 'archivedInputRecords': 34}
    vendor = ROOT / 'desktop/media-tools/vendor'
    manifest = read_json(vendor / 'manifest.json')
    for r in manifest['tools'].values():
        check_receipt(vendor, r)
    for r in manifest['archives']:
        if r['name'].startswith('ffmpeg-'):
            check_receipt(ROOT / 'desktop/media-tools/cache', {'file': r['name'], 'sha256': r['sha256']})
    taskbar = read_json(HERE.parent / 'taskbar-elitebook-20261009/manual-hover-validation.json')
    assert sha(ROOT / 'desktop/media-tools/dependencies.lock.json') == taskbar['dependencyLockSha256']
    image = HERE.parent / 'taskbar-elitebook-20261009/portable-hover-thumbnail-manual.png'
    assert sha(image) == taskbar['sourceAndCopySha256']
    assert taskbar['portableTaskbarGate'].startswith('PASS')
    results['binaryAndGatePreservation'] = {'status': 'PASS', 'vendorToolsRehashed': len(manifest['tools']), 'originalFfmpegZipRehashed': True, 'dependencyLockUnchanged': True, 'portableManualEvidenceUnchanged': True, 'runtimeTestsOrRebuildPerformed': False}

    md_files = [ROOT/p for p in ALLOWED if p.endswith('.md')] + [HERE/'README.md']
    links = 0
    for path in md_files:
        for match in re.finditer(r'\[[^\]\n]*\]\(([^\n]+?)\)', path.read_text(encoding='utf-8')):
            value = match.group(1).strip().strip('<>')
            if urlsplit(value).scheme or value.startswith('#'):
                continue
            target = (path.parent / unquote(value.split('#', 1)[0])).resolve()
            if target == HERE / 'validation.json':
                continue  # This invocation writes the report after these checks.
            assert target.exists(), f'Broken local link in {path.name}: {value}'
            links += 1
    private = read_json(HERE / 'private-destination-check.json')
    assert private['private'] is True and private['full_name'] == 'Yod-Kaewchart/Audio-Tech-Lab-Private-Backup'
    results['localMarkdownLinks'] = {'status': 'PASS', 'filesChecked': len(md_files), 'linksChecked': links, 'ownReportWrittenAtEnd': True}
    results['privateDestination'] = {'status': 'PASS', 'liveCheckReceiptUtc': private['checkedUtc'], 'visibility': 'private', 'pushNotPerformedByValidator': True}
    output = {'schema': 1, 'checkedUtc': datetime.now(timezone.utc).isoformat(), 'status': 'PASS', 'baselineCommit': BASELINE, 'checks': results, 'distinctLocalFilesHashed': len(hash_cache)}
    (HERE/'validation.json').write_text(json.dumps(output, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')
    print(json.dumps({'status': 'PASS', 'checkGroups': len(results), 'localFilesHashed': len(hash_cache), 'jsonFilesParsed': len(json_paths), 'localMarkdownLinks': links, 'sourceGate': 'BLOCKED / INCOMPLETE'}))


if __name__ == '__main__':
    if '--index-only' in sys.argv:
        index_check()
    else:
        validate()
