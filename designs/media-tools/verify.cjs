// Run with Playwright available via NODE_PATH; uses installed Chrome.
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createServer} = require('./preview.cjs');
(async()=>{
  const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  const output=path.join(__dirname,'qa');fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage();const errors=[],external=[],results=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',req=>{if(!req.url().startsWith(base))external.push(req.url());});
  try{
    for(const tool of ['download','convert']) {
      for(const width of [360,768,1440]) {
        await page.setViewportSize({width,height:1000});
        await page.goto(base+'/designs/media-tools/'+tool+'.html');await page.evaluate(()=>document.fonts.ready);
        assert.equal(await page.locator('[aria-current="page"]').innerText(),tool==='download'?'Download Audio':'Convert Audio');
        assert.equal(await page.evaluate(()=>document.fonts.check('400 16px "Noto Sans Thai"')),true);
        if(tool==='download'){
          assert.equal(await page.locator('input[name="format"]:checked').count(),0);
          assert.equal(await page.locator('#start').isDisabled(),true);
          await page.locator('input[value="Original Audio"]').check();
          assert.equal(await page.locator('#start').isDisabled(),false);
        }
        for(const state of ['ready','working','success','failed','missing','cancelled']){
          await page.selectOption('#preview-state',state);
          const overflow=await page.evaluate(()=>({page:document.documentElement.scrollWidth>innerWidth,elements:[...document.querySelectorAll('main *,header *,footer *')].filter(e=>e.getClientRects().length && !e.classList.contains('visually-hidden') && e.getBoundingClientRect().right>innerWidth+1).map(e=>e.id||e.className)}));
          assert.deepEqual(overflow,{page:false,elements:[]},`${tool} ${width} ${state} overflow`);
          assert.equal(await page.locator('#start').isDisabled(),['working','missing'].includes(state));
          assert.equal(await page.locator('#result').isVisible(),state==='success');
          assert.equal(await page.locator('#cancel').isVisible(),state==='working');
          results.push({tool,width,state,overflow:false});
          if(state==='ready')await page.screenshot({path:path.join(output,`${tool}-${width}.png`),fullPage:true});
          if(width===1440 && state!=='ready')await page.locator('.job-panel').screenshot({path:path.join(output,`${tool}-${state}.png`)});
        }
      }
      await page.selectOption('#preview-state','ready');
      for(const f of ['MP3','WAV','FLAC','ALAC',...(tool==='download'?['Original Audio']:[])]){
        await page.locator(`input[value="${f}"]`).check();
        assert.equal(await page.locator('#mp3-quality').isVisible(),f==='MP3');
        assert.equal(await page.locator('#lossless-quality').isVisible(),['WAV','FLAC','ALAC'].includes(f));
        assert.equal(await page.locator('#original-note').isVisible(),f==='Original Audio');
      }
      await page.locator('#start').click();assert.equal(await page.locator('#cancel').isVisible(),true);
      assert.equal(await page.locator(tool==='download' ? '#source-url' : '#pick-file').isDisabled(),true);
      await page.locator('#cancel').click();assert.match(await page.locator('#job-title').innerText(),/ยกเลิก/);
      await page.locator('#retry').click();await page.waitForFunction(()=>document.querySelector('#preview-state').value==='success',{},{timeout:15000});
      const oldPath=await page.locator('#result-path').innerText();await page.locator('#pick-folder').click();assert.equal(await page.locator('#result-path').innerText(),oldPath);
      await page.locator('#open-file').click();assert.match(await page.locator('#notice').innerText(),/ไม่มีไฟล์ผลลัพธ์จริง/);
      if(tool==='download'){
        await page.fill('#source-url','https://example.com/new');assert.equal(await page.locator('#start').isDisabled(),true);assert.match(await page.locator('#source-title').innerText(),/ยังไม่มี/);
        await page.fill('#source-url','bad-url');await page.locator('#check-link').click();assert.equal(await page.locator('#source-url').getAttribute('aria-invalid'),'true');
        await page.fill('#source-url','https://example.com/one');await page.locator('#check-link').click();await page.fill('#source-url','https://example.com/two');await page.waitForTimeout(800);assert.equal(await page.locator('#start').isDisabled(),true);
        await page.locator('#check-link').click();await page.locator('#check-cancel').click();assert.equal(await page.locator('#start').isDisabled(),true);
        await page.locator('#source-url').press('Enter');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
      }else{
        await page.locator('#file-input').setInputFiles({name:'เสียงทดสอบชื่อยาวมากสำหรับตรวจสอบการตัดบรรทัดและการเก็บต้นฉบับ.wav',mimeType:'audio/wav',buffer:Buffer.alloc(4096)});
        assert.match(await page.locator('#source-title').innerText(),/เสียงทดสอบ/);assert.match(await page.locator('#source-metadata').innerText(),/ไม่ทราบ/);
        await page.setViewportSize({width:360,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
        await page.locator('#file-input').setInputFiles({name:'invalid.txt',mimeType:'text/plain',buffer:Buffer.from('not audio')});assert.match(await page.locator('#notice').innerText(),/กรุณาเลือกไฟล์เสียง/);
      }
      // Keyboard-only entry, native radio arrows, and visible focus.
      await page.goto(base+'/designs/media-tools/'+tool+'.html');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.className),'skip-link');await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),'main');
      if(tool==='download')await page.locator('input[value="Original Audio"]').check();
      await page.locator('input[name="format"]:checked').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('input[name="format"]:checked').inputValue(),tool==='download'?'MP3':'ALAC');
      assert.equal(await page.evaluate(()=>getComputedStyle(document.activeElement.nextElementSibling).outlineStyle),'solid');
    }
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({passed:true,checks:results,consoleErrors:errors,externalRequests:external,interactions:'format controls, start/cancel/retry/complete, immutable result path, URL invalidation/validation/race/cancel, local file selection/unknown metadata, long Thai filename, keyboard skip link/radio/focus'},null,2));
    console.log(`PASS: ${results.length} viewport/state combinations; interaction and keyboard checks; no external requests.`);
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
