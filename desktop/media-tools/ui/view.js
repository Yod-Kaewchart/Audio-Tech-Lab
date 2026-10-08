/* Shared static view derived from the approved prototype. No demo controller. */
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
      <a class="brand" href="download.html" aria-label="Audio Tech Labs Media Tools">
        <span class="brand-symbol" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></span>
        <span class="brand-name">Audio <b>Tech Labs</b></span>
      </a><div class="header-label"><span>MEDIA TOOLS &nbsp; / &nbsp; </span><b>WINDOWS · LOCAL</b></div>
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
      <aside class="prototype-note">${icon("local")}<p><strong>ทำงานภายในเครื่องคุณ</strong> — ไฟล์และลิงก์ไม่ผ่าน Server ของ Audio Tech Labs · รุ่นทดสอบภายใน</p></aside>
      <div id="notice" class="notice" role="status" aria-live="polite"></div>
      <div class="workspace">
        <section class="panel" aria-labelledby="source-heading"><div class="panel-heading"><div class="heading-label"><span class="step-number">01</span><h2 id="source-heading">${isDownload ? 'ลิงก์ต้นทาง YouTube' : 'ไฟล์ต้นฉบับ'}</h2></div><span class="small-tag">1 รายการ</span></div>
          <fieldset id="source-controls"><legend class="visually-hidden">เลือกแหล่งเสียง</legend>
          ${isDownload ? `
            <label for="source-url">วางลิงก์หนึ่งรายการ</label><div class="input-row"><input id="source-url" type="url" value="" placeholder="https://…" autocomplete="off" spellcheck="false" aria-describedby="source-help link-error"><button id="paste-link" class="button" type="button">วางลิงก์</button><button id="check-link" class="button" type="button">ตรวจสอบลิงก์</button></div>
            <p id="source-help" class="help">คัดลอกลิงก์ YouTube แล้วกดวางลิงก์ หรือ Ctrl+V / คลิกขวา → วาง · ใช้ลิงก์ที่คุณมีสิทธิ์ดาวน์โหลด</p><p id="link-error" class="help" role="status"></p>
            <button id="check-cancel" class="text-button" type="button" hidden>ยกเลิกการตรวจสอบ</button>
          ` : `
            <div class="file-picker"><p>เลือกไฟล์เสียงจากเครื่องครั้งละหนึ่งไฟล์<br>อ่านข้อมูลเสียงด้วย FFprobe ภายในเครื่อง</p>
            <div class="picker-actions"><button id="pick-file" class="button" type="button">${icon('folder')} เลือกไฟล์เสียง</button></div>
            </div>
          `}</fieldset>
          <div class="source-card" id="source-card"><div class="source-top"><span class="file-icon">${icon('file')}</span><div><h3 id="source-title"></h3><p id="source-caption"></p></div></div><dl class="metadata" id="source-metadata"></dl><p class="source-note" id="source-note"></p></div>
        </section>
        <section class="panel" aria-labelledby="output-heading"><div class="panel-heading"><div class="heading-label"><span class="step-number">02</span><h2 id="output-heading">รูปแบบและปลายทาง</h2></div></div>
          <fieldset id="output-controls"><legend class="visually-hidden">ตั้งค่าผลลัพธ์</legend>
            <fieldset><legend>รูปแบบเสียง</legend><div class="format-options">${(isDownload ? ['Original Audio','MP3','WAV','FLAC','ALAC'] : ['MP3','WAV','FLAC','ALAC']).map(f => `<label class="format-option"><input type="radio" name="format" value="${f}" ${!isDownload && f === 'FLAC' ? 'checked' : ''}><span>${f}</span></label>`).join('')}</div></fieldset>
            <div class="quality"><p id="original-note" class="quality-note">เก็บ codec และ container ที่ดาวน์โหลดได้จริง ไม่เข้ารหัสเสียงใหม่</p>
              <div id="mp3-quality"><label for="bitrate">Bitrate</label><select id="bitrate"><option>128 kbps</option><option selected>192 kbps</option><option>256 kbps</option><option>320 kbps</option></select><p class="quality-note">MP3 เป็นการเข้ารหัสแบบ lossy</p></div>
              <div id="lossless-quality"><div class="quality-grid"><div class="field"><label for="sample-rate">Sample rate</label><select id="sample-rate"><option value="source">ตามต้นทาง</option><option>44.1 kHz</option><option>48 kHz</option></select></div><div class="field"><label for="bit-depth">Bit depth</label><select id="bit-depth"><option>16 bit</option><option>24 bit</option></select></div></div>
                <p class="quality-note lossless-note">การแปลงเป็น lossless ไม่ได้เพิ่มรายละเอียดที่ต้นทางไม่มี</p>
                <p id="alac-note" class="quality-note" hidden>ALAC ใน container .m4a — เป็นคนละ codec กับ AAC</p>
              </div>
            </div>
            <div class="destination"><label id="folder-label">โฟลเดอร์ปลายทาง </label><div class="input-row"><div class="folder-path" aria-labelledby="folder-label">${icon('folder')}<span id="folder-path"></span></div><button id="pick-folder" class="button" type="button">เลือกโฟลเดอร์</button></div><p class="help">สร้างไฟล์ใหม่ ไม่เขียนทับต้นฉบับหรือไฟล์ชื่อซ้ำ</p>${isDownload ? `<div class="filename-field"><label for="output-name">เปลี่ยนชื่อไฟล์ปลายทาง</label><input id="output-name" type="text" maxlength="110" placeholder="เว้นว่างเพื่อใช้ชื่ออัตโนมัติ" autocomplete="off" spellcheck="false" aria-describedby="filename-help filename-error"><p id="filename-help" class="help">กรอกเฉพาะชื่อ ไม่ต้องใส่นามสกุล โปรแกรมจะเติมตามรูปแบบเสียงที่เลือก</p><p id="filename-error" class="help filename-error" role="status"></p></div>` : ''}</div>
          </fieldset>
          <div class="start-row"><button id="start" class="button button-primary" type="button">${icon(isDownload ? 'download' : 'convert')} ${action}</button><p class="help" id="start-help">ทำงานครั้งละหนึ่งรายการร่วมกันทั้งสองหน้า</p></div>
        </section>
      </div>
      <section class="panel job-panel" aria-labelledby="job-heading"><div class="panel-heading"><div class="heading-label"><span class="step-number">03</span><h2 id="job-heading">งานปัจจุบัน</h2></div><span class="status-badge" id="job-badge">พร้อมเริ่ม</span></div>
        <div class="job-content"><div class="job-copy" role="status" aria-live="polite" aria-atomic="true"><h3 id="job-title"></h3><p id="job-description"></p></div><div class="job-actions"><button id="cancel" class="button" type="button" hidden>ยกเลิก</button><button id="retry" class="button" type="button" hidden>ลองใหม่</button><button id="new-job" class="button" type="button" hidden>เริ่มงานใหม่</button></div></div>
        <div id="progress-area" hidden><div class="progress-row"><span id="progress-stage"></span><strong id="progress-value">0%</strong></div><progress id="progress" max="100" value="0" aria-label="ความคืบหน้าของขั้นตอนปัจจุบัน"></progress></div>
        <div class="result-details" id="result" hidden><p>ชื่อไฟล์: <strong id="result-name"></strong></p><p>ตำแหน่งไฟล์: <strong id="result-path"></strong></p><p id="result-format"></p><p>ผลลัพธ์อยู่ในเครื่อง ไม่มีวันหมดอายุและไม่ถูกลบอัตโนมัติ</p><div class="job-actions"><button id="open-folder" class="button" type="button">${icon('folder')} เปิดโฟลเดอร์</button><button id="open-file" class="button" type="button">${icon('file')} เปิดไฟล์</button></div></div>
      </section>
      <aside class="preview-controls"><div><strong>เครื่องมือในเครื่อง</strong><p id="capability-status" role="status">กำลังตรวจสอบเครื่องมือ…</p></div><button id="refresh-tools" type="button" class="button">ตรวจสอบอีกครั้ง</button></aside>
      <aside class="local-info" aria-label="การทำงานภายในเครื่อง"><div><h3>${icon('local')} เสียงและการประมวลผลอยู่ในเครื่องคุณ</h3><p>yt-dlp, FFmpeg, FFprobe และไฟล์ทั้งหมดอยู่บนเครื่องผู้ใช้ ดาวน์โหลดจากต้นทางลงเครื่องโดยตรง และแปลงไฟล์ภายในเครื่อง ไม่ส่งไฟล์ ลิงก์ หรือประวัติงานไปประมวลผลบน Server ของ Audio Tech Labs</p></div><div><h3>เก็บไฟล์ไว้กับคุณ</h3><p>ไม่อัปโหลดผลลัพธ์เข้า Web Demo อัตโนมัติ ไม่ลบไฟล์ผลลัพธ์อัตโนมัติ และไม่เขียนทับต้นฉบับ โปรแกรม Windows นี้ใช้ native bridge ที่จำกัดคำสั่งเพื่อเรียกเครื่องมือภายในเครื่อง</p></div></aside>
    </main><footer class="footer"><div class="footer-inner shell"><span>Audio Tech Labs · Media Tools</span><span>LOCAL FIRST / WINDOWS · 0.1.0</span></div></footer>`;

})();
