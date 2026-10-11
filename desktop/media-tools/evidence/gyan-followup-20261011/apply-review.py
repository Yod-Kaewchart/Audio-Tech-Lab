"""Apply this dated docs-only review to the db1be04 baseline; never touch release/runtime.

Historical collectors in gyan-response-20261010/ are not current inventory writers.
Re-running this file reconstructs the same update from Git, without duplicating replies.
"""
from pathlib import Path
import copy
import hashlib
import json
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
EVIDENCE = HERE.parent
WORK = EVIDENCE / 'source-taskbar-20261009'
OLD = EVIDENCE / 'gyan-response-20261010'
REQUESTS = EVIDENCE / 'source-requests-20261009'
BASELINE = 'db1be04fdfa7cb663338156b1f839e7d8f9bcfae'


def baseline_text(path):
    relative = path.relative_to(ROOT).as_posix()
    return subprocess.check_output(['git', 'show', f'{BASELINE}:{relative}'], cwd=ROOT).decode('utf-8')


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')


def receipt(path):
    raw = path.read_bytes()
    return {'file': path.relative_to(HERE).as_posix(), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}


inv = json.loads(baseline_text(WORK / 'source-inventory.json'))
prior = json.loads((OLD / 'upstream-resolution.json').read_text(encoding='utf-8'))
reply = receipt(HERE / 'gyan-reply-text.txt')
reply.update({
    'status': 'RESPONDED — user-provided email text', 'type': 'user-provided email text transcription',
    'providedLocalDate': '2026-10-11', 'timezone': 'Asia/Bangkok',
    'responseSentDate': None, 'originalEmailHeadersReceived': False, 'independentlyAuthenticated': False,
    'quotedRequestDateTimeText': '2026-10-10 09:31 pm', 'quotedRequestAuthor': 'Yod Kaewchart',
    'quotedRequestTimezone': None, 'quotedTimeIsReplyTime': False,
    'suppliedCopies': 2, 'retainedReplyRecords': 1, 'retainedCopy': 'first complete copy ending Regards, Gyan',
    'whitespaceNormalized': True, 'transportEscapesRetained': True, 'summaryOnly': False,
    'transcriptionNote': 'One complete supplied reply retained; ordinary spaces replace nonbreaking/indent spaces. Markdown link markup and transport backslashes remain. Not a .eml or original MIME/header record.'
})
write_json(HERE / 'reply-provenance.json', {'schema': 1, 'reply': reply, 'userTaskInstructions': receipt(HERE / 'user-task-instructions.txt')})

issues = []


def issue(id_, category, scope, gap, close, state='OPEN', blocks=True):
    issues.append({'id': id_, 'category': category, 'scope': scope, 'state': state,
                   'blocksSourceGateByItself': blocks, 'gap': gap, 'closure': close})


issue('A-FF-SOURCE', 'A', 'FFmpeg',
      '35 of the 37 README external-library rows still have no collected source archive in this working set (rubberband and vid.stab collected). Applicable modifications and included transitive sources also need coverage.',
      'Collect the actual preferred source/version and modifications for included components, plus applicable licenses/notices. Hardware/header-only and System Library scope must be resolved rather than assumed.')
issue('A-FF-CONTROL', 'A', 'FFmpeg',
      'The publisher identifies custom build scripts but has not supplied the portions controlling generation/installation of the combined binaries. Upstream build systems, selected recipes and saved FFmpeg configure arguments provide partial coverage, not a complete documented build path for this input set.',
      'Include the build/install control scripts and non-regenerable configuration inputs actually needed. Identify selected sources, patches and dependencies; ordinary unmodified available tools need not be archived as corresponding source. Review which original custom portions are necessary; do not demand unrelated machine automation or every historical log.')
issue('C-FF-PATCHES', 'C', 'FFmpeg',
      'Actual local modifications/patch selection for core and libraries remain incompletely known. Vanilla CMake is not a blanket no-patch declaration.',
      'Resolve the actual modified source/patch set. A written no-patch statement is one evidence route, not a separately prescribed GPL document. If modifications exist, their preferred source is category A.')
issue('C-FF-GRAPH', 'C', 'FFmpeg',
      'Actual included transitive libraries, static/shared selections and System Library/SDK scope remain unresolved; package depends lists do not establish a link graph.',
      'Use selected build inputs, package/source metadata or equivalent evidence to identify actual inclusion and scope. A link map is helpful but not the only acceptable evidence. Collect required sources after classification.')
issue('C-FF-RECIPES', 'C', 'FFmpeg',
      'MSYS2 origin is confirmed for bzip2/GnuTLS/libiconv/GMP. Exact recipe commit, architecture and patch selection are not expressly identified; GMP pkgrel 2 remains candidate. fontconfig/XZ MSYS2 provenance is not confirmed.',
      'Tie version-matching recipes/source packages to selected inputs. Keep bzip2 1.0.8-4, GnuTLS 3.8.13-3 and libiconv 1.19-1 version matches distinct from recipe-commit proof; identify GMP package revision.')
