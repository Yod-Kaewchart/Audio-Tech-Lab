const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
(async()=>{
 if(process.argv.includes('--finalize')){
  const record=JSON.parse(await fs.readFile(path.join(root,'release/latest.json'),'utf8'));
  await finalize(record);return;
 }
 const manifest=JSON.parse(await fs.readFile(path.join(root,'vendor/manifest.json'),'utf8'));
 const {Dependencies}=require('../src/dependencies.cjs');const deps=await new Dependencies(path.join(root,'vendor')).load();for(const name of Object.keys(manifest.tools))await deps.verify(name);
 const version=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version;
 const tag='Media-Tools-'+version+'-win-x64-'+new Date().toISOString().replace(/[-:]/g,'').slice(0,15);
 const out=path.join(root,'release',tag);await fs.mkdir(out,{recursive:true});
 await fs.cp(path.join(root,'node_modules/electron/dist'),out,{recursive:true});await fs.rename(path.join(out,'electron.exe'),path.join(out,'Audio Tech Labs Media Tools.exe'));
 const app=path.join(out,'resources/app');await fs.mkdir(app,{recursive:true});for(const dir of ['src','ui'])await fs.cp(path.join(root,dir),path.join(app,dir),{recursive:true});
 const pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));delete pkg.devDependencies;delete pkg.scripts;await fs.writeFile(path.join(app,'package.json'),JSON.stringify(pkg,null,2));
 await fs.cp(path.join(root,'vendor'),path.join(out,'resources/vendor'),{recursive:true});
 // Preserve all publisher notices, helper source, exact dependency manifest and user's local fonts.
 await fs.cp(path.join(root,'native'),path.join(out,'notices/ProcessHost-source'),{recursive:true});
 for(const file of ['README.md','DEPENDENCIES.md','ACCEPTANCE-REPORT.md']){try{await fs.copyFile(path.join(root,file),path.join(out,file));}catch{}}
 const record={directory:out,executable:path.join(out,'Audio Tech Labs Media Tools.exe'),archive:null,sha256:null,createdAt:new Date().toISOString()};await fs.writeFile(path.join(root,'release/latest.json'),JSON.stringify(record,null,2));
 if(!process.argv.includes('--directory-only'))await finalize(record);else console.log(JSON.stringify(record,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
async function finalize(record){
 const out=record.directory;if(!out.startsWith(path.join(root,'release')+path.sep))throw Error('Invalid package path');
 for(const file of ['README.md','DEPENDENCIES.md','ACCEPTANCE-REPORT.md'])await fs.copyFile(path.join(root,file),path.join(out,file));
 await fs.copyFile(path.join(root,'dependencies.lock.json'),path.join(out,'dependencies.lock.json'));
 await fs.cp(path.join(root,'evidence'),path.join(out,'evidence'),{recursive:true});
 const hashes=[];async function inventory(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())await inventory(file);else if(e.name!=='SHA256SUMS.json')hashes.push({file:path.relative(out,file).replaceAll('\\','/'),sha256:crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex')});}}await inventory(out);await fs.writeFile(path.join(out,'SHA256SUMS.json'),JSON.stringify(hashes,null,2));
 const zip=out+'.zip';execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'zip.ps1'),out,zip],{windowsHide:true,stdio:'inherit'});
 Object.assign(record,{archive:zip,sha256:crypto.createHash('sha256').update(await fs.readFile(zip)).digest('hex')});await fs.writeFile(path.join(root,'release/latest.json'),JSON.stringify(record,null,2));console.log(JSON.stringify(record,null,2));
}
