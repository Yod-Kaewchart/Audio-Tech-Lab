# Survey and preparation checkpoint — 8 October 2026

**พร้อมในระดับแผนเชื่อมต่อและข้อกำหนดสำหรับเริ่มพัฒนา ไม่ใช่พร้อมใช้งานระบบจริง** ผู้ใช้ขอให้สำรวจ ออกแบบ เตรียมความพร้อม และแจ้งก่อนเชื่อมจริง จึงหยุดที่ checkpoint นี้

## งานที่เสร็จ

- ตรวจต้นแบบ Download/Convert และจุดจำลองที่ต้องแทนด้วย native adapter
- เสนอ Windows app ที่บรรจุสองหน้าเดิม เชื่อมภายในโปรแกรม ไม่มี media endpoint ของ Audio Tech Labs
- กำหนด native file/folder picker, source/folder/result IDs, readiness และ single-job lifecycle ร่วมกันทั้งสองหน้า
- กำหนด progress ที่มาจาก worker, cancellation/process-tree ownership, no-overwrite และ local staging/output probe
- เตรียม declaration contract, dependency plan, command argument examples และ acceptance matrix
- แยกหลักฐาน UI ใหม่ไว้ใน ignored runtime ไม่เขียนทับ `designs/media-tools/qa/` เดิม

## ผลตรวจที่ทำจริง

| ตรวจ | ผล |
| --- | --- |
| UI baseline เดิม | 36 viewport/state cases ผ่านที่ 360 / 768 / 1440px ครบสองหน้า |
| Interaction/keyboard | format controls, start/cancel/retry/complete, immutable output path, URL invalidation/race/cancel, file selection/unknown metadata, Thai filename และ keyboard ผ่าน |
| UI network/JavaScript | ไม่มี external requests และไม่มี page errors ในการตรวจครั้งนี้ |
| Dependency survey | Node CLI v24.19.0; FFmpeg/FFprobe 9.0.2; encoder MP3/WAV16/WAV24/FLAC/ALAC มีใน build ที่ตรวจ |
| ยังขาด | ไม่มี usable yt-dlp ใน PATH/ตำแหน่งอ้างอิง; ไม่มี Electron ใน workspace dependency ที่ตรวจ; native process helper ยังเป็นข้อกำหนดที่จะพัฒนา |
| Preparation files | JSON parse ผ่าน; declaration syntax ผ่านด้วย Node TypeScript stripping (ไม่ใช่ full TypeScript typecheck); whitespace check ผ่าน |

UI evidence: `tools/runtime/media-connection-readiness/ui-qa/results.json` พร้อม screenshots ในโฟลเดอร์เดียวกัน ตัวตรวจเป็นการรัน `verify.cjs` เดิม โดยเปลี่ยนเฉพาะปลายทางหลักฐานใน memory สำหรับการสำรวจนี้

## สิ่งที่ยังไม่ทำและต้องตรวจในขั้นพัฒนา

ไม่มีการติดตั้ง/ดาวน์โหลด dependency, รัน downloader, เข้าถึง provider, แปลง media fixture, เปิด native picker, สร้าง/ยกเลิก child process tree หรือ build package จึงยังไม่ยืนยัน native/codec/provider/network/packaging acceptance ใน matrix

Candidate versions เป็นข้อมูลที่อ่านจาก release/documentation ระหว่างสำรวจ ยังไม่เป็น verified runtime manifest และ checksum ยังไม่มี ห้ามอ้างว่า toolchain พร้อมในเครื่องผู้ใช้จากผลเครื่องพัฒนานี้

ยังไม่เลือกวิธี build/acquire Windows process-tree helper รุ่นจริง; ตัวนี้เป็นงานพัฒนาที่ต้องผ่าน acceptance ก่อนให้การยกเลิกงานพร้อมใช้งาน จุดนี้ไม่กระทบความพร้อมของแบบ UI/bridge แต่ยังเป็นเงื่อนไขก่อน native release

## ขอบเขตไฟล์ที่เปลี่ยน

เพิ่มเฉพาะ `connection/` ซึ่งเป็นเอกสารและ declaration แก้ README ต้นแบบให้เชื่อมแผน และเพิ่มหมายเหตุรุ่นล่าสุดในเอกสารแนวคิดเดิม ไม่เปลี่ยน HTML/CSS/JavaScript ของต้นแบบหรือหน้า Home ไม่มี production/backend/credential/deployment changes ไม่มี commit/push

ขั้นถัดไปเมื่อผู้ใช้สั่งต่อ: เตรียม toolchain ในโครงการ desktop แยก → native shell/picker → Convert → Download → cancellation/network/portable acceptance ตามลำดับในแผน