issue('C-FF-XML-CONFIG', 'C', 'FFmpeg/libxml2',
      'Repo/commit and vanilla CMake are publisher-confirmed, but selected iconv/ICU/zlib/thread and static/shared configuration is not itemized.',
      'Establish only the selected settings/dependency inputs needed to describe and build the library used. Upstream defaults are evidence about source, not proof of actual choices; necessary configuration becomes A.')
issue('C-FF-ZLIB-CONFIG', 'C', 'FFmpeg/zlib-ng',
      'Repo/commit and compatibility ON, with all downstream using it, are publisher-confirmed through supplied text. Other selections and modifications are not established.',
      'Use the confirmed compatibility choice in the build description; verify required configuration/patch scope. Apply downstream assertion to Gyan FFmpeg build context only, not yt-dlp or the whole app.')
issue('A-YT-NATIVE', 'A', 'yt-dlp',
      'Preferred sources/modifications for confirmed CPython native inputs and required native wheel components are not fully collected. Candidate curl static dependencies remain subject to inclusion/version classification.',
      'Collect the actual sources/patches for required included CPython, native wheel, curl and bootloader components; distinguish separate copies and respect System Library exclusions.')
issue('A-YT-JS', 'A', 'yt-dlp',
      'Preferred-source coverage for Meriyah/Astring and the required JS generation inputs is incomplete. EJS TS/config/lock source exists; compiled npm dist alone does not establish preferred source.',
      'Collect missing preferred JS/TS and necessary control/configuration inputs. General-purpose unmodified available build tools are not automatically part of corresponding source.')
issue('A-YT-CONTROL', 'A', 'yt-dlp',
      'Release bundle/workflow, custom PyInstaller recipe and CPython build scripts provide partial coverage; necessary control/configuration inputs for unresolved native builds are not yet fully included.',
      'Complete the build/install source path for the actual included native inputs and any non-regenerable generated configuration. No bit-identical rebuild is required.')
issue('C-YT-MAPPING', 'C', 'yt-dlp',
      'Selected bootloader/native wheel source and modifications, JS-to-payload correspondence and actual transitive native versions are not fully resolved. No new yt-dlp reply received.',
      'Use existing wheel/DLL hashes, recipes and publisher information to identify source inputs; keep Gyan confirmations separate. A hash comparison can be useful evidence without requiring rebuilt EXE hash identity.')
issue('C-YT-RUNTIME', 'C', 'yt-dlp',
      'Redistributable terms/notices, System Library scope and platform-union notice entries still require classification.',
      'Determine actual Windows payload and rights/notices. Do not require unrelated OSS source for closed-source runtime DLLs or assume all cross-platform notice entries are included.')
issue('B-LOGS', 'B', 'both',
      'Ephemeral config.log, link maps, build logs and package manifests are helpful audit evidence when available; publisher says most ephemeral artifacts were not archived.',
      'Use alternative sufficient source/build descriptions. Missing logs alone do not fail GPL; extract any indispensable non-regenerable configuration/build control into A rather than classifying it as optional.', blocks=False)
issue('B-TOOLCHAIN', 'B', 'both',
      'Exact compiler/runner/environment snapshots improve reproducibility but are not automatically corresponding source.',
      'Record known tool identity if useful. Assess modifications or incorporated runtime components separately under A/C; do not treat every general-purpose tool or compiler source as required.', blocks=False)
issue('B-EXACT-HASH', 'B', 'both',
      'No rebuild or bit-identical SHA256 comparison has been performed.',
      'GNU FAQ explicitly does not require a rebuild matching the distributed binary hash. Preserve binary identity and source provenance without using this as an acceptance gate.', state='NOT REQUIRED', blocks=False)
issue('B-GMP-HG', 'B', 'FFmpeg/GMP',
      'GMP Mercurial metadata remains inaccessible (historical HTTP 403), but the version-matching MSYS2 recipe uses a checksummed 6.3.0 release tarball, not a Mercurial checkout.',
      'Retire Mercurial full changeset as a standalone blocker for the release-tarball route. Reopen source identity under C only if evidence points to a different checkout; no revision is invented.', state='RETIRED AS STANDALONE BLOCKER', blocks=False)

