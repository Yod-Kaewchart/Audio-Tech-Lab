"""Create a NEW private source-review archive; never overwrite accepted artifacts."""
import hashlib,json,pathlib,shutil,zipfile
out=pathlib.Path(__file__).resolve().parent;root=out.parents[1]
source=root/'release/source-review-0.2.2-beta.2-r2-INCOMPLETE'
archive=root/'release/Audio-Tech-Labs-Media-Tools-Source-Review-0.2.2-beta.2-r2-INCOMPLETE.zip'
assert not archive.exists(),'Refusing overwrite'
for name in ('SOURCE-INVENTORY.md','SOURCE-CLOSURE-PLAN.md'):
    shutil.copyfile(out/name,source/name)
for name in ('yt-dlp-recipe','pyinstaller-custom-recipe','curl-impersonate-recipe','source-text'):
    shutil.copytree(out/name,source/'recipe-and-notices'/name,dirs_exist_ok=False)
(source/'README.txt').write_text('PRIVATE SOURCE REVIEW r2 — INCOMPLETE — NOT FOR PUBLIC DISTRIBUTION\nCandidate 0.2.2-beta.2 remains unsigned and unchanged.\nThis set is not complete corresponding source. See SOURCE-INVENTORY-INCOMPLETE.json and SOURCE-CLOSURE-PLAN.md.\narchives/baseline contain source/notices. build-inputs contains publisher wheels retained as provenance evidence, not vendor replacements.\nWorkstation QA logs/screenshots/profiles are not included; they belong in the private review kit.\nNo toolchain was installed or source built in this round.\n',encoding='utf8')
files=[]
for p in sorted(source.rglob('*')):
    if p.is_file():files.append(dict(file=p.relative_to(source).as_posix(),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
(source/'SHA256SUMS.json').write_text(json.dumps(files,indent=2),encoding='utf8')
with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in sorted(source.rglob('*')):
        if p.is_file():z.write(p,p.relative_to(source.parent).as_posix())
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for row in files:
        data=z.read(source.name+'/'+row['file']);assert len(data)==row['bytes'];assert hashlib.sha256(data).hexdigest()==row['sha256']
receipt=dict(file=str(archive),directory=str(source),bytes=archive.stat().st_size,sha256=hashlib.sha256(archive.read_bytes()).hexdigest(),label='INCOMPLETE',completeCorrespondingSource=False,status='BLOCKED',inventorySha256=hashlib.sha256((out/'source-inventory.json').read_bytes()).hexdigest(),files=len(files)+1,scope='NEW private source-review provenance collection; not a user runtime package',retainedPriorArchive='Audio-Tech-Labs-Media-Tools-Source-Review-0.2.2-beta.2-INCOMPLETE.zip')
(out/'source-artifact-r2.json').write_text(json.dumps(receipt,indent=2),encoding='utf8');print(json.dumps(receipt,indent=2))
