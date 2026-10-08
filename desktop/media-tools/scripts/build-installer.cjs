'use strict';
// Internal Windows installer build. Does NOT publish or install the resulting executable.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),release=path.join(root,'release');
const {verifyPayload}=require('./verify-payload.cjs'),{windowsVersion}=require('./windows-brand.cjs');
const sha256=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function fail(message){throw Error(message);}
function main(){
 if(process.platform!=='win32')fail('Build requires Windows + Inno Setup');
 const test=process.argv.includes('--qa');
 if(process.argv.slice(2).some(arg=>arg!=='--qa'))fail('Only --qa is allowed');
 const record=JSON.parse(fs.readFileSync(path.join(release,'latest.json'),'utf8'));
 const dir=path.resolve(record.directory), exe=path.join(dir,'Audio Tech Labs Media Tools.exe');
 if(!dir.startsWith(release+path.sep)||!fs.statSync(dir).isDirectory()||record.executable!==exe||!fs.existsSync(exe))fail('Invalid or missing latest portable release');
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 // Fail closed before ISCC: all src/ui/fonts, version, vendor hashes, runtime,
 // icons, notices, full inventory and distribution allowlist.
 const verified=verifyPayload(root,dir);
 const icon=path.join(root,'installer','assets','media-tools.ico');
 if(!fs.existsSync(icon))fail('Missing installer icon. Run create-installer-icon.ps1');
 const compiler=process.env.INNO_ISCC||path.join(process.env.LOCALAPPDATA,'Programs','Inno Setup 6','ISCC.exe');
 if(!fs.existsSync(compiler))fail('Missing Inno Setup compiler: '+compiler);
 const destination=path.join(release,'installers');
 fs.mkdirSync(destination,{recursive:true});
 const filename='Audio-Tech-Labs-Media-Tools-Setup-'+pkg.version+'-Win64'+(test?'-QA':'')+'.exe';
 const output=path.join(destination,filename);if(fs.existsSync(output))fail('Refusing to overwrite an existing installer candidate');
 const args=['/Qp','/DSourceRoot='+dir,'/DOutputDir='+destination,'/DIconFile='+icon,'/DMyAppVersion='+pkg.version,'/DWindowsVersion='+windowsVersion(pkg.version)];
 if(test)args.push('/DTestBuild=1');
 args.push(path.join(root,'installer','media-tools.iss'));
 const result=cp.spawnSync(compiler,args,{cwd:root,windowsHide:true,encoding:'utf8',maxBuffer:4*1024*1024,timeout:10*60*1000});
 if(result.status!==0)fail('ISCC failed '+result.status+':\n'+(result.stdout||'')+'\n'+(result.stderr||'')+'\n'+(result.error?.message||''));
 if(!fs.existsSync(output))fail('Compiled installer missing at '+output);
 const stat=fs.statSync(output);
 if(stat.size<10*1024*1024)fail('Installer unexpectedly small');
 const manifest={kind:test?'internal-qa':'internal-candidate',version:pkg.version,commit:verified.commit,compilerVersion:'Inno Setup 6.7.3',sourcePortable:dir,portableSha256:record.sha256,payloadInventorySha256:verified.inventorySha256,file:output,bytes:stat.size,sha256:sha256(output),signed:false,publicRelease:false,producedAt:new Date().toISOString()};
 const outManifest=path.join(destination,test?'installer-qa.json':'installer-candidate.json');
 fs.writeFileSync(outManifest,JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify(manifest,null,2));
}
try{main()}catch(e){console.error(e.stack||e);process.exitCode=1}
