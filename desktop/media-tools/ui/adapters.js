'use strict';
class NativeAdapter {
 constructor(bridge){this.bridge=bridge;this.native=true;}
 async call(name,request){if(!this.bridge||typeof this.bridge[name]!=='function')throw Object.assign(new Error('Native bridge ไม่พร้อม กรุณาเปิดผ่านโปรแกรม Media Tools บน Windows'),{code:'UNAVAILABLE'});const reply=await this.bridge[name](request);if(!reply?.ok)throw Object.assign(new Error(reply?.error?.message||'Native bridge ตอบกลับไม่ถูกต้อง'),reply?.error);return reply.value;}
 subscribeJob(listener){return this.bridge?.subscribeJob?this.bridge.subscribeJob(listener):()=>{};}
}
// Explicit preview adapter only. Production custom protocol never serves a demo entry point.
// The original approved simulation remains in designs/media-tools; native has no simulation fallback.
class DemoAdapter {
 constructor(){this.native=false;}
 async call(name){if(name==='getCurrentJob')return null;if(name==='getCapabilities')return {contractVersion:1,execution:'demo',tools:{},convertReady:false,downloadReady:false};throw new Error('DemoAdapter: เปิดต้นแบบเดิมใน designs/media-tools เพื่อทดลองสถานะจำลอง');}
 subscribeJob(){return ()=>{};}
}
window.createMediaAdapter=()=>document.body.dataset.adapter==='demo' && location.protocol!=='atl-media:'?new DemoAdapter():new NativeAdapter(window.localMedia);
