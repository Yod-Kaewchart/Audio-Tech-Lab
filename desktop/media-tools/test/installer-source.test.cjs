'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const iss=read('installer/media-tools.iss');
test('installer requires unprivileged Windows x64 and does not touch user profiles',()=>{
 assert.match(iss,/PrivilegesRequired=lowest/);
 assert.match(iss,/ArchitecturesAllowed=x64compatible/);
 assert.match(iss,/DefaultDirName=\{localappdata\}/);
 assert.doesNotMatch(iss,/\[UninstallDelete\]/);
 assert.doesNotMatch(iss,/\{userappdata\}|\{commonappdata\}|appdata\\local-media/i);
 assert.match(iss,/CloseApplications=no/);
});
test('QA has different AppId, folder, and shortcut names; both have uninstall and menu icons',()=>{
 assert.match(iss,/#ifdef TestBuild[\s\S]*?MyAppId "AudioTechLabs\.MediaTools\.InternalQA"/);
 assert.match(iss,/#else[\s\S]*?MyAppId "AudioTechLabs\.MediaTools"/);
 assert.match(iss,/Name: "\{autoprograms\}/);
 assert.match(iss,/Name: "\{autodesktop\}/);
 assert.match(iss,/Name: "desktopicon";[\s\S]*?Flags: unchecked/);
 assert.match(iss,/Uninstallable=yes/);
});
test('installer only includes verified portable, code, bundled dependencies and local icon',()=>{
 const build=read('scripts/build-installer.cjs');
 assert.ok(build.indexOf('const verified=verifyPayload(root,dir)')<build.indexOf('cp.spawnSync(compiler'),'payload validation precedes the installer compiler');
 assert.match(read('scripts/verify-payload.cjs'),/Vendor checksum mismatch/);
 assert.match(build,/publicRelease:false/);
 assert.match(iss,/Source: "\{#SourceRoot\}\\\*"/);
 assert.match(read('.gitignore'),/^release\/$/m);
 assert.ok(fs.statSync(path.join(root,'installer/assets/media-tools.ico')).size>1000);
});
test('QA uninstaller validates preserved profile and exact installed executable hashes',()=>{
 const q=read('scripts/test-installer.ps1');
 assert.match(q,/profile remained byte-for-byte unchanged/);
 assert.match(q,/Get-FileHash -LiteralPath \$a/);
 assert.match(q,/Get-FileHash -LiteralPath \$b/);
 assert.match(q,/Uninstall entry missing/);
 assert.match(q,/Shortcut target mismatch/);
 assert.match(q,/Start-Process -FilePath \$uninstaller/);
});