by_id = {r['id']: r for r in issues}
criterion = {
    'reviewLocalDate': '2026-10-11', 'taxonomy': {'A': 'Necessary corresponding source/build controls', 'B': 'Additional audit/reproducibility evidence', 'C': 'Unresolved scope/selection requiring classification'},
    'officialReferences': [
        {'url': 'https://www.gnu.org/licenses/gpl-3.0.html#section1', 'localFile': 'legal/gpl-3.0.html', 'scope': 'Section 1; preferred source, necessary build/install/run/modify control scripts; exclusions and regenerable material'},
        {'url': 'https://www.gnu.org/licenses/gpl-faq.en.html#MustSourceBuildToMatchExactHashOfBinary', 'localFile': 'legal/gpl-faq.en.html', 'scope': 'Source of the actual binaries; exact rebuilt hash not required'}],
    'bitIdenticalRebuildRequired': False, 'allEphemeralLogsRequired': False,
    'publisherOpinionClosesGate': False, 'writtenNoPatchDeclarationMandatoryByItself': False,
    'interpretation': 'Reviewer application of official criteria to retained evidence; not an assertion that every candidate library or tool is included. B does not block by itself; C requires resolution and may expose A requirements.'
}

component_reviews = []
native_wheels = {51, 52, 54, 57, 58, 59}
for i, r in enumerate(inv['components']):
    old_missing = copy.deepcopy(r['missing'])
    if i == 0:
        ids = ['A-FF-SOURCE', 'A-FF-CONTROL', 'C-FF-PATCHES', 'C-FF-GRAPH', 'B-LOGS', 'B-TOOLCHAIN', 'B-EXACT-HASH']
    elif 1 <= i <= 37:
        ids = (['A-FF-SOURCE'] if not r['sourceArchives'] else []) + ['A-FF-CONTROL', 'C-FF-PATCHES', 'C-FF-GRAPH', 'B-LOGS']
    elif 38 <= i <= 45:
        ids = ['A-FF-CONTROL', 'C-FF-PATCHES', 'C-FF-GRAPH']
        if i not in [41, 45]: ids += ['C-FF-RECIPES']
        if i == 41: ids += ['C-FF-XML-CONFIG']
        if i == 45: ids += ['C-FF-ZLIB-CONFIG']
        ids += ['B-LOGS', 'B-TOOLCHAIN']
        if i == 42: ids += ['B-GMP-HG']
    elif i == 46:
        ids = ['C-FF-GRAPH', 'C-FF-PATCHES', 'B-LOGS', 'B-TOOLCHAIN']
    elif i == 47:
        ids = ['A-YT-NATIVE', 'A-YT-JS', 'A-YT-CONTROL', 'C-YT-MAPPING', 'B-EXACT-HASH']
    elif i in [48, 49, 74] or i in native_wheels:
        ids = ['A-YT-CONTROL', 'C-YT-MAPPING', 'B-LOGS', 'B-TOOLCHAIN']
        if i in [49, 54, 58, 74]: ids.insert(0, 'A-YT-NATIVE')
    elif 63 <= i <= 65:
        ids = (['A-YT-JS'] if i != 63 else []) + ['A-YT-CONTROL', 'C-YT-MAPPING', 'B-LOGS']
    elif 66 <= i <= 73:
        ids = ['A-YT-NATIVE', 'A-YT-CONTROL', 'C-YT-MAPPING', 'B-LOGS']
    elif 75 <= i <= 81:
        ids = ['C-YT-MAPPING', 'B-LOGS']
    elif i in [82, 83]:
        ids = ['C-YT-RUNTIME', 'B-LOGS']
    else:
        ids = ['C-YT-MAPPING']
    r['gapAssessment'] = {'reviewLocalDate': '2026-10-11', 'issueIds': ids,
                          'details': '../gyan-followup-20261011/source-gap-assessment.json',
                          'scopeNote': 'Issue references describe combined-build coverage and unresolved review scope, not proof of a per-library legal violation.'}
    r['missing'] = [f"{by_id[k]['category']} [{k}]: {by_id[k]['gap']}" for k in ids if by_id[k]['state'] == 'OPEN']
    r['closure'] = 'Resolve the A/C issues referenced in gapAssessment using sufficient actual source/build evidence; B items do not block by themselves and bit-identical rebuilding is not required.'
    component_reviews.append({'index': i, 'component': r['component'], 'priorMissingAtBaseline': old_missing, 'currentIssueIds': ids})

