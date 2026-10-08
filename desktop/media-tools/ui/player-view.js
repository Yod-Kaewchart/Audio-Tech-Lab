'use strict';
(() => {
 // Reuse the actual existing header/navigation/brand source, including its fonts and colors.
 const main=document.getElementById('main');
 document.querySelector('#page-title').textContent='Player';
 document.querySelector('.intro-row p').textContent='เพลงในเครื่องคุณ พร้อมฟังในพื้นที่ของคุณ';
 document.querySelectorAll('.tool-nav a').forEach(a=>{a.removeAttribute('aria-current');if(a.getAttribute('href')==='player.html')a.setAttribute('aria-current','page');});
 document.querySelector('.local-info')?.remove();
 const logo=document.querySelector('.brand').cloneNode(true);logo.removeAttribute('href');logo.removeAttribute('aria-label');
 const note=document.querySelector('.prototype-note');
 while(note.nextElementSibling)note.nextElementSibling.remove();
 main.insertAdjacentHTML('beforeend',`
  <div id="notice" class="notice" role="status" aria-live="polite"></div>
  <div class="workspace player-workspace">
   <section class="panel" aria-labelledby="player-heading">
    <div class="panel-heading"><div class="heading-label"><span class="step-number">01</span><h2 id="player-heading">กำลังฟัง</h2></div><span id="playback-status" class="status-badge" role="status">พร้อมเริ่ม</span></div>
    <div class="disc-stage"><div id="disc" class="disc" role="img" aria-label="แผ่น CD โลโก้ Audio Tech Labs"><div id="disc-logo" class="disc-logo"></div><img id="disc-artwork" alt="" hidden><span class="disc-reflection"></span></div></div>
    <div class="artwork-choice"><label for="artwork-mode">ภาพบนแผ่น CD</label><select id="artwork-mode"><option value="logo">โลโก้เว็บ</option><option value="cover">ปกเพลง</option></select></div>
    <p id="artwork-help" class="help">ใช้โลโก้ Audio Tech Labs</p>
    <div class="track-info"><h3 id="track-title">ยังไม่ได้เลือกเพลง</h3><p id="track-artist" hidden></p><p id="track-album" hidden></p><dl id="track-metadata" class="metadata"></dl></div>
    <p id="loading-status" class="help" role="status" hidden>กำลังโหลดเสียง…</p>
    <div class="seek-control"><label for="seek" class="visually-hidden">ตำแหน่งเล่นเพลง</label><input id="seek" type="range" min="0" max="1" step="0.1" value="0" disabled><div class="time-labels"><span id="elapsed">0:00</span><span id="duration">—:—</span></div></div>
    <div class="transport"><button id="previous" class="button" type="button" aria-label="เพลงก่อนหน้า">ก่อนหน้า</button><button id="play-pause" class="button button-primary" type="button">เล่น</button><button id="next" class="button" type="button" aria-label="เพลงถัดไป">ถัดไป</button><button id="stop" class="button" type="button">หยุด</button></div>
    <div class="volume-control"><button id="mute" class="button" type="button" aria-pressed="false">ปิดเสียง</button><div><label for="volume">Volume <span id="volume-value">80%</span></label><input id="volume" type="range" min="0" max="1" step="0.01" value="0.8"></div></div>
    <div class="playback-options"><button id="shuffle" class="button" type="button" aria-pressed="false">Shuffle</button><div><label for="repeat">Repeat</label><select id="repeat"><option value="off">ปิด</option><option value="one">เพลงเดียว</option><option value="all">ทั้งหมด</option></select></div></div>
   </section>
   <section id="drop-zone" class="panel" aria-labelledby="playlist-heading">
    <div class="panel-heading"><div class="heading-label"><span class="step-number">02</span><h2 id="playlist-heading">Playlist</h2></div><span id="track-count" class="small-tag">0 เพลง</span></div>
    <div class="file-picker"><p>ลากไฟล์หรือโฟลเดอร์เสียงมาวางที่นี่<br>ดับเบิลคลิกเพลงเพื่อเล่น</p><div class="picker-actions"><button id="add-files" class="button" type="button">เพิ่มไฟล์</button><button id="add-folder" class="button" type="button">เพิ่มโฟลเดอร์</button></div><input id="file-input" type="file" multiple hidden aria-label="เพิ่มไฟล์เสียง"></div>
    <p id="import-status" class="help" role="status" hidden>กำลังอ่านไฟล์และข้อมูลเพลง…</p>
    <p id="playlist-empty" class="help">เพิ่มเพลงเพื่อเริ่มฟัง</p><ol id="playlist" class="playlist" aria-label="รายการเพลง"></ol>
    <p class="help">ลากแถวเพื่อจัดลำดับ หรือใช้ปุ่มเลื่อนขึ้น / ลง · สูงสุด 500 เพลง</p>
   </section>
  </div>
  <section class="panel job-panel" aria-labelledby="session-heading"><div class="panel-heading"><div class="heading-label"><span class="step-number">03</span><h2 id="session-heading">งานปัจจุบัน</h2></div></div><div class="job-content"><div class="job-copy"><h3>ฟังไฟล์ในเครื่อง</h3><p>ฟังเพลงต่อได้ระหว่างใช้ Download Audio และ Convert Audio รายการเพลงคงอยู่จนเริ่มงานใหม่ใน Player หรือปิดแอป</p></div><div class="job-actions"><button id="new-job" class="button" type="button">เริ่มงานใหม่</button></div></div></section>
 `);
 document.getElementById('disc-logo').append(logo);
})();
