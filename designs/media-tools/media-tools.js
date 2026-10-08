/* UI simulation only. No fetch, upload, storage, executable, or media processing. */
'use strict';
(() => {
  const isDownload = document.body.dataset.page === 'download';
  const title = isDownload ? 'Download Audio' : 'Convert Audio';
  const action = isDownload ? 'เริ่มดาวน์โหลด' : 'เริ่มแปลงไฟล์';
  const paths = {
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    convert: '<path d="M4 7h15l-4-4m5 14H5l4 4M20 7v4M4 17v-4"/>',
    file: '<path d="M14 2H5v20h14V7zM14 2v6h5M9 16v-5l5-1v5"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="12.5" cy="16" r="1.5"/>',
    folder: '<path d="M3 6h7l2 3h9v11H3z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    local: '<rect x="3" y="3" width="18" height="13" rx="1"/><path d="M8 21h8m-4-5v5"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
  document.querySelector('#app').innerHTML = `
    <header class="site-header"><div class="header-inner shell">
      <a class="brand" href="../../dist/index.html" aria-label="Audio Tech Labs หน้า Home ในเครื่อง">
        <span class="brand-symbol" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></span>
        <span class="brand-name">Audio <b>Tech Labs</b></span>
      </a><div class="header-label"><span>MEDIA TOOLS &nbsp; / &nbsp; </span><b>PROTOTYPE</b></div>
    </div></header>
    <main id="main" class="shell" tabindex="-1">
      <section class="intro" aria-labelledby="page-title"><p class="eyebrow">MEDIA TOOLS / LOCAL AUDIO</p>
        <div class="intro-row"><div><h1 id="page-title">${title}</h1><p>${isDownload ? 'จากลิงก์ต้นทาง สู่ไฟล์เสียงในเครื่องคุณ' : 'เปลี่ยนรูปแบบไฟล์เสียง เก็บต้นฉบับไว้เสมอ'}</p></div>
        <span class="local-tag">${icon('local')} ออกแบบสำหรับ Windows / Local Companion</span></div>
      </section>
      <nav class="tool-nav" aria-label="Media Tools">
        <a href="download.html" ${isDownload ? 'aria-current="page"' : ''}>${icon('download')} Download Audio</a>
        <a href="convert.html" ${!isDownload ? 'aria-current="page"' : ''}>${icon('convert')} Convert Audio</a>
      </nav>
      <aside class="prototype-note">${icon('info')}<p><strong>ต้นแบบหน้าจอ · ข้อมูลตัวอย่าง</strong> — การเลือกโฟลเดอร์ ดาวน์โหลด แปลง และเปิดไฟล์ยังไม่ทำงานจริง ปุ่มเริ่มใช้สาธิตสถานะเท่านั้น</p></aside>
      <div id="notice" class="notice" role="status" aria-live="polite"></div>
      <div class="workspace">
        <section class="panel" aria-labelledby="source-heading"><div class="panel-heading"><div class="heading-label"><span class="step-number">01</span><h2 id="source-heading">${isDownload ? 'ลิงก์ต้นทาง YouTube' : 'ไฟล์ต้นฉบับ'}</h2></div><span class="small-tag">1 รายการ</span></div>
          <fieldset id="source-controls"><legend class="visually-hidden">เลือกแหล่งเสียง</legend>
          ${isDownload ? `
            <label for="source-url">วางลิงก์หนึ่งรายการ</label><div class="input-row"><input id="source-url" type="url" value="https://example.com/audio/acoustic-session" placeholder="https://…" autocomplete="off" spellcheck="false" aria-describedby="source-help link-error"><button id="check-link" class="button" type="button">ตรวจสอบลิงก์</button></div>
            <p id="source-help" class="help">ตัวอย่างลิงก์สมมติ · ไม่เชื่อมต่อกับต้นทาง</p><p id="link-error" class="help" role="status"></p>
            <button id="check-cancel" class="text-button" type="button" hidden>ยกเลิกการตรวจสอบจำลอง</button>
          ` : `
            <div class="file-picker"><p>เลือกไฟล์เสียงจากเครื่องครั้งละหนึ่งไฟล์<br>อ่านเฉพาะชื่อและขนาดเพื่อแสดงในต้นแบบ</p>
            <div class="picker-actions"><button id="pick-file" class="button" type="button">${icon('folder')} เลือกไฟล์เสียง</button><button id="use-sample" class="text-button" type="button">ใช้ไฟล์ตัวอย่าง</button></div>
            <input id="file-input" class="visually-hidden" type="file" accept="audio/*,.wav,.flac,.mp3,.m4a,.aac,.ogg,.opus,.aiff,.aif,.wma" tabindex="-1" aria-label="เลือกไฟล์เสียงหนึ่งไฟล์"></div>
          `}</fieldset>
          <div class="source-card" id="source-card"><div class="source-top"><span class="file-icon">${icon('file')}</span><div><h3 id="source-title"></h3><p id="source-caption"></p></div></div><dl class="metadata" id="source-metadata"></dl><p class="source-note" id="source-note"></p></div>
        </section>
        <section class="panel" aria-labelledby="output-heading"><div class="panel-heading"><div class="heading-label"><span class="step-number">02</span><h2 id="output-heading">รูปแบบและปลายทาง</h2></div></div>
          <fieldset id="output-controls"><legend class="visually-hidden">ตั้งค่าผลลัพธ์</legend>
            <fieldset><legend>รูปแบบเสียง</legend><div class="format-options">${(isDownload ? ['Original Audio','MP3','WAV','FLAC','ALAC'] : ['MP3','WAV','FLAC','ALAC']).map(f => `<label class="format-option"><input type="radio" name="format" value="${f}" ${!isDownload && f === 'FLAC' ? 'checked' : ''}><span>${f}</span></label>`).join('')}</div></fieldset>
            <div class="quality"><p id="original-note" class="quality-note">เก็บ codec ต้นทาง ไม่เข้ารหัสเสียงใหม่<br>ตัวอย่างนี้เป็น Opus ในไฟล์ .webm</p>
              <div id="mp3-quality"><label for="bitrate">Bitrate</label><select id="bitrate"><option>128 kbps</option><option selected>192 kbps</option><option>256 kbps</option><option>320 kbps</option></select><p class="quality-note">MP3 เป็นการเข้ารหัสแบบ lossy</p></div>
              <div id="lossless-quality"><div class="quality-grid"><div class="field"><label for="sample-rate">Sample rate</label><select id="sample-rate"><option value="source">ตามต้นทาง</option><option>44.1 kHz</option><option>48 kHz</option></select></div><div class="field"><label for="bit-depth">Bit depth</label><select id="bit-depth"><option>16 bit</option><option>24 bit</option></select></div></div>
                <p class="quality-note lossless-note">การแปลงเป็น lossless ไม่ได้เพิ่มรายละเอียดที่ต้นทางไม่มี</p>
                <p id="alac-note" class="quality-note" hidden>ALAC ใน container .m4a — เป็นคนละ codec กับ AAC</p>
              </div>
            </div>
            <div class="destination"><label id="folder-label">โฟลเดอร์ปลายทาง <span class="help">(ตัวอย่าง)</span></label><div class="input-row"><div class="folder-path" aria-labelledby="folder-label">${icon('folder')}<span id="folder-path"></span></div><button id="pick-folder" class="button" type="button">เลือกโฟลเดอร์</button></div><p class="help">สร้างไฟล์ใหม่ ไม่เขียนทับต้นฉบับหรือไฟล์ชื่อซ้ำ</p></div>
          </fieldset>
          <div class="start-row"><button id="start" class="button button-primary" type="button">${icon(isDownload ? 'download' : 'convert')} ${action}</button><p class="help" id="start-help">สาธิตการทำงานครั้งละหนึ่งรายการ · ไม่มีการสร้างไฟล์จริง</p></div>
        </section>
      </div>
      <section class="panel job-panel" aria-labelledby="job-heading"><div class="panel-heading"><div class="heading-label"><span class="step-number">03</span><h2 id="job-heading">งานปัจจุบัน</h2></div><span class="status-badge" id="job-badge">พร้อมเริ่ม</span></div>
        <div class="job-content"><div class="job-copy" role="status" aria-live="polite" aria-atomic="true"><h3 id="job-title"></h3><p id="job-description"></p></div><div class="job-actions"><button id="cancel" class="button" type="button" hidden>ยกเลิก</button><button id="retry" class="button" type="button" hidden>ลองใหม่ (จำลอง)</button></div></div>
        <div id="progress-area" hidden><div class="progress-row"><span id="progress-stage"></span><strong id="progress-value">0%</strong></div><progress id="progress" max="100" value="0" aria-label="ความคืบหน้าจำลอง"></progress></div>
        <div class="result-details" id="result" hidden><p>ชื่อไฟล์: <strong id="result-name"></strong></p><p>ตำแหน่งไฟล์: <strong id="result-path"></strong></p><p id="result-format"></p><p>ผลลัพธ์ตัวอย่าง · ยังไม่มีไฟล์นี้ในเครื่อง</p><div class="job-actions"><button id="open-folder" class="button" type="button">${icon('folder')} เปิดโฟลเดอร์</button><button id="open-file" class="button" type="button">${icon('file')} เปิดไฟล์</button></div></div>
      </section>
      <aside class="preview-controls" aria-label="ตัวควบคุมต้นแบบ"><div><label for="preview-state">ทดลองดูสถานะหน้าจอ</label><p>สำหรับตรวจต้นแบบเท่านั้น ทุกสถานะเป็นข้อมูลจำลอง</p></div><select id="preview-state"><option value="ready">พร้อมเริ่ม</option><option value="working">กำลังทำงาน</option><option value="success">สำเร็จ</option><option value="failed">ล้มเหลว</option><option value="missing">เครื่องมือในเครื่องไม่พร้อม</option><option value="cancelled">ยกเลิกแล้ว</option></select></aside>
      <aside class="local-info" aria-label="การทำงานภายในเครื่อง"><div><h3>${icon('local')} เสียงและการประมวลผลอยู่ในเครื่องคุณ</h3><p>เมื่อพัฒนาจริง yt-dlp, FFmpeg, FFprobe และไฟล์ทั้งหมดอยู่บนเครื่องผู้ใช้ ดาวน์โหลดจากต้นทางลงเครื่องโดยตรง และแปลงไฟล์ภายในเครื่อง ไม่ส่งไฟล์ ลิงก์ หรือประวัติงานไปประมวลผลบน Server ของ Audio Tech Labs</p></div><div><h3>เก็บไฟล์ไว้กับคุณ</h3><p>ไม่อัปโหลดผลลัพธ์เข้า Web Demo อัตโนมัติ ไม่ลบไฟล์ผลลัพธ์อัตโนมัติ และไม่เขียนทับต้นฉบับ หน้าจอนี้เตรียมสำหรับโปรแกรม Windows หรือ Local Companion เบราว์เซอร์ไม่ได้เรียก executable โดยตรง</p></div></aside>
    </main><footer class="footer"><div class="footer-inner shell"><span>Audio Tech Labs · Media Tools</span><span>LOCAL FIRST / SCREEN PROTOTYPE · 01</span></div></footer>`;

  const $ = id => document.getElementById(id);
  const set = (id, value) => { $(id).textContent = value; };
  let source, checked = true, state = 'ready', timer, checkTimer, snapshot;
  let folder = 'C:\\Users\\Example\\Downloads\\Audio Tech Labs';
  const sample = () => ({name:isDownload ? 'Acoustic Session — เสียงในห้องทดลอง' : 'เสียงบันทึกห้องทดลอง.wav', caption:'Audio Tech Labs · ข้อมูลตัวอย่างสมมติ', size:isDownload ? '5.8 MB' : '72.6 MB', duration:'04:12', codec:isDownload ? 'Opus / WebM' : 'PCM / WAV', rate:'48 kHz', depth:isDownload ? 'ไม่ทราบ' : '24 bit', mock:true});
  source = sample();
  const format = () => document.querySelector('input[name="format"]:checked')?.value || null;
  const notice = message => set('notice', message);
  const metadata = entries => { $('source-metadata').replaceChildren(...entries.map(([key,value]) => { const div=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;div.append(dt,dd);return div; })); };
  function renderSource() {
    set('source-title', checked ? source.name : 'ยังไม่มีข้อมูลแหล่งเสียง');
    set('source-caption', checked ? source.caption : 'ตรวจสอบลิงก์ใหม่ก่อนเริ่มงาน');
    metadata(checked ? [['ระยะเวลา',source.duration],['ขนาด',source.size],['Codec / container',source.codec],['Sample rate',source.rate],['Bit depth',source.depth],['ช่องเสียง',source.mock ? 'Stereo · 2 ch' : 'ไม่ทราบ']] : []);
    set('source-note', !checked ? 'ไม่มีการดึงข้อมูลจากลิงก์จริงในต้นแบบ' : source.mock ? 'ชื่อและข้อมูลเสียงทั้งหมดเป็นตัวอย่าง ไม่ได้ตรวจจากต้นทางจริง' : 'ชื่อและขนาดมาจากไฟล์ที่เลือก ข้อมูลเสียงยังไม่ทราบ เพราะยังไม่เชื่อม FFprobe ไม่มีการอ่านเนื้อหาหรืออัปโหลดไฟล์');
  }
  function renderQuality() {
    const f=format(); $('original-note').hidden=f!=='Original Audio'; $('mp3-quality').hidden=f!=='MP3'; $('lossless-quality').hidden=!['WAV','FLAC','ALAC'].includes(f); $('alac-note').hidden=f!=='ALAC';
    $('bitrate').disabled=f!=='MP3'; $('sample-rate').disabled=$('bit-depth').disabled=!['WAV','FLAC','ALAC'].includes(f);
  }
  function capture() {
    const f=format(), ext=({'Original Audio':'webm',MP3:'mp3',WAV:'wav',FLAC:'flac',ALAC:'m4a'})[f];
    const rate=$('sample-rate').value==='source' ? source.rate : $('sample-rate').value;
    return {name:source.name.replace(/\.[a-z0-9]{2,5}$/i,'')+' — '+(isDownload ? 'download' : 'converted')+'.'+ext,folder,summary:f==='Original Audio' ? 'Opus / WebM · คงเสียงต้นทาง · 48 kHz' : f==='MP3' ? 'MP3 · '+$('bitrate').value : `${f==='WAV' ? 'PCM / WAV' : f==='ALAC' ? 'ALAC / M4A' : f} · ${rate} · ${$('bit-depth').value}`};
  }
  function stopTimers(){ clearInterval(timer);clearTimeout(checkTimer);$('check-cancel') && ($('check-cancel').hidden=true);if(isDownload)$('check-link').disabled=false; }
  function showState(next,{animate=false}={}) {
    stopTimers();state=next;const busy=next==='working';
    $('preview-state').value=next;$('source-controls').disabled=busy;$('output-controls').disabled=busy;
    $('start').disabled=busy || next==='missing' || !checked || !format();
    $('retry').disabled=$('start').disabled;
    $('cancel').hidden=!busy;$('retry').hidden=!['failed','cancelled'].includes(next);$('progress-area').hidden=!['working','success'].includes(next);$('result').hidden=next!=='success';
    const labels={ready:'พร้อมเริ่ม',working:'กำลังทำงาน',success:'สำเร็จ',failed:'ล้มเหลว',missing:'เครื่องมือไม่พร้อม',cancelled:'ยกเลิกแล้ว'};
    set('job-badge',labels[next]+' · ตัวอย่าง');
    const copy={
      ready:[checked ? 'พร้อมสำหรับงานถัดไป' : 'รอตรวจสอบลิงก์','ตรวจรูปแบบและโฟลเดอร์ปลายทาง แล้วกด “'+action+'” เพื่อดูการทำงานจำลอง'],
      working:[isDownload ? 'กำลังดาวน์โหลดเสียงตัวอย่าง' : 'กำลังแปลงเสียงตัวอย่าง','กำลังสาธิตความคืบหน้า · ไม่มีการประมวลผลจริง'],
      success:['ไฟล์พร้อมใช้งาน (ตัวอย่าง)','จำลองการตรวจสอบไฟล์เสร็จสมบูรณ์ ผลลัพธ์จะถูกเก็บในเครื่องผู้ใช้เมื่อพัฒนาระบบจริง'],
      failed:['พื้นที่ปลายทางไม่เพียงพอ (ตัวอย่าง)','เลือกโฟลเดอร์ใหม่หรือเพิ่มพื้นที่ว่าง แล้วลองใหม่ ต้นฉบับยังคงอยู่'],
      missing:['ยังเริ่มงานไม่ได้ (ตัวอย่าง)',isDownload ? 'จำลอง: ไม่พบ yt-dlp ในเครื่อง ต้องเตรียม yt-dlp, FFmpeg, FFprobe และ JS runtime / EJS ให้พร้อมก่อนดาวน์โหลด' : 'จำลอง: ไม่พบ FFmpeg ในเครื่อง ต้องเตรียม FFmpeg และ FFprobe ให้พร้อมก่อนแปลงไฟล์ ไม่ต้องใช้ yt-dlp'],
      cancelled:['ยกเลิกงานแล้ว (ตัวอย่าง)','หยุดการสาธิตแล้ว ไม่มีไฟล์ผลลัพธ์ถูกสร้าง และต้นฉบับไม่ได้เปลี่ยนแปลง']
    };set('job-title',copy[next][0]);set('job-description',copy[next][1]);
    set('start-help',next==='missing' ? 'เครื่องมือไม่พร้อม · เลือกสถานะ “พร้อมเริ่ม” เพื่อทดลองต่อ' : !format() ? 'กรุณาเลือกรูปแบบเสียงก่อนดาวน์โหลด' : !checked ? 'ตรวจสอบลิงก์ก่อนเริ่มงาน' : 'สาธิตการทำงานครั้งละหนึ่งรายการ · ไม่มีการสร้างไฟล์จริง');
    if(['working','success'].includes(next)) {
      snapshot ||= capture();
      if(next==='success'){progress(100);set('result-name',snapshot.name);set('result-path',snapshot.folder+'\\'+snapshot.name);set('result-format',snapshot.summary);}
      else {set('job-description',snapshot.name+' · '+snapshot.summary+' · ข้อมูลจำลอง');let value=animate ? 0 : 46;progress(value);if(animate)timer=setInterval(()=>{value=Math.min(100,value+7);progress(value);if(value===100)showState('success');},650);}
    }
  }
  function progress(value){$('progress').value=value;set('progress-value',value+'%');set('progress-stage',value===100 ? 'ตรวจสอบเสร็จสมบูรณ์ · ตัวอย่าง' : value>=91 ? 'กำลังตรวจสอบไฟล์ · ตัวอย่าง' : value>=70 ? 'กำลังเตรียมเสียง · ตัวอย่าง' : isDownload ? 'กำลังรับเสียงจากต้นทาง · ตัวอย่าง' : 'กำลังแปลงเสียง · ตัวอย่าง');}
  function start(){if(!checked || !format() || state==='missing' || state==='working')return;notice('');snapshot=capture();showState('working',{animate:true});$('cancel').focus();}
  $('start').addEventListener('click',start);$('retry').addEventListener('click',start);
  $('cancel').addEventListener('click',()=>{showState('cancelled');$('retry').focus();});
  $('preview-state').addEventListener('change',event=>{notice('');if(!checked){source=sample();checked=true;if(isDownload)$('source-url').value='https://example.com/audio/acoustic-session';renderSource();}snapshot=capture();showState(event.target.value);});
  document.querySelectorAll('input[name="format"]').forEach(input=>input.addEventListener('change',()=>{renderQuality();showState(state);}));
  $('pick-folder').addEventListener('click',()=>{folder=folder.includes('Downloads') ? 'D:\\Music\\Audio Tech Labs' : 'C:\\Users\\Example\\Downloads\\Audio Tech Labs';set('folder-path',folder);notice('เปลี่ยนปลายทางตัวอย่างแล้ว · ยังไม่เปิดหน้าต่างเลือกโฟลเดอร์จริง');});
  $('open-folder').addEventListener('click',()=>notice('ตัวอย่างปุ่มเปิดโฟลเดอร์ · ยังไม่มีการเปิดโฟลเดอร์หรือเรียก Local Companion'));
  $('open-file').addEventListener('click',()=>notice('ตัวอย่างปุ่มเปิดไฟล์ · ยังไม่มีไฟล์ผลลัพธ์จริงและไม่มีการเรียกโปรแกรมภายในเครื่อง'));
  if(isDownload){
    $('source-url').addEventListener('input',()=>{stopTimers();checked=false;snapshot=null;$('source-url').removeAttribute('aria-invalid');set('link-error','');renderSource();showState('ready');});
    $('check-link').addEventListener('click',()=>{
      let url;try{url=new URL($('source-url').value.trim());}catch{}
      if(!url || url.protocol!=='https:'){set('link-error','กรุณาวางลิงก์ที่ขึ้นต้นด้วย https:// หนึ่งรายการ');$('source-url').setAttribute('aria-invalid','true');$('source-url').focus();return;}
      $('source-url').removeAttribute('aria-invalid');checked=false;renderSource();$('start').disabled=true;$('check-link').disabled=true;$('check-cancel').hidden=false;set('link-error','กำลังตรวจสอบจำลอง… ไม่ได้เปิดลิงก์นี้');
      checkTimer=setTimeout(()=>{source=sample();checked=true;renderSource();showState('ready');set('link-error','ตรวจสอบจำลองเสร็จแล้ว · ข้อมูลต่อไปนี้ไม่ได้มาจากลิงก์ที่วาง');},700);
    });
    $('source-url').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$('check-link').click();}});
    $('check-cancel').addEventListener('click',()=>{stopTimers();checked=false;renderSource();showState('ready');set('link-error','ยกเลิกการตรวจสอบจำลองแล้ว');$('check-link').focus();});
  } else {
    $('pick-file').addEventListener('click',()=>$('file-input').click());
    $('file-input').addEventListener('change',()=>{const file=$('file-input').files[0];if(!file)return;
      if(!file.type.startsWith('audio/') && !/\.(wav|flac|mp3|m4a|aac|ogg|opus|aiff?|wma)$/i.test(file.name)){notice('กรุณาเลือกไฟล์เสียงหนึ่งไฟล์ เช่น WAV, FLAC, MP3 หรือ M4A');$('file-input').value='';return;}
      source={name:file.name,caption:'ไฟล์ในเครื่อง · แสดงเฉพาะชื่อและขนาด',size:(file.size/1048576).toLocaleString('en-US',{maximumFractionDigits:2})+' MB',duration:'ไม่ทราบ',codec:'ไม่ทราบ',rate:'ไม่ทราบ',depth:'ไม่ทราบ',mock:false};checked=true;snapshot=null;renderSource();showState('ready');notice('เลือกไฟล์แล้ว · ไม่มีการอ่านเนื้อหาไฟล์หรืออัปโหลด');$('file-input').value='';
    });
    $('use-sample').addEventListener('click',()=>{source=sample();checked=true;snapshot=null;renderSource();showState('ready');notice('แสดงไฟล์และข้อมูลเสียงตัวอย่างสมมติ');});
  }
  set('folder-path',folder);renderSource();renderQuality();showState('ready');
})();