rows = []
msys_confirmed = {'bzip2', 'gnutls', 'libiconv', 'gmp'}
for old_r in prior['rows']:
    r = copy.deepcopy(old_r)
    name = r['component']
    r['pathBase'] = '../gyan-response-20261010/'
    target = next(c for c in inv['components'] if c.get('upstreamResolution', {}).get('component') == name)
    confirmation = {'status': 'RESPONDED — user-provided email text', 'providedLocalDate': '2026-10-11',
                    'evidence': '../gyan-followup-20261011/gyan-reply-text.txt',
                    'independentlyAuthenticated': False, 'binaryBindingIndependentlyVerified': False}
    if name in ['libxml2', 'zlib-ng']:
        confirmation.update({'repositoryAndFullCommitConfirmed': True, 'sourceRepository': r['sourceRepository'], 'fullCommit': r['fullCommit']})
        r['revisionStatus'] = 'PUBLISHER-CONFIRMED REPOSITORY/FULL COMMIT — user-provided email text; upstream independently resolved'
        r['sourceIdentityStatus'] = 'PUBLISHER-CONFIRMED'
        target['presence'] = 'enabled in baseline; version and exact source repository/commit publisher-confirmed via user-provided email text'
        if name == 'libxml2':
            confirmation['buildDescription'] = 'Vanilla cmake, nothing custom.'
            confirmation['selectedFeatureFlagsReceived'] = False
            target['buildEvidence'] = 'Publisher-confirmed repository/full commit and vanilla CMake; exact upstream README/CMake controls collected; selected dependency/static/shared settings not itemized.'
            r['dependencyAudit'].append('2026-10-11: vanilla CMake confirmed; source defaults do not prove selected iconv/ICU/zlib/thread/static flags.')
        else:
            confirmation.update({'zlibCompatibility': 'ON', 'downstreamStatement': 'All downstream use this lib.', 'downstreamScope': 'Gyan FFmpeg build described in this email; not yt-dlp or the entire app'})
            target['buildEvidence'] = 'Publisher-confirmed repository/full commit, compatibility ON and same zlib-ng for all downstream in Gyan FFmpeg context; no original control scripts received.'
            r['dependencyAudit'][1] = 'Source defaults ZLIB_COMPAT OFF; publisher confirms compatibility ON and all downstream use this lib in the Gyan FFmpeg context. Other selections and independent binary validation remain unresolved.'
    elif name in msys_confirmed:
        confirmation.update({'msys2PackageOriginConfirmed': True, 'exactRecipeCommitConfirmed': False,
                             'ucrt64ArchitectureExpresslyConfirmed': False,
                             'packageVersionContext': r['publisherReportedVersion']})
        r['packageProvenanceStatus'] = 'MSYS2 PUBLISHER-CONFIRMED — user-provided email text; exact recipe revision remains candidate'
        target['presence'] = 'enabled in baseline; reported version and MSYS2 package origin publisher-confirmed via supplied email text'
        target['buildEvidence'] = 'MSYS2 package origin confirmed; version-matching release-source recipe and patches retained; selected recipe commit/architecture and build controls not expressly identified.'
        if name == 'gmp':
            confirmation['packageRevisionConfirmed'] = False
            target['version'] = '6.3.0; release tarball SHA256 pinned; MSYS2 origin confirmed; package revision unconfirmed'
            r['revisionStatus'] = 'RELEASE SOURCE PINNED; Mercurial metadata not required for this recipe route; exact package revision candidate'
            r['mercurialMetadataRequiredForReleaseRecipe'] = False
            r['patchAudit'] = 'Two candidate static-link/dllimport patches; pkgrel 2 remains candidate. Historical Mercurial HTTP 403 is not a standalone corresponding-source blocker for the release-tarball recipe.'
    else:
        confirmation.update({'repositoryAndFullCommitConfirmed': False, 'msys2PackageOriginConfirmed': False,
                             'scope': 'Second reply adds no provenance confirmation for fontconfig/XZ; first reported version retained'})
        target['buildEvidence'] = 'First-reply version assertion and independently resolved upstream candidate; second reply does not confirm MSYS2 recipe/package provenance for this library.'
    r['publisherConfirmation'] = confirmation
    r['publisherBuildConfigurationReceived'] = name in ['libxml2', 'zlib-ng']
    r['publisherFullBuildConfigurationReceived'] = False
    r['publisherBuildConfigurationCoverage'] = 'PARTIAL — compatibility ON / vanilla CMake only' if name in ['libxml2', 'zlib-ng'] else 'NOT RECEIVED; package origin is provenance rather than full configuration'
    target['publisherConfirmation'] = copy.deepcopy(confirmation)
    target['upstreamResolution'] = copy.deepcopy(r)
    rows.append(r)

reused = []
patch_checks = json.loads((OLD / 'patch-checks.json').read_text(encoding='utf-8'))['results']
for r in rows:
    path = OLD / r['candidateRecipe']
    raw = path.read_bytes()
    item = {'component': r['component'], 'recipeFile': '../gyan-response-20261010/' + r['candidateRecipe'],
            'recipeSha256': hashlib.sha256(raw).hexdigest(), 'recipeCommit': r['candidateRecipeCommit'],
            'recipeVersion': r['candidateRecipeVersion'], 'packageRevision': r['candidatePackageRevision'],
            'msys2OriginPublisherConfirmed': r['component'] in msys_confirmed,
            'actualRecipeCommitPublisherConfirmed': False, 'sourceSha256MatchesRecipe': r['sha256MatchesCandidateRecipe'],
            'existingPatchChecks': [p for p in patch_checks if p['component'] == r['component']],
            'coverage': 'Version-matching candidate recipe: source/patches, prepare/build/install commands; selected original recipe still requires C review.'}
    if r['component'] in ['libxml2', 'zlib-ng']:
        item['coverage'] = 'Current MSYS2 recipe is comparison only and differs from confirmed source snapshot; do not assign its patches to this build. Exact-commit upstream CMake/README controls are available.'
    reused.append(item)

