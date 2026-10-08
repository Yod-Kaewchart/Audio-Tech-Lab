'use strict';
// Explicit refresh only, never part of an offline build. Use the inspected Public CSS.
const {chromium}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
(async()=>{
 const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/home-theme'),css=await fs.readFile(path.join(out,'public-fonts.css'),'utf8');
 const faces=[...new Set([...css.matchAll(/@font-face\s*\{[\s\S]*?\}/g)].map(m=>m[0].replace(/font-weight: \d+;/,'font-weight: 400 700;')))];
 if(faces.length!==5)throw Error('Expected five inspected Home font subsets; review a changed Public font baseline');
 const browser=await chromium.launch({channel:'chrome',headless:true}),manifest=[];
 try{
  const context=await browser.newContext();
  for(let face of faces){
   const url=/src: url\(([^)]+)\)/.exec(face)[1],u=new URL(url);if(u.origin!=='https://fonts.gstatic.com'||!u.pathname.endsWith('.woff2'))throw Error('Unexpected font origin/type');
   const family=/font-family: '([^']+)'/.exec(face)[1],range=/unicode-range: ([^;]+);/.exec(face)[1];
   const subset=range.includes('U+0E01')?'thai':range.startsWith('U+0000')?'latin':'latin-ext',name=(family==='DM Sans'?'dm-sans':'noto-sans-thai')+'-'+subset+'.woff2';
   const response=await context.request.get(url);if(response.status()!==200)throw Error('Font HTTP '+response.status());const bytes=await response.body();
   if(bytes.toString('ascii',0,4)!=='wOF2')throw Error('Invalid WOFF2 signature');await fs.writeFile(path.join(root,'ui/assets',name),bytes);
   manifest.push({file:name,family,subset,source:url,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),license:family==='DM Sans'?'DM-Sans-OFL.txt':'Noto-Sans-Thai-OFL.txt'});
   face=face.replace(url,'assets/'+name);faces[manifest.length-1]=face;
  }
  const theme=await fs.readFile(path.join(root,'ui/theme.css'),'utf8');await fs.writeFile(path.join(root,'ui/theme.css'),'/* Shared Home baseline verified against Public on 2026-10-08.\n   Exact Public WOFF2 subsets, including its fixed DM Sans optical design.\n   Bundled with SIL OFL 1.1 notices; no network needed at build/runtime. */\n'+faces.join('\n')+'\n'+theme.slice(theme.indexOf(':root {')));
  await fs.writeFile(path.join(out,'font-manifest.json'),JSON.stringify({at:new Date().toISOString(),fonts:manifest},null,2));console.log('Bundled '+manifest.length+' exact Public font subsets');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
