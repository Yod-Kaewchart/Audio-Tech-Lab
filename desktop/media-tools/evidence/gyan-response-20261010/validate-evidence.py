"""Verify evidence integrity, inventory scope and original binary identities."""
import hashlib, json, pathlib, re, subprocess

OUT = pathlib.Path(__file__).resolve().parent
ROOT = OUT.parents[3]
MEDIA = OUT.parents[1]
read = lambda path: json.loads(path.read_text(encoding='utf-8-sig'))
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
def git(*args):
    return subprocess.check_output(['git','-c','core.quotepath=false',*args],cwd=ROOT).decode('utf8')

if __name__ == '__main__':
    previous = OUT/'validation.json'
    baseline = read(previous)['baselineHead'] if previous.exists() else git('rev-parse','HEAD').strip()
    assert re.fullmatch(r'[0-9a-f]{40}',baseline)
    inventory_path = OUT.parent/'source-taskbar-20261009/source-inventory.json'
    original = json.loads(git('show',baseline+':'+inventory_path.relative_to(ROOT).as_posix()))
    current = read(inventory_path)
    expected_names = {'FFmpeg external: '+name for name in ('fontconfig','iconv','gnutls','libxml2','gmp','bzlib/bzip2','lzma/xz','zlib')}
    changed_rows = [row['component'] for row,old in zip(current['components'],original['components']) if row!=old]
    assert set(changed_rows)==expected_names and len(current['components'])==len(original['components'])==84
    assert current['vendorHashes']==original['vendorHashes']
    assert current['status']=='BLOCKED' and current['completeCorrespondingSource'] is False
    assert all(row['correspondingSourceStatus']=='BLOCKED' for row in current['components'])
    hashes = {name:dict(expected=value,actual=sha(MEDIA/'vendor'/name)) for name,value in original['vendorHashes'].items()}
    assert all(item['actual']==item['expected'] for item in hashes.values())
    zip_file = MEDIA/'cache/ffmpeg-9.0.2-essentials.zip'
    assert sha(zip_file)=='60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba'
    archived = MEDIA/'release/source-review-0.2.2-beta.2-r2-INCOMPLETE'
    assert read(archived/'SOURCE-INVENTORY-INCOMPLETE.json')==original
    for item in original['sourceFiles']:
        assert sha(archived/item['file'])==item['sha256']
    old_contact = json.loads(git('show',baseline+':desktop/media-tools/evidence/source-requests-20261009/contact-verification.json'))
    contact = read(OUT.parent/'source-requests-20261009/contact-verification.json')
    assert next(item for item in contact['contacts'] if item['publisher']=='yt-dlp')==next(item for item in old_contact['contacts'] if item['publisher']=='yt-dlp')
    assert contact['contacts'][0]['responseStatus']=='RESPONDED — user-provided email text'
    assert sha(OUT/'gyan-user-provided-email.txt')==read(OUT/'response-coverage.json')['responseEvidence']['sha256']
    receipt_files = 0
    for item in read(OUT/'upstream-receipts.json')+read(OUT/'source-text-receipts.json'):
        if item.get('file'):
            assert sha(OUT/item['file'])==item['sha256'], item['file']
            assert (OUT/item['file']).stat().st_size==item['bytes']
            receipt_files+=1
    resolution = read(OUT/'upstream-resolution.json')
    assert len(resolution['rows'])==8 and resolution['fullGitCommitsResolved']==7
    for item in resolution['rows']:
        name=item['component']
        if name in ('libxml2','zlib-ng'):
            assert read(OUT/('upstream/'+name+'-commit.json'))['sha']==item['fullCommit']
        elif name!='gmp':
            assert item['fullCommit']+'\trefs/tags/'+item['tag']+'^{}' in read(OUT/('upstream/'+name+'-refs.json'))['stdout']
    assert read(OUT/'upstream/gnutls-native-refs.json')['stdout']==read(OUT/'upstream/gnutls-refs.json')['stdout']
    assert sum(item['sha256MatchesCandidateRecipe'] for item in resolution['rows'])==6
    assert all(not item['binaryBindingVerified'] and not item['publisherPatchUsageVerified'] for item in resolution['rows'])
    patches = read(OUT/'patch-checks.json')['results']
    assert len(patches)==14 and all(item['status'] in ('PASS','PASS WITH GNU PATCH') for item in patches)
    assert sum(item['status']=='PASS WITH GNU PATCH' for item in patches)==1
    failures = [item for item in read(OUT/'upstream-receipts.json') if item['status']=='FAILED']
    json_count=0
    for path in OUT.rglob('*.json'):
        if 'archives' not in path.relative_to(OUT).parts:
            read(path);json_count+=1
    tracked = git('diff','--name-only').splitlines()+git('diff','--cached','--name-only').splitlines()
    untracked = git('ls-files','--others','--exclude-standard').splitlines()
    allowed_files = {
        'desktop/media-tools/PUBLIC-BETA-REVIEW-20261009.md',
        'desktop/media-tools/evidence/source-requests-20261009/README-พี่ยอด.md',
        'desktop/media-tools/evidence/source-requests-20261009/GYAN-REQUEST-DRAFT.md',
        'desktop/media-tools/evidence/source-requests-20261009/contact-verification.json',
        'desktop/media-tools/evidence/source-taskbar-20261009/SOURCE-CLOSURE-PLAN.md',
        'desktop/media-tools/evidence/source-taskbar-20261009/SOURCE-INVENTORY.md',
        'desktop/media-tools/evidence/source-taskbar-20261009/source-inventory.json',
    }
    new_prefix=OUT.relative_to(ROOT).as_posix()+'/'
    assert all(path in allowed_files or path.startswith(new_prefix) for path in tracked+untracked)
    assert not any('/archives/' in path or '__pycache__' in path for path in untracked)
    subprocess.run(['git','diff','--check'],cwd=ROOT,check=True,capture_output=True)
    original_draft=git('show',baseline+':desktop/media-tools/evidence/source-requests-20261009/GYAN-REQUEST-DRAFT.md')
    current_draft=(OUT.parent/'source-requests-20261009/GYAN-REQUEST-DRAFT.md').read_text(encoding='utf8')
    body=lambda text:text.split('<!-- EMAIL BODY START -->')[1].split('<!-- EMAIL BODY END -->')[0]
    assert body(original_draft)==body(current_draft)
    output=dict(schema=1,status='PASS',reviewLocalDate='2026-10-10',timezone='Asia/Bangkok',baselineHead=baseline,
                componentRows=84,updatedRows=sorted(changed_rows),allOtherComponentRowsUnchanged=True,
                ytDlpContactUnchanged=True,originalRequestEmailBodyUnchanged=True,ytDlpResponse='AWAITING RESPONSE',sourceGate='BLOCKED / INCOMPLETE',
                binaryHashes=hashes,originalZipHashUnchanged=True,archivedR2InventoryAnd34InputsUnchanged=True,
                receiptFilesVerified=receipt_files,jsonFilesParsed=json_count,upstreamSourceArchives=8,
                fullGitCommitsResolved=7,gmpMercurialRevision='UNRESOLVED: HTTP 403; release archive pinned',
                releaseArchiveHashesMatchCandidateRecipes=6,patchChecks=14,gitApplyPass=13,gnuPatchPassWithFuzz=1,
                publisherPatchUsageVerified=False,gpgSignaturesVerified=False,failedRequestsPreserved=failures,
                docsEvidenceScopeOnly=True,diffCheck='PASS',followupEmail='DRAFT — NOT SENT',
                binariesChanged=False,rebuildPerformed=False,pushPerformed=False,publishPerformed=False)
    validation=OUT/'validation.json'
    validation.write_text(json.dumps(output,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
    broken=[]; links=0
    for path in [OUT/'README.md',OUT/'GYAN-FOLLOWUP-DRAFT.md',OUT.parent/'source-requests-20261009/README-พี่ยอด.md',OUT.parent/'source-taskbar-20261009/SOURCE-CLOSURE-PLAN.md',MEDIA/'PUBLIC-BETA-REVIEW-20261009.md']:
        for target in re.findall(r'\]\(([^)]+)\)',path.read_text(encoding='utf8')):
            if re.match(r'^[a-zA-Z]+:',target) or target.startswith('#'):
                continue
            target=target.split('#')[0]
            if target:
                links+=1
                if not (path.parent/target).exists():
                    broken.append(dict(file=path.relative_to(ROOT).as_posix(),target=target))
    assert not broken,broken
    output['localLinksVerified']=links
    validation.write_text(json.dumps(output,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
    print(json.dumps({key:output[key] for key in ('status','receiptFilesVerified','localLinksVerified','fullGitCommitsResolved','patchChecks','sourceGate','docsEvidenceScopeOnly')},ensure_ascii=False))
