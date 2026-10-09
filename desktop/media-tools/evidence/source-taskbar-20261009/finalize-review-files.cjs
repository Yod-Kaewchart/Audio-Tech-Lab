'use strict';
// Sync final documentation/receipts into the new kit only; accepted artifacts untouched.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),evidence=path.join(root,'evidence/public-beta'),read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')),write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n'),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const kit=path.join(root,'release/review-0.2.2-beta.2-r2-11549c34e61f');assert(fs.existsSync(kit));
const manifest=read(path.join(evidence,'release-manifest.json'));manifest.inheritedEvidenceDirectory='private-evidence/public-beta';manifest.currentEvidenceDirectory='private-evidence/source-taskbar-20261009';
write(path.join(evidence,'release-manifest.json'),manifest);write(path.join(evidence,'source-artifact.json'),read(path.join(__dirname,'source-artifact-r2.json')));
const receipt=read(path.join(evidence,'review-kit.json'));receipt.manifestSha256=sha(path.join(evidence,'release-manifest.json'));write(path.join(evidence,'review-kit.json'),receipt);write(path.join(__dirname,'review-kit-r2.json'),receipt);
fs.copyFileSync(path.join(evidence,'release-manifest.json'),path.join(kit,'release-manifest.json'));fs.copyFileSync(path.join(root,'PUBLIC-BETA-REVIEW-20261009.md'),path.join(kit,'REVIEW-REPORT.md'));
fs.cpSync(evidence,path.join(kit,'private-evidence/public-beta'),{recursive:true,filter:p=>path.basename(p)!=='review-kit.json'});fs.cpSync(__dirname,path.join(kit,'private-evidence/source-taskbar-20261009'),{recursive:true});
assert.equal(sha(path.join(kit,'release-manifest.json')),receipt.manifestSha256);
for(const r of manifest.artifacts){const p=path.join(kit,r.path);assert.equal(sha(p),r.sha256);assert.equal(fs.statSync(p).size,r.bytes);}
const blockers=manifest.checks.filter(r=>r.status==='BLOCKED').map(r=>r.item);assert.equal(blockers.length,5);
assert.equal(manifest.sourceGate.completeCorrespondingSource,false);assert.equal(manifest.reviewCommit,'0351649cbb5b5152bb1edc9c040ac816ecdf49a3');assert.equal(manifest.appSourceCommit,'df183f4970366597d539323760108dbaf234e049');
const result={status:'PASS',manifestSha256:receipt.manifestSha256,artifactsVerified:manifest.artifacts,sourceBuildCommit:manifest.appSourceCommit,reviewEvidenceCommit:manifest.reviewCommit,blocked:blockers,scope:'Private review assembly integrity only; no audio regression rerun; old accepted artifacts unchanged'};
write(path.join(__dirname,'review-kit-checks.json'),result);write(path.join(kit,'private-evidence/source-taskbar-20261009/review-kit-checks.json'),result);console.log(JSON.stringify(result,null,2));