write_json(HERE / 'confirmed-source-review.json', {'schema': 1, 'reviewLocalDate': '2026-10-11',
    'replyEvidence': reply, 'rows': rows, 'recipeReview': reused, 'newSourceFetches': 0,
    'inheritedRowPathsRelativeTo': '../gyan-response-20261010/',
    'priorSourceArchivesRetained': 8, 'existingPatchChecksRetained': 14,
    'patchChecksRerun': False, 'buildPerformed': False, 'sourceGate': 'BLOCKED', 'sourceLabel': 'INCOMPLETE'})

ff_missing = [r['component'] for r in inv['components'][1:38] if not r['sourceArchives']]
assessment = {'schema': 1, 'reviewLocalDate': '2026-10-11', 'timezone': 'Asia/Bangkok',
    'baselineCommit': BASELINE, 'criterion': criterion, 'issues': issues, 'componentReviews': component_reviews,
    'ffmpeg': {'sourceGate': 'BLOCKED', 'sourceLabel': 'INCOMPLETE', 'knownExternalRowsWithoutCollectedSource': ff_missing,
               'remainingKnownExternalCount': len(ff_missing), 'reason': 'Actual source collection and necessary combined-build control coverage incomplete; selected modifications/transitive scope still unresolved. Logs and exact-hash rebuild do not decide the gate.'},
    'ytDlp': {'responseStatus': 'AWAITING RESPONSE', 'sourceGate': 'BLOCKED', 'sourceLabel': 'INCOMPLETE',
              'newTechnicalEvidenceFromGyan': False, 'reason': 'Native preferred sources/build controls and JS preferred-source coverage incomplete, plus unresolved payload/runtime scope; no Gyan assertion closes these gaps.'},
    'nonSourceGates': {'portableTaskbar': 'PASS', 'normalInstalledTaskbarVisual': 'BLOCKED',
                       'liveDownloadEjs': 'BLOCKED', 'cleanMachineInstaller': 'BLOCKED', 'signingSmartScreen': 'BLOCKED',
                       'publicBetaReadiness': 'BLOCKED', 'basis': 'Preserved existing evidence; no runtime QA repeated in this docs-only round.'}}
write_json(HERE / 'source-gap-assessment.json', assessment)

inv['schema'] = 3
inv['unresolvedGraph'] = 'Direct/version rows are not an exhaustive transitive SBOM; resolve actual inclusion and source/build control coverage. A particular historical link map/log or bit-identical rebuild is not mandatory by itself.'
old_response = inv['publisherResponse']
latest = copy.deepcopy(reply)
latest['file'] = '../gyan-followup-20261011/gyan-reply-text.txt'
inv['publisherResponse'] = {'status': 'Gyan RESPONDED — user-provided email text', 'evidence': latest,
    'priorReplies': [old_response['evidence']], 'audit': '../gyan-followup-20261011/confirmed-source-review.json',
    'ytDlpResponseStatus': 'AWAITING RESPONSE'}
inv['sourceReviewCriteria'] = {'assessment': '../gyan-followup-20261011/source-gap-assessment.json',
                             'reviewLocalDate': '2026-10-11', 'bitIdenticalRebuildRequired': False,
                             'allEphemeralLogsRequired': False, 'taxonomy': criterion['taxonomy']}
inv['sourceGates'] = {'ffmpeg': 'BLOCKED / INCOMPLETE', 'ytDlp': 'BLOCKED / INCOMPLETE'}
inv['sourceFilePathPolicy'] = {'archivedR2Records': 'Paths of the original 34 records are relative to ../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/; preserved unchanged.',
                             'followupRecords': 'Paths starting ../gyan-response-20261010/ are relative to this working inventory directory.'}
write_json(WORK / 'source-inventory.json', inv)

md = ['# Source inventory — current review 11 October 2026', '',
      '**BLOCKED / INCOMPLETE — FFmpeg and yt-dlp assessed separately.** 84 component rows, 42 retained source/build-input files (34 archived r2 + 8 later local archives). This is not an exhaustive transitive SBOM.', '',
      'Gyan **RESPONDED — user-provided email text**; yt-dlp **AWAITING RESPONSE**. The second reply confirms libxml2/zlib-ng repo/full commit, zlib compatibility ON/downstream usage in Gyan FFmpeg context, vanilla CMake for libxml2, and MSYS2 origin for bzip2/GnuTLS/libiconv/GMP. Publisher assertions remain separate from independent binary verification.', '',
      'A = necessary preferred source/modifications/build controls; B = additional audit/reproducibility evidence; C = unresolved inclusion/selection. B alone does not block the source gate. GPL does not require a bit-identical rebuild. [Current assessment](../gyan-followup-20261011/README.md) · [issue details and per-row reassessment](../gyan-followup-20261011/source-gap-assessment.json) · [closure plan](SOURCE-CLOSURE-PLAN.md).', '',
      'The 35 remaining README external-library rows without collected source are the main known FFmpeg collection gap. Custom control scripts needed for generation/install are still not supplied; upstream instructions and recipes cover only part of the combined build. Actual patch/graph/configuration choices remain C. GMP Mercurial metadata is no longer a standalone blocker for the MSYS2 release-tarball route.', '',
      '| Component | Version / provenance | Presence | Source archives | Review issues | Status |',
      '| --- | --- | --- | ---: | --- | --- |']
