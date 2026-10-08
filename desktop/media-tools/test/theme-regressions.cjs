'use strict';
// Run existing acceptance tests unchanged and preserve their previous evidence files.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/home-theme'),packaged=!!process.env.ATL_PLAYER_EXE;
fs.mkdirSync(out,{recursive:true});const record=path.join(out,(packaged?'portable':'development')+'-regressions.json');
const results=process.argv.includes('--resume')&&fs.existsSync(record)?JSON.parse(fs.readFileSync(record,'utf8')).results.filter(r=>r.passed):[];
const run=(name,exe,args,env={},preserve=[])=>{
 if(results.some(r=>r.name===name)){console.log('RECORDED PASS '+name);return;}
 const originals=preserve.map(f=>({file:path.join(root,f),bytes:fs.existsSync(path.join(root,f))?fs.readFileSync(path.join(root,f)):null}));
 const at=new Date().toISOString(),start=Date.now();let result;
 try{
  const childEnv=Object.fromEntries(Object.entries({...process.env,...env}).filter(([_k,v])=>v!==undefined));
  result=cp.spawnSync(exe,args,{cwd:root,env:childEnv,windowsHide:true,encoding:'utf8',timeout:240000,maxBuffer:4*1024*1024});
  fs.writeFileSync(path.join(out,name+'.log'),(result.stdout||'')+(result.stderr||'')+(result.error?.stack||''));
  const paths=[...new Set((result.stdout||'').match(/D:\\Sites\\Audio Tech Labs\\desktop\\media-tools\\test-output\\[^\r\n]+/g)||[])];
  for(let i=0;i<paths.length;i++){const file=path.join(paths[i],'results.json');if(fs.existsSync(file))fs.copyFileSync(file,path.join(out,name+(paths.length>1?'-'+i:'')+'.results.json'));}
  for(const {file,bytes} of originals)if(fs.existsSync(file)&&(!bytes||!fs.readFileSync(file).equals(bytes)))fs.copyFileSync(file,path.join(out,name+'-'+path.basename(file)));
 }finally{for(const {file,bytes} of originals){if(bytes)fs.writeFileSync(file,bytes);else if(fs.existsSync(file))fs.unlinkSync(file);}}
 const row={name,at,ms:Date.now()-start,exitCode:result.status,passed:result.status===0&&!result.error};results.push(row);
 fs.writeFileSync(path.join(out,(packaged?'portable':'development')+'-regressions.json'),JSON.stringify({passed:results.every(r=>r.passed),packaged,results},null,2));
 console.log((row.passed?'PASS ':'FAIL ')+name+' '+row.ms+'ms');assert.equal(row.passed,true,result.stderr||result.stdout);
};
if(!packaged){
 run('unit',process.execPath,['--test','test/*.test.cjs']);
 run('media-matrix',process.execPath,['test/acceptance.cjs']);
 run('ui-convert',process.execPath,['test/ui-acceptance.cjs'],{},['evidence/ui-acceptance.json']);
 const electron=path.join(root,'node_modules/electron/dist/electron.exe');
 run('filename-ui',electron,['test/filename-electron.cjs'],{ELECTRON_RUN_AS_NODE:undefined});
 for(const mode of ['download','convert'])run('reset-'+mode,electron,['test/reset-forms-electron.cjs'],{ELECTRON_RUN_AS_NODE:undefined,ATL_RESET_PAGE:mode});
 run('format-development',process.execPath,['test/format-selection-ui.cjs'],{},['evidence/format-selection-development.json']);
}
const kind=packaged?'portable':'development';
run('player-'+kind,process.execPath,['test/player-acceptance.cjs']);
run('continuity-'+kind,process.execPath,['test/continuous-playback.cjs']);
if(packaged){
 run('format-portable',process.execPath,['test/format-selection-ui.cjs'],{ATL_FORMAT_EXE:process.env.ATL_PLAYER_EXE},['evidence/format-selection-portable.json']);
 run('smoke-portable',process.execPath,['test/portable-smoke.cjs'],{},['evidence/portable-smoke.json','evidence/portable-download-360.png','evidence/portable-convert-360.png']);
}
