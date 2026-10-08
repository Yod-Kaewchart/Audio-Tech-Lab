'use strict';
// Internal Windows installer build. Does NOT publish or install the resulting executable.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),release=path.join(root,'release');
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
 for(const name of ['src/main.cjs','src/engine.cjs','src/common.cjs','src/preload.cjs','ui/controller.js','ui/view.js','ui/media-tools.css']){
  const live=path.join(root,name),packed=path.join(dir,'resources','app',name);
  if(!fs.existsSync(packed)||sha256(live)!==sha256(packed))fail('Portable is not synced to checked-out source: '+name);
 }
 for(const name of ['ffmpeg.exe','ffprobe.exe','yt-dlp.exe','node.exe','ProcessHost.exe','manifest.json']){
  if(!fs.existsSync(path.join(dir,'resources','vendor',name)))fail('Portable dependency missing: '+name);
 }
 const icon=path.join(root,'installer','assets','media-tools.ico');
 if(!fs.existsSync(icon))fail('Missing installer icon. Run create-installer-icon.ps1');
 const compiler=process.env.INNO_ISCC||path.join(process.env.LOCALAPPDATA,'Programs','Inno Setup 6','ISCC.exe');
 if(!fs.existsSync(compiler))fail('Missing Inno Setup compiler: '+compiler);
 const destination=path.join(release,'installers');
 fs.mkdirSync(destination,{recursive:true});
 const args=['/Qp','/DSourceRoot='+dir,'/DOutputDir='+destination,'/DIconFile='+icon,'/DMyAppVersion='+pkg.version];
 if(test)args.push('/DTestBuild=1');
 args.push(path.join(root,'installer','media-tools.iss'));
 const result=cp.spawnSync(compiler,args,{cwd:root,windowsHide:true,encoding:'utf8',maxBuffer:4*1024*1024,timeout:10*60*1000});
 if(result.status!==0)fail('ISCC failed '+result.status+':\n'+(result.stdout||'')+'\n'+(result.stderr||'')+'\n'+(result.error?.message||''));
 const filename='Audio-Tech-Labs-Media-Tools-Setup-'+pkg.version+'-Win64'+(test?'-QA':'')+'.exe';
 const output=path.join(destination,filename);
 if(!fs.existsSync(output))fail('Compiled installer missing at '+output);
 const stat=fs.statSync(output);
 if(stat.size<10*1024*1024)fail('Installer unexpectedly small');
 const manifest={kind:test?'internal-qa':'internal-candidate',version:pkg.version,compilerVersion:'Inno Setup 6.7.3',sourcePortable:dir,file:output,bytes:stat.size,sha256:sha256(output),signed:false,publicRelease:false,producedAt:new Date().toISOString()};
 const outManifest=path.join(destination,test?'installer-qa.json':'installer-candidate.json');
 fs.writeFileSync(outManifest,JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify(manifest,null,2));
}
try{main()}catch(e){console.error(e.stack||e);process.exitCode=1}
