'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'control-center/frontend/session.js'),'utf8');
const accessLogout='https://www.audiotechlabs.com/cdn-cgi/access/logout';
const admin={user:{role:'admin',username:'yod',mustChange:false},csrf:'session-csrf'};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function dashboard(respond){
  const elements=Object.fromEntries(['logout-button','logout-message','account-user'].map(id=>[id,{disabled:false,hidden:id==='logout-message',textContent:id==='logout-button'?'Sign out':'',listeners:{},addEventListener(event,handler){this.listeners[event]=handler}}]));
  const calls=[],redirects=[],events={},body={hidden:false};
  const context=vm.createContext({
    document:{body,querySelector:selector=>elements[selector.slice(1)]},
    window:{addEventListener:(event,handler)=>{events[event]=handler}},
    location:{replace:url=>redirects.push(url)},
    fetch:async(url,options)=>{calls.push({url,options});return respond(url,options,calls.length)},
    Error
  });
  vm.runInContext(source,context);
  return {elements,calls,redirects,body,context,events,click:()=>elements['logout-button'].listeners.click()};
}
function response(status,data){return Response.json(data,{status})}

test('Full sign out waits for local revocation, sends CSRF once, and ignores double clicks',async()=>{
  let release;
  const page=dashboard(url=>url.endsWith('/me')?response(200,admin):new Promise(resolve=>{release=resolve}));
  await settle();
  const first=page.click();
  await page.click();
  assert.equal(page.elements['logout-button'].disabled,true);
  assert.equal(page.calls.filter(call=>call.url.endsWith('/logout')).length,1);
  assert.deepEqual(page.redirects,[],'Access logout must wait for the local logout response');
  const request=page.calls.at(-1);
  assert.equal(request.url,'/api/auth/logout');assert.equal(request.options.method,'POST');
  assert.equal(request.options.headers['X-CSRF-Token'],admin.csrf);
  assert.equal(request.options.credentials,'same-origin');assert.equal(request.options.cache,'no-store');
  release(response(200,{ok:true}));await first;
  assert.deepEqual(page.redirects,[accessLogout]);
  assert.equal(vm.runInContext('sessionCsrf',page.context),'');
  assert.equal(page.elements['account-user'].textContent,'ADMIN SESSION');
  assert.equal(page.body.hidden,true);
  await page.click();assert.equal(page.calls.filter(call=>call.url.endsWith('/logout')).length,1);
});

test('An expired local session still proceeds to Access logout',async()=>{
  const page=dashboard(url=>url.endsWith('/me')?response(200,admin):response(401,{error:'Please sign in'}));
  await settle();await page.click();assert.deepEqual(page.redirects,[accessLogout]);
});

test('A lost logout response only proceeds after auth/me confirms the session is invalid',async()=>{
  let revoked=false;
  const page=dashboard(url=>{
    if(url.endsWith('/logout')){revoked=true;throw new TypeError('Connection lost')}
    return revoked?response(401,{error:'Please sign in'}):response(200,admin);
  });
  await settle();await page.click();
  assert.deepEqual(page.calls.map(call=>call.url),['/api/auth/me','/api/auth/logout','/api/auth/me']);
  assert.deepEqual(page.redirects,[accessLogout]);
});

for(const failure of ['network',403,500,502,504,'unexpected-success']){
  test('Unconfirmed local logout stays on the dashboard and permits retry: '+failure,async()=>{
    const page=dashboard(url=>{
      if(url.endsWith('/me'))return response(200,admin);
      if(failure==='network')throw new TypeError('Offline');
      return failure==='unexpected-success'?response(200,{}):response(failure,{error:'Logout failed'});
    });
    await settle();await page.click();
    assert.deepEqual(page.redirects,[]);
    assert.equal(page.elements['logout-button'].disabled,false);
    assert.equal(page.elements['logout-message'].hidden,false);
    assert.match(page.elements['logout-message'].textContent,/could not be confirmed/);
    assert.equal(vm.runInContext('sessionCsrf',page.context),admin.csrf);
    await page.click();assert.equal(page.calls.filter(call=>call.url.endsWith('/logout')).length,2);
  });
}

test('Network failures in both logout and verification never trigger Access logout',async()=>{
  const page=dashboard((url,options,count)=>{
    if(count===1)return response(200,admin);
    throw new TypeError('Offline');
  });
  await settle();await page.click();assert.deepEqual(page.redirects,[]);
});

test('A stale CSRF token is refreshed for an explicit retry without silently resubmitting logout',async()=>{
  let posts=0;
  const next={...admin,csrf:'refreshed-csrf'};
  const page=dashboard(url=>url.endsWith('/me')?response(200,posts?next:admin):++posts===1?response(403,{error:'Invalid security token'}):response(200,{ok:true}));
  await settle();await page.click();assert.equal(posts,1);assert.deepEqual(page.redirects,[]);
  await page.click();assert.equal(posts,2);assert.equal(page.calls.at(-1).options.headers['X-CSRF-Token'],next.csrf);
  assert.deepEqual(page.redirects,[accessLogout]);
});

test('Back/forward cache restoration hides stale content and rechecks the revoked session',async()=>{
  let revoked=false;
  const page=dashboard(url=>{
    if(url.endsWith('/logout')){revoked=true;return response(200,{ok:true})}
    return revoked?response(401,{error:'Please sign in'}):response(200,admin);
  });
  await settle();await page.click();page.events.pagehide();page.events.pageshow({persisted:true});
  assert.equal(page.body.hidden,true);
  assert.equal(page.elements['logout-button'].disabled,true);
  await settle();assert.deepEqual(page.redirects,[accessLogout,'/control-center/login/']);
  assert.equal(page.body.hidden,true);
  assert.equal(vm.runInContext('sessionCsrf',page.context),'');
});

test('A valid cached page becomes usable only after a fresh administrator session check',async()=>{
  const page=dashboard(()=>response(200,admin));await settle();
  page.events.pagehide();assert.equal(page.body.hidden,true);
  page.events.pageshow({persisted:true});assert.equal(page.body.hidden,true);
  await settle();assert.equal(page.body.hidden,false);assert.equal(page.elements['logout-button'].disabled,false);
  assert.equal(page.calls.length,2);assert.deepEqual(page.redirects,[]);
});

test('A session response arriving after pagehide cannot restore the old authenticated view',async()=>{
  let release;
  const page=dashboard(()=>new Promise(resolve=>{release=resolve}));
  await page.click();assert.equal(page.calls.length,1,'Sign out is disabled during initial session verification');
  page.events.pagehide();release(response(200,admin));await settle();
  assert.equal(page.body.hidden,true);assert.equal(page.elements['logout-button'].disabled,true);
  assert.equal(vm.runInContext('sessionCsrf',page.context),'');assert.deepEqual(page.redirects,[]);
});
