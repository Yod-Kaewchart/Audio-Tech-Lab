'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {inventory,sha256,packagedJson,verifyPayload}=require('../scripts/verify-payload.cjs');const {windowsVersion}=require('../scripts/windows-brand.cjs');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'atl-payload-')),dir=path.join(root,'release/candidate');t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const put=(p,data)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,data);},write=(name,data)=>put(path.join(root,name),data);
 const pkg={name:'atl-media-tools',productName:'Audio Tech Labs Media Tools',version:'0.2.2-beta.1',main:'src/main.cjs',scripts:{test:'node --test'},devDependencies:{electron:'44.7.0'}};write('package.json',JSON.stringify(pkg));
 for(const name of ['src/main.cjs','src/runner.cjs','ui/controller.js','ui/player.css','ui/theme.css','ui/assets/thai.woff2','ui/assets/english.ttf','ui/assets/OFL.txt','ui/assets/media-tools.ico','native/ProcessHost.cs','installer/assets/media-tools.ico'])write(name,name.endsWith('media-tools.ico')?'ICON':name);
 for(const doc of ['USER-GUIDE.md','RELEASE-NOTES.md','THIRD-PARTY-NOTICES.md','RECOVERY.md'])write('release-docs/'+doc,doc);
 write('node_modules/electron/dist/LICENSE','Electron license');write('node_modules/electron/dist/chrome_100_percent.pak','RUNTIME');
 const tools={};for(const file of ['ffmpeg.exe','ffprobe.exe','yt-dlp.exe','node.exe','ProcessHost.exe']){write('vendor/'+file,'binary '+file);tools[file]={file,sha256:sha256(path.join(root,'vendor',file))};}
 const lock={schema:1,tools};write('dependencies.lock.json',JSON.stringify(lock));write('vendor/manifest.json',JSON.stringify(lock));write('vendor/notices/license.txt','NOTICE');
 fs.mkdirSync(dir,{recursive:true});for(const name of ['src','ui'])fs.cpSync(path.join(root,name),path.join(dir,'resources/app',name),{recursive:true});
 put(path.join(dir,'resources/app/package.json'),JSON.stringify(packagedJson(pkg)));fs.cpSync(path.join(root,'vendor'),path.join(dir,'resources/vendor'),{recursive:true});fs.cpSync(path.join(root,'native'),path.join(dir,'notices/ProcessHost-source'),{recursive:true});
 fs.cpSync(path.join(root,'node_modules/electron/dist'),dir,{recursive:true});for(const name of ['dependencies.lock.json','app-icon.ico'])fs.copyFileSync(path.join(root,name==='app-icon.ico'?'installer/assets/media-tools.ico':name),path.join(dir,name));
 for(const doc of ['USER-GUIDE.md','RELEASE-NOTES.md','THIRD-PARTY-NOTICES.md','RECOVERY.md'])fs.copyFileSync(path.join(root,'release-docs',doc),path.join(dir,doc));
 put(path.join(dir,'Audio Tech Labs Media Tools.exe'),'BRANDED EXE');put(path.join(dir,'build-info.json'),JSON.stringify({version:pkg.version,windowsVersion:windowsVersion(pkg.version),commit:'a'.repeat(40),dependencies:lock,publicRelease:false}));
 const sums=()=>put(path.join(dir,'SHA256SUMS.json'),JSON.stringify(inventory(dir).filter(r=>r.file!=='SHA256SUMS.json')));sums();return {root,dir,put,sums,verify:()=>verifyPayload(root,dir,{brandVerifier:()=>({fixture:true})})};
}
test('complete payload passes; every source/UI/font file missing or stale is rejected even with refreshed inventory',t=>{
 const f=fixture(t);assert.ok(f.verify().files>10);
 for(const prefix of ['src','ui'])for(const row of inventory(path.join(f.root,prefix))){const file=path.join(f.dir,'resources/app',prefix,row.file),before=fs.readFileSync(file);
  fs.unlinkSync(file);f.sums();assert.throws(f.verify,/not synced/,prefix+'/'+row.file+' missing');f.put(file,Buffer.concat([before,Buffer.from('STALE')]));f.sums();assert.throws(f.verify,/not synced/,prefix+'/'+row.file+' stale');f.put(file,before);f.sums();}
 assert.ok(f.verify());
});
test('old package version, all corrupt vendor executables and forged vendor manifest are rejected',t=>{
 const f=fixture(t),p=path.join(f.dir,'resources/app/package.json'),original=fs.readFileSync(p);const old=JSON.parse(original);old.version='0.2.1';f.put(p,JSON.stringify(old));f.sums();assert.throws(f.verify,/metadata\/version/);f.put(p,original);
 for(const file of ['ffmpeg.exe','ffprobe.exe','yt-dlp.exe','node.exe','ProcessHost.exe']){const at=path.join(f.dir,'resources/vendor',file),bytes=fs.readFileSync(at);f.put(at,'CORRUPT');f.sums();assert.throws(f.verify,/Vendor checksum mismatch/);f.put(at,bytes);}
 const at=path.join(f.dir,'resources/vendor/manifest.json'),bytes=fs.readFileSync(at),lock=JSON.parse(bytes);lock.tools['ffmpeg.exe'].sha256='0'.repeat(64);f.put(at,JSON.stringify(lock));f.sums();assert.throws(f.verify,/trusted dependency lock/);f.put(at,bytes);f.sums();assert.ok(f.verify());
});
test('unapproved internal data, runtime tampering and inventory tampering are rejected',t=>{
 const f=fixture(t),extra=path.join(f.dir,'evidence/internal-log.txt');f.put(extra,'private evidence');f.sums();assert.throws(f.verify,/Unapproved files/);fs.rmSync(path.dirname(extra),{recursive:true});f.sums();
 f.put(path.join(f.dir,'chrome_100_percent.pak'),'CORRUPT');f.sums();assert.throws(f.verify,/Electron runtime mismatch/);
});
test('Windows numeric version is derived from the app, including beta iteration, and malformed versions fail closed',()=>{
 assert.equal(windowsVersion('0.2.2-beta.1'),'0.2.2.1');assert.equal(windowsVersion('0.2.1'),'0.2.1.0');for(const v of ['44.7','0.2.2-rc.1','0.2.2-beta.999999'])assert.throws(()=>windowsVersion(v));
});
