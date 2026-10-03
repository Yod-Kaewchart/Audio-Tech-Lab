'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const turn = () => new Promise(r => setImmediate(r));
const source = name => fs.readFileSync(path.join(__dirname, '../dist/demo', name), 'utf8');
function node() {
  return { children: [], textContent: '', hidden: false, replacements: 0,
    append(...items) { this.children.push(...items); },
    replaceChildren(...items) { this.replacements++; this.children = items; }, addEventListener() {} };
}
test('Queue uses slower idle reads, preserves unchanged DOM, pauses hidden polling and resumes immediately', async () => {
  const nodes = new Map(), events = new Map(); let interval, now = 100000, reads = 0, fail = false;
  const jobs = [{ jobId:'one', kind:'analyze', filename:'tone.wav', status:'succeeded' }];
  const document = { hidden:false, querySelector(s) { if (!nodes.has(s)) nodes.set(s,node()); return nodes.get(s); },
    createElement: node, addEventListener:(name,fn)=>events.set(name,fn) };
  const window = { demoAuth:{ user:{ username:'alice' } }, demoServer:{ isOnline:()=>true }, addEventListener:(name,fn)=>events.set(name,fn) };
  const ctx = vm.createContext({ document, window, crypto:require('node:crypto'), Date:class extends Date { static now(){return now;} },
    setTimeout, setInterval:fn=>interval=fn, apiFetch:async()=>{ reads++; if(fail)throw new Error('temporary failure'); return {ok:true,json:async()=>({jobs})}; } });
  vm.runInContext(source('queue.js'),ctx);
  const refresh = ()=>vm.runInContext('refreshProcessingJobs()',ctx), list=document.querySelector('#processing-jobs');
  await refresh(); assert.equal(reads,1); assert.equal(list.replacements,1);
  now+=3000; interval(); await turn(); assert.equal(reads,1);
  now+=12000; interval(); await turn(); assert.equal(reads,2); assert.equal(list.replacements,1);
  jobs[0].status='running'; await refresh(); assert.equal(list.replacements,2);
  now+=3000; interval(); await turn(); assert.equal(reads,4);
  document.hidden=true; now+=30000; interval(); await turn(); assert.equal(reads,4);
  document.hidden=false; events.get('visibilitychange')(); await turn(); assert.equal(reads,5);
  fail=true; await refresh(); fail=false; await refresh();
  assert.equal(document.querySelector('#processing-jobs-status').textContent.includes('temporary failure'),false);
  window.demoAuth=null; events.get('demo-auth-changed')(); list.replaceChildren();
  window.demoAuth={user:{username:'alice'}}; events.get('demo-auth-changed')(); await refresh(); assert.equal(list.children.length,1);
});
test('Resource polling skips locked/hidden workspaces and bounds a stalled read', async () => {
  let tick, calls=0, pending, requestedSignal;
  const events=new Map(), workspace={hidden:true}, document={ hidden:false, querySelector:()=>workspace, addEventListener:(n,f)=>events.set(n,f) };
  const window={ demoServer:{isOnline:()=>true}, demoResourceView:()=>({epoch:1}), addEventListener:(n,f)=>events.set(n,f), dispatchEvent(){} };
  vm.runInNewContext(source('resource-state.js'),{window,document,AbortSignal,Event,CustomEvent,
    setInterval:fn=>tick=fn,fetch:async(url,options)=>{calls++; requestedSignal=options.signal; if(pending)await pending; return {ok:true,json:async()=>({files:[],exports:[]})};}});
  tick(); await turn(); assert.equal(calls,0);
  workspace.hidden=false; events.get('demo-auth-changed')({detail:null}); await turn(); assert.equal(calls,0);
  events.get('demo-auth-changed')({detail:{user:{}}}); await turn(); assert.equal(calls,1); assert.ok(requestedSignal instanceof AbortSignal);
  document.hidden=true; tick(); await turn(); assert.equal(calls,1);
  document.hidden=false; let release; pending=new Promise(r=>release=r);
  events.get('visibilitychange')(); tick(); tick(); await turn(); assert.equal(calls,2);
  release(); await turn(); tick(); await turn(); assert.equal(calls,3);
});