for r in inv['components']:
    values = [r['component'], r['version'], r['presence'], str(len(r['sourceArchives'])), ', '.join(r['gapAssessment']['issueIds']), r['correspondingSourceStatus']]
    md.append('| ' + ' | '.join(v.replace('|', '\\|').replace('\n', ' ') for v in values) + ' |')
md += ['', '## Retained sources/build inputs', '',
       'Local archives are ignored working evidence and are not included in this docs commit or private Git backup. Receipts/selected text are tracked; current source collection remains incomplete. The archived r2 inventory/kit is unchanged.', '',
       '| File | Bytes | SHA256 | Publisher URL |', '| --- | ---: | --- | --- |']
for s in inv['sourceFiles']:
    link = s['file'] if s['file'].startswith('../') else '../../release/source-review-0.2.2-beta.2-r2-INCOMPLETE/' + s['file']
    source_display = f"[source]({s['url']})" if s['url'].startswith(('https://', 'http://')) else s['url']
    md.append(f"| [{s['file']}]({link}) | {s['bytes']} | `{s['sha256']}` | {source_display} |")
md += ['', 'License/notices, build evidence, per-row missing items and full upstream details are retained in [source-inventory.json](source-inventory.json). Historical unclassified requirements are preserved in the baseline and current assessment, rather than treated as current automatic gate criteria.', '']
(WORK / 'SOURCE-INVENTORY.md').write_text('\n'.join(md), encoding='utf-8', newline='\n')

contacts = json.loads(baseline_text(REQUESTS / 'contact-verification.json'))
contacts.update({'schema': 4, 'reviewDate': '2026-10-11',
                 'statusBasis': 'Second reply supplied on 2026-10-11 Asia/Bangkok, deduplicated once. Quoted 2026-10-10 09:31 pm belongs to Yod request, not Gyan reply; no original reply headers or independent authentication. yt-dlp still awaiting.',
                 'baselineHead': BASELINE,
                 'networkScope': 'Read-only official GPL/FAQ and authenticated private-destination metadata checks; authorized docs-only Git push to verified private-backup. No email, issue, public push or deployment.'})
contacts['responseEvidence'].append(latest)
gyan = next(c for c in contacts['contacts'] if c['publisher'] == 'Gyan')
gyan['responseEvidence'].append(latest)
gyan['followupStatus'] = 'RESPONDED — user-provided email text'
gyan['followupSendingEvidence'] = {'basis': 'Yod request is quoted in the user-provided reply',
    'quotedRequestDateTimeText': '2026-10-10 09:31 pm', 'timezoneKnown': False,
    'independentlyVerified': False, 'draftMatchesQuotedOrSentEmailVerified': False, 'sentByAgent': False}
gyan['followupDraftStatus'] = 'HISTORICAL DRAFT — never sent by agent; exact sent-copy match not verified'
contacts['currentSourceAssessment'] = '../gyan-followup-20261011/source-gap-assessment.json'
write_json(REQUESTS / 'contact-verification.json', contacts)

# Add dated metadata around historical content. Preserve every EMAIL BODY byte.
draft_path = OLD / 'GYAN-FOLLOWUP-DRAFT.md'
draft = baseline_text(draft_path)
draft = draft.replace('**DRAFT — NOT SENT** สำหรับพี่ยอดตรวจและส่งต่อใน email thread เดิม อิง Gyan RESPONDED — user-provided email text; source gate ยัง BLOCKED / INCOMPLETE',
    '**HISTORICAL DRAFT — ไม่เคยส่งโดย agent; ไม่ยืนยันว่าฉบับส่งตรงกับร่างนี้**\n\nวันที่ 11 ตุลาคม 2026 ผู้ใช้ให้ [คำตอบรอบสอง](../gyan-followup-20261011/README.md) ซึ่ง quote คำขอ Yod ลงวันที่ 2026-10-10 09:31 pm; follow-up จึงเป็น **RESPONDED — user-provided email text** ไม่มี headers/หลักฐานส่งอิสระ และเวลา quote ไม่ใช่เวลาที่ Gyan ตอบ เก็บเนื้อหาร่างเดิมด้านล่างเป็นประวัติ; ประเด็น repo/commit และ compat ที่ถามได้รับคำยืนยันเพิ่มแล้ว เกณฑ์ logs/compiler/Hg ในร่างเก่าปรับตาม [assessment ล่าสุด](../gyan-followup-20261011/source-gap-assessment.json)')
