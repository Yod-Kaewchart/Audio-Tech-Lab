'use strict';
// Assemble a private review folder. No hosting, network writes or publication.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {sha256}=require('./verify-payload.cjs');
const root=path.resolve(__dirname,'..'),evidence=path.join(root,'evidence/public-beta'),read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const portable=read(path.join(root,'release/latest.json')),setup=read(path.join(root,'release/installers/installer-candidate.json')),pkg=read(path.join(root,'package.json'));
const normal=read(path.join(evidence,'normal-installer.json')),theme=read(path.join(evidence,'portable.json')),installed=read(path.join(evidence,'normal-installed.json'));
assert.equal(portable.version,pkg.version);assert.equal(setup.version,pkg.version);assert.equal(setup.commit,portable.commit);assert.equal(setup.portableSha256,portable.sha256);
assert.equal(normal.status,'PASS');assert.equal(normal.installerSha256,setup.sha256);assert.equal(normal.portableSha256,portable.sha256);assert.equal(theme.passed,true);assert.equal(installed.passed,true);assert.equal(theme.runtime.appVersion,pkg.version);assert.equal(installed.runtime.appVersion,pkg.version);
assert.equal(read(path.join(evidence,'development-regressions.json')).passed,true);assert.equal(read(path.join(evidence,'portable-regressions.json')).passed,true);assert.equal(read(path.join(evidence,'installer-rejection.json')).installerSha256,setup.sha256);
const source=read(path.join(evidence,'source-artifact.json'));
const artifacts=[{role:'Setup',from:setup.file,sha256:setup.sha256},{role:'Portable',from:portable.archive,sha256:portable.sha256},{role:'Source review INCOMPLETE',from:source.file,sha256:source.sha256}].map(r=>{assert.equal(sha256(r.from),r.sha256);return {...r,file:path.basename(r.from),bytes:fs.statSync(r.from).size};});
const lock=read(path.join(root,'dependencies.lock.json'));
const checks=[
 {item:'Checkpoint + original hashes',status:'PASS',evidence:'checkpoint.json'},
 {item:'Folder recovery / concurrent inspection / restart / no new work',status:'PASS',evidence:'unit.log, folder-recovery-ui.json'},
 {item:'Installer payload validation + real missing/corrupt font and FFmpeg rejection',status:'PASS',evidence:'payload-validation.json, installer-rejection.json, stale-0.2.1-rejection.json'},
 {item:'EXE/setup name/version/icon, window pixels, shortcuts/uninstall icon and AppUserModelID',status:'PASS',evidence:'setup-branding.json, windows-icon.json, native-window.png, normal-installer.json'},
 {item:'Actual taskbar visual',status:'BLOCKED',reason:'Supported native window inventory did not expose taskbar; AppUserModelID and shortcut association verified separately.'},
 {item:'YouTube inspect/Original/MP3/lossless/cancel/network loss/retry/live EJS',status:'BLOCKED',reason:'User confirmed there is no owner-authorized test URL. No mock/Convert substitute accepted.'},
 {item:'Dependency notices / fonts bundled offline',status:'PASS',evidence:'payload-validation.json, portable.json, normal-installed.json'},
 {item:'Complete FFmpeg/yt-dlp corresponding source',status:'BLOCKED',reason:'Upstream sources/notices collected; exact external dependency sources/patches/build scripts and bundled GPL components not fully verified.',evidence:'source-review.json'},
 {item:'Normal installer fresh/0.2.1 upgrade/uninstall/reinstall on this existing Windows',status:'PASS',evidence:'normal-installer.json'},
 {item:'Normal installer on a clean Windows machine',status:'BLOCKED',reason:'User confirmed no clean machine/VM access.'},
 {item:'User profile, external audio fixture, original desktop shortcut preserved',status:'PASS',evidence:'normal-installer.json, desktop-shortcut-preservation.json'},
 {item:'Code signing / SmartScreen',status:'BLOCKED',reason:'User confirmed no authorized certificate/signing service; candidate unsigned. Reputation/download-origin SmartScreen not tested.'},
 {item:'Local Defender scan',status:'PASS',evidence:'defender-setup.json, defender-portable.json and raw scan logs; no threats for these hashes with installed signatures.'},
 {item:'Source and extracted portable Convert/Player/continuous playback + min/normal Thai UI',status:'PASS',evidence:'development-regressions.json, portable-regressions.json, portable.json, normal-installed.json'},
 {item:'Runtime payload contains no developer evidence/logs/profiles',status:'PASS',evidence:'payload-validation.json, package-content-scan.json; 129 inventory entries plus SHA256SUMS.json itself (130 files)'},
 {item:'Local-only download preview / guides / review artifacts',status:'PASS',evidence:'download-preview.json'}
];
const manifest={schema:1,version:pkg.version,windowsVersion:portable.branding.versionInfo.FileVersion,appSourceCommit:portable.commit,installerSourceCommit:setup.installerSourceCommit,target:'win32-x64',signed:false,publicRelease:false,releaseReadiness:'BLOCKED',artifacts:artifacts.map(({from,...r})=>r),payloadInventorySha256:portable.verified.inventorySha256,appExeSha256:portable.executableSha256,dependencies:{electron:pkg.devDependencies.electron,embeddedRuntime:theme.runtime.versions,vendor:lock.tools,lockSha256:sha256(path.join(root,'dependencies.lock.json'))},checks};
fs.writeFileSync(path.join(evidence,'release-manifest.json'),JSON.stringify(manifest,null,2));
const kit=path.join(root,'release','review-'+pkg.version+'-'+setup.sha256.slice(0,12));fs.mkdirSync(kit,{recursive:false});
for(const r of artifacts)fs.copyFileSync(r.from,path.join(kit,r.file));
fs.cpSync(path.join(root,'release-docs'),path.join(kit,'docs'),{recursive:true});
fs.mkdirSync(path.join(kit,'ui/assets'),{recursive:true});fs.copyFileSync(path.join(root,'ui/theme.css'),path.join(kit,'ui/theme.css'));
for(const name of fs.readdirSync(path.join(root,'ui/assets')))if(/\.(?:woff2|ttf)$|OFL\.txt$/.test(name))fs.copyFileSync(path.join(root,'ui/assets',name),path.join(kit,'ui/assets',name));
fs.copyFileSync(path.join(evidence,'release-manifest.json'),path.join(kit,'release-manifest.json'));
// QA contains local paths/logs. Keep it in the explicitly private review kit,
// never in Setup/Portable. Do not copy the user's profile snapshot or contents.
fs.cpSync(evidence,path.join(kit,'evidence/public-beta'),{recursive:true,filter:p=>path.basename(p)!=='review-kit.json'});
fs.copyFileSync(path.join(root,'PUBLIC-BETA-REVIEW-20261009.md'),path.join(kit,'REVIEW-REPORT.md'));
fs.writeFileSync(path.join(kit,'README.txt'),'PRIVATE REVIEW ONLY — NOT APPROVED FOR PUBLIC DISTRIBUTION\r\nCandidate is unsigned. See release-manifest.json and REVIEW-REPORT.md for BLOCKED gates.\r\nSource review archive is INCOMPLETE and is not complete corresponding source.\r\nNo upload/deployment/publication has been performed.\r\n');
for(const r of artifacts)assert.equal(sha256(path.join(kit,r.file)),r.sha256);
fs.writeFileSync(path.join(evidence,'review-kit.json'),JSON.stringify({directory:kit,manifestSha256:sha256(path.join(kit,'release-manifest.json')),version:pkg.version,signed:false,publicRelease:false,artifacts:manifest.artifacts},null,2));
console.log(JSON.stringify({directory:kit,artifacts:manifest.artifacts,releaseReadiness:'BLOCKED'},null,2));
