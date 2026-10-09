"""Evidence consistency checks; no audio/network/build or user-state mutation."""
import ast,hashlib,json,pathlib,subprocess,zipfile
out=pathlib.Path(__file__).resolve().parent;root=out.parents[1]
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
checks=[]
for row in read(out/'baseline-artifact-hashes.json'):
    p=pathlib.Path(row['path']);assert sha(p)==row['sha256'];assert p.stat().st_size==row['bytes']
checks.append('All six original/copy Setup/Portable/prior-source identities unchanged')
lock=read(root/'dependencies.lock.json')
for r in lock['tools'].values():assert sha(root/'vendor'/r['file'])==r['sha256']
assert sha(root/'dependencies.lock.json')=='db7152bdfe328dee09931d3fd5c5f3ca6ddc40985bb9d9695285ae784dc91903'
checks.append('All vendor hashes and dependency lock unchanged')
i=read(out/'source-inventory.json');assert i['status']=='BLOCKED' and i['label']=='INCOMPLETE' and not i['completeCorrespondingSource']
assert len(i['components'])==84
assert len(i['sourceFiles'])==34
for r in i['components']:
    assert r['correspondingSourceStatus']=='BLOCKED';assert r['missing'] and r['closure']
source=root/'release/source-review-0.2.2-beta.2-r2-INCOMPLETE'
for r in i['sourceFiles']:assert sha(source/r['file'])==r['sha256']
checks.append('84 component rows / 34 source-build input files, gaps and publisher SHA mapping')
for name in ('publisher-receipts.json','exact-input-receipts.json','recipe-input-receipts.json','build-provenance-receipts.json','js-native-receipts.json'):
    data=read(out/name);receipts=data['files'] if isinstance(data,dict) else data
    for r in receipts:
        if r['status']!='PASS':continue
        p=(out if r['file'].startswith('publisher/') else source)/r['file']
        assert sha(p)==r['sha256'];assert p.stat().st_size==r['bytes']
        if r.get('publisherSha256'):assert r['publisherSha256']==r['sha256']
checks.append('Every successfully fetched publisher document/archive receipt matches saved bytes')
assert read(out/'curl-native-binding.json')['matched']
for kind in ('normal-installed','portable'):
    r=read(out/(kind+'-single-instance.json'));assert r['status']=='PASS';assert r['taskbarVisual']=='BLOCKED';assert r['second']['code']==0
    assert r['before']['pid']==r['after']['pid'];assert r['after']['windows'][0]['focused'];assert len(r['after']['windows'])==1
for kind in ('normal','portable'):assert not read(out/(kind+'-supported-windows.json'))['taskbarExposed']
clean=read(out/'normal-cleanup.json');assert clean['status']=='PASS' and clean['desktopPreserved'] and clean['profileUnchanged'] and clean['normalInstallationRemoved']
checks.append('Real installed/Portable single-instance evidence consistent; visual BLOCKED; user state preserved')
for p in out.rglob('*.json'):read(p)
for p in out.glob('*.py'):ast.parse(p.read_text(encoding='utf8'),filename=str(p))
checks.append('All JSON and local Python helper syntax')
a=read(out/'source-artifact-r2.json');assert sha(pathlib.Path(a['file']))==a['sha256']
with zipfile.ZipFile(a['file']) as z:
    assert z.testzip() is None
    for row in read(source/'SHA256SUMS.json'):
        data=z.read(source.name+'/'+row['file']);assert len(data)==row['bytes'];assert hashlib.sha256(data).hexdigest()==row['sha256']
    assert not any('TASKBAR' in n or n.endswith('.png') or 'profile' in n.lower() for n in z.namelist())
checks.append('New source-review ZIP CRC/every-file SHA256; no workstation QA/screenshots/profile')
diff=subprocess.check_output(['git','-c','core.quotepath=false','diff','--name-only','d701c1a'],cwd=root,text=True,encoding='utf8').splitlines()
allowed=('desktop/media-tools/evidence/source-taskbar-20261009/','desktop/media-tools/evidence/public-beta/','desktop/media-tools/PUBLIC-BETA-REVIEW-20261009.md')
assert all(p.startswith(allowed) for p in diff),diff
checks.append('Tracked diff confined to report/evidence; no app/UI/version/dependency edits')
result=dict(status='PASS',checks=checks,audioRegression='not rerun: no runtime source/payload changes',sourceGate='BLOCKED',taskbarVisual='BLOCKED',appVersion='0.2.2-beta.2',appSourceCommit='df183f4970366597d539323760108dbaf234e049')
(out/'checks.json').write_text(json.dumps(result,indent=2),encoding='utf8');print(json.dumps(result,indent=2))