draft_path.write_text(draft, encoding='utf-8', newline='\n')
old_readme = OLD / 'README.md'
old_readme.write_text('> **Historical snapshot — 10 October 2026.** Latest publisher confirmations and A/B/C criteria supersede this snapshot: [11 October review](../gyan-followup-20261011/README.md). GMP Hg metadata/logs are not current standalone blockers. Original receipts/results and first reply are preserved. Do not re-run the historical apply-response.py to update the current inventory.\n\n' + baseline_text(old_readme), encoding='utf-8', newline='\n')

request_readme = REQUESTS / 'README-พี่ยอด.md'
new_tracking = '''# สถานะ source requests ล่าสุด — 11 ตุลาคม 2026

**Gyan RESPONDED — user-provided email text / yt-dlp AWAITING RESPONSE.** เก็บคำตอบรอบสองที่ผู้ใช้ให้เพียงหนึ่งชุด [text/provenance/ผลตรวจ](../gyan-followup-20261011/README.md) ไม่มี .eml, headers หรือ independent authentication; เวลา `2026-10-10 09:31 pm` เป็นคำขอ Yod ที่ถูก quote ไม่ใช่เวลาคำตอบ

ยืนยัน repo/full commit ของ libxml2 และ zlib-ng, compat ON และ downstream ตามคำตอบในขอบเขต Gyan FFmpeg, vanilla CMake ของ libxml2 และ MSYS2 origin ของ bzip2/GnuTLS/libiconv/GMP ไม่ขยายถึง fontconfig/XZ/yt-dlp หรือทุก package dependency

| Request | Current coverage / gaps |
| --- | --- |
| F1 source/patches | สอง Git inputs publisher-confirmed; แปด archives เดิม retained; source ของ 35 README external rows ยังไม่เก็บ (A), actual patch set ยังไม่ชัด (C) |
| F2 build controls | Upstream CMake/README และ recipes เป็น partial coverage; ส่วน custom controls ที่จำเป็นยังไม่ส่ง (A); selected settings (C); ephemeral logs เป็น B ตามเนื้อหาจริง |
| F3 MSYS2 | Origin ยืนยันสี่ libraries; matching version/rel ของสามรายการตรวจได้ แต่ recipe commit/architecture/patch selection และ GMP pkgrel ยัง C; compiler snapshot เป็น B โดยตัวมันเอง |
| F4 inclusion | Actual transitive/SDK/System Library scope ยัง C; ไม่ใช้ package depends เป็นหลักฐานว่า linked ทั้งหมด |
| F5 source delivery | ชุด actual sources/modifications/necessary controls ยังไม่ครบ (A/C); source gate BLOCKED / INCOMPLETE |
| Y1–Y6 | ยัง AWAITING RESPONSE; ข้อเท็จจริง yt-dlp เดิมคงไว้ แยก A native/JS/controls, C payload/runtime scope และ B logs/compiler; ไม่ใช้คำตอบ Gyan ปิดรายการ |

Follow-up **RESPONDED** อิง request ที่ถูก quote ในข้อความผู้ใช้ ไม่มีการส่งโดย agent หรือยืนยันฉบับส่งตรงร่าง เก็บ [ร่างเดิมพร้อม metadata ประวัติ](../gyan-response-20261010/GYAN-FOLLOWUP-DRAFT.md) และ request drafts เดิม; ไม่ร่างหรือส่งคำขอซ้ำในรอบนี้ ดู [structured tracking](contact-verification.json), [A/B/C assessment](../gyan-followup-20261011/source-gap-assessment.json) และ [closure plan](../source-taskbar-20261009/SOURCE-CLOSURE-PLAN.md)

## ประวัติการติดตามถึง 10 ตุลาคม (เก็บข้อความเดิม)

ข้อความต่อไปนี้เป็น snapshot ก่อนคำตอบรอบสอง เกณฑ์ที่รวม logs/compiler/Hg เป็น required โดยไม่แยกประเภทให้ใช้ assessment ล่าสุดด้านบนแทน

'''
request_readme.write_text(new_tracking + baseline_text(request_readme), encoding='utf-8', newline='\n')

report = ROOT / 'desktop/media-tools/PUBLIC-BETA-REVIEW-20261009.md'
text = baseline_text(report)
text = text.replace('**Public Beta readiness = BLOCKED** ไม่ได้ push, merge main, เปิด GitHub Release, upload public หรือ deploy หน้าโหลด',
                    '**Public Beta readiness = BLOCKED** ไม่มี public push, merge main, GitHub Release, public upload หรือ deploy หน้าโหลด; งาน docs/evidence รอบ 11 ตุลาคมอนุญาตให้เก็บที่ private-backup หลังตรวจ private destination')
