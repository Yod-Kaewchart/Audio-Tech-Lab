'use strict';
// CI has no access to the separately installed EliteBook audio core.
// Run the full suite on EliteBook: node --test server/*.test.cjs tools/*.test.cjs
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const native=new Set(['server/security.test.cjs','tools/backend-e2e.test.cjs','tools/backend-estimate.test.cjs']);
const files=['server','tools'].flatMap(dir=>fs.readdirSync(path.join(__dirname,'..',dir)).filter(f=>f.endsWith('.test.cjs')).map(f=>dir+'/'+f)).filter(f=>!native.has(f));
console.log('Portable suite; external audio-core suites run separately on EliteBook:',[...native].join(', '));
const result=spawnSync(process.execPath,['--test',...files],{cwd:path.resolve(__dirname,'..'),stdio:'inherit',windowsHide:true});
process.exitCode=result.status??1;
