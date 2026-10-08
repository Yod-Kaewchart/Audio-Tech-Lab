'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {verifyBrand,windowsVersion}=require('./windows-brand.cjs');
const sha256=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function inventory(dir){
 const rows=[];function visit(at){for(const e of fs.readdirSync(at,{withFileTypes:true})){const file=path.join(at,e.name),s=fs.lstatSync(file);if(s.isSymbolicLink()||(!s.isDirectory()&&!s.isFile()))throw Error('Indirect or unsupported payload file: '+file);if(s.isDirectory())visit(file);else rows.push({file:path.relative(dir,file).replaceAll('\\','/'),bytes:s.size,sha256:sha256(file)});}}visit(dir);return rows.sort((a,b)=>a.file.localeCompare(b.file,'en'));
}
function sameTree(source,packed,label){
 const live=inventory(source),built=inventory(packed);assert.deepEqual(built,live,'Portable is not synced to checked-out source: '+label+' (missing, extra, or checksum mismatch)');return live;
}
function packagedJson(pkg){const copy={...pkg};delete copy.scripts;delete copy.devDependencies;return copy;}
function verifyVendor(root,dir){
 const lock=JSON.parse(fs.readFileSync(path.join(root,'dependencies.lock.json'),'utf8'));
 for(const vendor of [path.join(root,'vendor'),path.join(dir,'resources/vendor')]){
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(vendor,'manifest.json'),'utf8')),lock,'Vendor manifest differs from trusted dependency lock');
  for(const tool of Object.values(lock.tools)){assert.equal(path.basename(tool.file),tool.file);assert.equal(sha256(path.join(vendor,tool.file)),tool.sha256,'Vendor checksum mismatch: '+tool.file);}
 }
 sameTree(path.join(root,'vendor'),path.join(dir,'resources/vendor'),'vendor including notices');return lock;
}
function verifyPayload(root,dir,{brandVerifier=verifyBrand}={}){
 const release=path.resolve(root,'release');dir=path.resolve(dir);if(!dir.startsWith(release+path.sep)||fs.lstatSync(dir).isSymbolicLink())throw Error('Invalid portable directory');
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')),app=path.join(dir,'resources/app');
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(app,'package.json'),'utf8')),packagedJson(pkg),'Portable package metadata/version differs from source');
 for(const name of ['src','ui'])sameTree(path.join(root,name),path.join(app,name),name);
 const expectedApp=['package.json',...['src','ui'].flatMap(name=>inventory(path.join(root,name)).map(r=>name+'/'+r.file))].sort();
 assert.deepEqual(inventory(app).map(r=>r.file).sort(),expectedApp,'Unexpected app payload');
 const deps=verifyVendor(root,dir);
 sameTree(path.join(root,'native'),path.join(dir,'notices/ProcessHost-source'),'helper source');
 for(const file of ['dependencies.lock.json','app-icon.ico'])assert.equal(sha256(path.join(dir,file)),sha256(path.join(root,file==='app-icon.ico'?'installer/assets/media-tools.ico':file)),file+' mismatch');
 assert.equal(sha256(path.join(app,'ui/assets/media-tools.ico')),sha256(path.join(root,'installer/assets/media-tools.ico')),'Window icon differs from EXE/installer');
 const runtime=inventory(path.join(root,'node_modules/electron/dist')).filter(r=>!['electron.exe','resources/default_app.asar'].includes(r.file));
 for(const e of runtime)assert.equal(sha256(path.join(dir,e.file)),e.sha256,'Electron runtime mismatch: '+e.file);
 const info=JSON.parse(fs.readFileSync(path.join(dir,'build-info.json'),'utf8'));assert.equal(info.version,pkg.version);assert.equal(info.windowsVersion,windowsVersion(pkg.version));assert.match(info.commit,/^[a-f0-9]{40}$/);assert.deepEqual(info.dependencies,deps);assert.equal(info.publicRelease,false);
 for(const name of ['USER-GUIDE.md','RELEASE-NOTES.md','THIRD-PARTY-NOTICES.md','RECOVERY.md'])assert.equal(sha256(path.join(dir,name)),sha256(path.join(root,'release-docs',name)),name+' mismatch');
 const hashes=inventory(dir).filter(r=>r.file!=='SHA256SUMS.json');assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,'SHA256SUMS.json'),'utf8')),hashes,'Portable inventory checksum mismatch');
 const expected=new Set(['build-info.json','SHA256SUMS.json','app-icon.ico','dependencies.lock.json','USER-GUIDE.md','RELEASE-NOTES.md','THIRD-PARTY-NOTICES.md','RECOVERY.md','Audio Tech Labs Media Tools.exe',...runtime.map(r=>r.file),...inventory(app).map(r=>'resources/app/'+r.file),...inventory(path.join(root,'vendor')).map(r=>'resources/vendor/'+r.file),...inventory(path.join(root,'native')).map(r=>'notices/ProcessHost-source/'+r.file)]);
 assert.deepEqual(inventory(dir).map(r=>r.file).sort(),[...expected].sort(),'Unapproved files in distribution (developer evidence, profile, logs or other data)');
 return {version:pkg.version,commit:info.commit,files:hashes.length,inventorySha256:sha256(path.join(dir,'SHA256SUMS.json')),branding:brandVerifier(path.join(dir,'Audio Tech Labs Media Tools.exe'),path.join(root,'installer/assets/media-tools.ico'),pkg)};
}
module.exports={inventory,sha256,packagedJson,verifyPayload,verifyVendor};
if(require.main===module){try{const root=path.resolve(__dirname,'..'),record=JSON.parse(fs.readFileSync(path.join(root,'release/latest.json'),'utf8'));console.log(JSON.stringify(verifyPayload(root,record.directory),null,2));}catch(e){console.error(e.stack);process.exitCode=1;}}