latest_section = '''## Source follow-up ล่าสุด — 11 ตุลาคม 2026

**Gyan RESPONDED — user-provided email text / yt-dlp AWAITING RESPONSE.** คำตอบที่ผู้ใช้ให้ซ้ำสองชุดเก็บเพียงหนึ่งชุด; ไม่มี reply headers/timestamp หรือ independent authentication เวลา `2026-10-10 09:31 pm` เป็นคำขอ Yod ที่ถูก quote

ยืนยัน libxml2 `31094e5d0f65a528965e8c32a488e5a7f36118ca` จาก GNOME/libxml2 และ zlib-ng `9174ab6bf58ac9a518dbe197b948c897f74834f5` จาก zlib-ng/zlib-ng, compatibility ON และ downstream ใช้ lib นี้ตามคำตอบในบริบท Gyan FFmpeg; libxml2 ใช้ vanilla CMake ยืนยัน MSYS2 origin ของ bzip2/GnuTLS/libiconv/GMP เท่านั้น ยังไม่ยืนยันทุก flags/patches, exact recipe commit, GMP pkgrel หรือ graph ทั้งชุด ไม่ขยายคำตอบถึง yt-dlp

| ประเภท | ช่องว่างปัจจุบัน |
| --- | --- |
| A — necessary source/build inputs | source ของ 35 ใน 37 README external-library rows ยังไม่เก็บ (มี rubberband/vid.stab); necessary custom build/install controls และ actual transitive/modified sources ยังไม่ครบ; yt-dlp native/JS preferred-source และ necessary native controls ยังเปิด |
| B — audit/reproducibility | ephemeral logs/link maps/compiler snapshots เป็นหลักฐานเสริมโดยตัวมันเอง; หากมี indispensable input ภายในให้แยกเป็น A ไม่ต้อง rebuild ให้ SHA เหมือนทุกบิต และ GMP Hg metadata ไม่เป็น standalone blocker สำหรับ release-tarball route |
| C — ต้องตรวจ scope/selection | actual patch/config/link inclusion, exact MSYS2 recipe/architecture/GMP pkgrel และ runtime/System Library scope ยังไม่ชัด; package depends ไม่ได้แปลว่า linked ทุกตัว |

**FFmpeg source gate BLOCKED / INCOMPLETE; yt-dlp source gate BLOCKED / INCOMPLETE; Public Beta readiness BLOCKED. Portable taskbar PASS คงเดิม; normal taskbar visual, live Download/EJS, clean-machine installer และ signing/SmartScreen คง BLOCKED** ไม่มี runtime QA/rebuild หรือเปลี่ยน binaries/dependencies/vendor/version/shortcuts รอบนี้ ตรวจ official GPLv3 §1 และ GNU FAQ แล้ว: necessary control scripts ต้องมีตาม scope แต่ขาด logs ทุกไฟล์ไม่ใช่ automatic failure และ exact rebuilt hash ไม่ใช่ข้อกำหนด [GPLv3](https://www.gnu.org/licenses/gpl-3.0.html#section1), [GNU FAQ](https://www.gnu.org/licenses/gpl-faq.en.html#MustSourceBuildToMatchExactHashOfBinary)

ดู [หลักฐานและผลตรวจรอบสอง](evidence/gyan-followup-20261011/README.md), [inventory ล่าสุด](evidence/source-taskbar-20261009/SOURCE-INVENTORY.md), [closure plan](evidence/source-taskbar-20261009/SOURCE-CLOSURE-PLAN.md) และ [request tracking](evidence/source-requests-20261009/contact-verification.json) ร่างเก่าเก็บเป็นประวัติ; ไม่ส่ง email/issue ใหม่ Archived r2 kit/manifests คงเดิม งานนี้ commit เฉพาะ docs/evidence และใช้เฉพาะ verified private-backup; ผล push/commit จริงรายงานหลังตรวจ remote

'''
text = text.replace('## Source follow-up — 10 ตุลาคม 2026', latest_section + '## Source follow-up — 10 ตุลาคม 2026 (ประวัติ; superseded by 11 ตุลาคม)')
report.write_text(text, encoding='utf-8', newline='\n')

write_json(HERE / 'baseline.json', {'schema': 1, 'baselineHead': BASELINE,
    'branch': 'codex/source-taskbar-review-20261009', 'initialWorkingTree': 'CLEAN',
    'upstream': 'private-backup/codex/source-taskbar-review-20261009',
    'sourceInventoryBaselineSha256': hashlib.sha256(baseline_text(WORK / 'source-inventory.json').encode('utf-8')).hexdigest(),
    'preservedBinarySourceCommit': inv['binarySourceCommit'], 'vendorHashes': inv['vendorHashes'],
    'policy': 'Docs/evidence only; private-backup push authorized by attached user task instructions. No public origin push, force push, merge, release, deployment, runtime/binary/dependency/version changes or rebuild.'})

print('Applied dated docs-only review: 84 component rows, 42 retained source/build inputs, 8 re-reviewed sources; both source gates BLOCKED / INCOMPLETE.')
