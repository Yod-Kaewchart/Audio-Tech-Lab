'use strict';
// Read-only evidence: current Public Home, its delivered CSS, and local Home source.
const {chromium}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http');
const root=path.resolve(__dirname,'../../..'),out=path.resolve(__dirname,'../evidence/home-theme');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const selectors=['body','.site-header','.hero','.hero-image','.hero-shade','.hero h1','.hero-description','.about-copy .lead','.section h2','.service-card','.service-card h3','.service-card p','.button-primary','.button-outline','#web-demo','.demo-home-tool','.earbuds-visual','.contact-section','.site-footer'];
async function inspect(page){
 await page.evaluate(()=>document.fonts.ready);
 const styles=await page.evaluate(selectors=>Object.fromEntries(selectors.map(selector=>{
  const el=document.querySelector(selector);if(!el)return [selector,null];const s=getComputedStyle(el);
  return [selector,{fontFamily:s.fontFamily,fontWeight:s.fontWeight,fontSize:s.fontSize,lineHeight:s.lineHeight,color:s.color,backgroundColor:s.backgroundColor,backgroundImage:s.backgroundImage,borderColor:s.borderColor}];
 })),selectors);
 const metrics=await page.evaluate(()=>{
  const el=document.createElement('span');el.style.cssText='position:absolute;left:-10000px;white-space:pre;font-family:"DM Sans","Noto Sans Thai",sans-serif;';document.body.append(el);
  const result=[];for(const text of ['Audio Tech Labs Media Tools','กำลังฟัง เพลงภาษาไทย สระและวรรณยุกต์'])for(const weight of [400,500,600,700])for(const size of [14,16,21,50]){el.style.fontWeight=weight;el.style.fontSize=size+'px';el.textContent=text;result.push({text,weight,size,width:el.getBoundingClientRect().width});}el.remove();return result;
 });
 const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const {root}=await cdp.send('DOM.getDocument');const renderedFonts={};
 for(const selector of ['.hero h1','.hero-description','.about-copy .lead','.button-primary']){
  const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector});
  renderedFonts[selector]=(await cdp.send('CSS.getPlatformFontsForNode',{nodeId})).fonts;
 }
 await cdp.detach();return {url:page.url(),styles,metrics,renderedFonts,fonts:await page.evaluate(()=>Array.from(document.fonts,f=>({family:f.family,weight:f.weight,status:f.status}))),tokens:await page.evaluate(()=>Object.fromEntries(['--bg-base','--bg-deep','--bg-section','--surface','--surface-hover','--text-primary','--text-secondary','--accent','--accent-hover','--border-subtle','--control-border'].map(k=>[k,getComputedStyle(document.body).getPropertyValue(k).trim()]))) };
}
(async()=>{
 await fs.mkdir(out,{recursive:true});const server=http.createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(!['index.html','home.css','styles.css','script.js'].includes(name)&&!name.endsWith('.webp'))throw Error();const body=await fs.readFile(path.join(root,'dist',name));res.setHeader('Content-Type',name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':name.endsWith('.js')?'text/javascript':'image/webp');res.end(body);}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:940}}),delivered={},errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('response',async r=>{if(['styles.css','home.css'].includes(new URL(r.url()).pathname.split('/').pop())){const name=new URL(r.url()).pathname.split('/').pop();delivered[name]={url:r.url(),status:r.status(),headers:await r.allHeaders(),body:(await r.body()).toString()};}
   if(r.url().startsWith('https://fonts.googleapis.com/'))await fs.writeFile(path.join(out,'public-fonts.css'),await r.body());
   if(r.url().startsWith('https://fonts.gstatic.com/'))await fs.writeFile(path.join(out,new URL(r.url()).pathname.split('/').pop()),await r.body());
  });
  await page.goto('https://www.audiotechlabs.com/',{waitUntil:'networkidle',timeout:60000});
  const publicDesktop=await inspect(page);await page.screenshot({path:path.join(out,'public-home-1280.png')});
  await page.setViewportSize({width:360,height:600});const publicMinimum=await inspect(page);await page.screenshot({path:path.join(out,'public-home-360.png')});
  const css={};for(const name of ['styles.css','home.css']){const d=delivered[name];if(!d||d.status!==200)throw Error('Public CSS did not load: '+name);await fs.writeFile(path.join(out,'public-'+name),d.body);const source=await fs.readFile(path.join(root,'dist',name));css[name]={url:d.url,status:d.status,headers:d.headers,publicSha256:hash(d.body),sourceSha256:hash(source),equal:hash(d.body)===hash(source),equalIgnoringLineEndings:d.body.replace(/\r\n/g,'\n')===source.toString().replace(/\r\n/g,'\n')};}
  const publicHtml=await page.content();await fs.writeFile(path.join(out,'public-home.html'),publicHtml);
  await page.setViewportSize({width:1280,height:940});await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});const sourceDesktop=await inspect(page);
  await page.setViewportSize({width:360,height:600});const sourceMinimum=await inspect(page);
  const normalize=s=>JSON.stringify(s).replace(/https:\/\/www\.audiotechlabs\.com|http:\/\/127\.0\.0\.1:\d+/g,'ORIGIN');
  const report={at:new Date().toISOString(),css,publicDesktop,publicMinimum,sourceDesktop,sourceMinimum,desktopStylesEqualIgnoringImageOrigin:normalize(publicDesktop.styles)===normalize(sourceDesktop.styles),minimumStylesEqualIgnoringImageOrigin:normalize(publicMinimum.styles)===normalize(sourceMinimum.styles),errors};await fs.writeFile(path.join(out,'reference.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({css:Object.fromEntries(Object.entries(css).map(([k,v])=>[k,{equalIgnoringLineEndings:v.equalIgnoringLineEndings}])),desktopStylesEqual:report.desktopStylesEqualIgnoringImageOrigin,minimumStylesEqual:report.minimumStylesEqualIgnoringImageOrigin,errors},null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
