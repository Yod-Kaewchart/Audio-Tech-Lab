'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),cp=require('node:child_process');
const {inventory,sha256,packagedJson,verifyPayload}=require('./verify-payload.cjs'),{brand,windowsVersion}=require('./windows-brand.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 if(process.argv.slice(2).some(a=>!['--directory-only','--finalize'].includes(a)))throw Error('Unknown package option');
 if(process.argv.includes('--finalize'))return finalize(JSON.parse(await fs.readFile(path.join(root,'release/latest.json'),'utf8')));
 const pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')),deps=JSON.parse(await fs.readFile(path.join(root,'dependencies.lock.json'),'utf8'));
 const dirty=cp.execFileSync('git',['status','--porcelain','--','src','ui','package.json','package-lock.json','native','dependencies.lock.json','scripts','installer','release-docs','build-tools.lock.json'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();
 if(dirty)throw Error('Commit distribution source first; refusing to label a dirty payload with HEAD');
 const manifest=JSON.parse(await fs.readFile(path.join(root,'vendor/manifest.json'),'utf8'));require('node:assert/strict').deepEqual(manifest,deps);
 for(const tool of Object.values(deps.tools))if(sha256(path.join(root,'vendor',tool.file))!==tool.sha256)throw Error('Vendor checksum mismatch: '+tool.file);
 const commit=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();
 const tag='Media-Tools-'+pkg.version+'-win-x64-'+new Date().toISOString().replace(/[-:]/g,'').replace('.','').slice(0,18),out=path.join(root,'release',tag);
 await fs.mkdir(out,{recursive:false});await fs.cp(path.join(root,'node_modules/electron/dist'),out,{recursive:true,filter:p=>p!==path.join(root,'node_modules/electron/dist/resources/default_app.asar')});
 const exe=path.join(out,'Audio Tech Labs Media Tools.exe');await fs.rename(path.join(out,'electron.exe'),exe);const branding=brand(root,exe,pkg);
 const app=path.join(out,'resources/app');await fs.mkdir(app,{recursive:true});for(const dir of ['src','ui'])await fs.cp(path.join(root,dir),path.join(app,dir),{recursive:true});
 await fs.writeFile(path.join(app,'package.json'),JSON.stringify(packagedJson(pkg),null,2));await fs.cp(path.join(root,'vendor'),path.join(out,'resources/vendor'),{recursive:true});
 await fs.cp(path.join(root,'native'),path.join(out,'notices/ProcessHost-source'),{recursive:true});
 await fs.copyFile(path.join(root,'installer/assets/media-tools.ico'),path.join(out,'app-icon.ico'));await fs.copyFile(path.join(root,'dependencies.lock.json'),path.join(out,'dependencies.lock.json'));
 for(const file of ['USER-GUIDE.md','RELEASE-NOTES.md','THIRD-PARTY-NOTICES.md','RECOVERY.md'])await fs.copyFile(path.join(root,'release-docs',file),path.join(out,file));
 await fs.writeFile(path.join(out,'build-info.json'),JSON.stringify({version:pkg.version,windowsVersion:windowsVersion(pkg.version),commit,dependencies:deps,signed:false,publicRelease:false},null,2));
 await fs.writeFile(path.join(out,'SHA256SUMS.json'),JSON.stringify(inventory(out),null,2));
 const verified=verifyPayload(root,out),record={version:pkg.version,commit,directory:out,executable:exe,executableSha256:sha256(exe),archive:null,sha256:null,branding,verified,createdAt:new Date().toISOString()};
 await fs.writeFile(path.join(root,'release/latest.json'),JSON.stringify(record,null,2));
 if(!process.argv.includes('--directory-only'))await finalize(record);else console.log(JSON.stringify(record,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
async function finalize(record){
 const verified=verifyPayload(root,record.directory),zip=record.directory+'.zip';
 try{await fs.access(zip);throw Error('Archive already exists; build a new candidate instead');}catch(e){if(e.code!=='ENOENT')throw e;}
 cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'zip.ps1'),record.directory,zip],{windowsHide:true,stdio:'inherit'});
 Object.assign(record,{archive:zip,bytes:(await fs.stat(zip)).size,sha256:sha256(zip),verified});await fs.writeFile(path.join(root,'release/latest.json'),JSON.stringify(record,null,2));console.log(JSON.stringify(record,null,2));
}
