'use strict';
let sessionCsrf='',sessionVersion=0,logoutPending=false;
const logoutButton=document.querySelector('#logout-button'),logoutMessage=document.querySelector('#logout-message');
async function sessionRequest(path,options={}){
  const response=await fetch('/api'+path,{credentials:'same-origin',cache:'no-store',...options});
  const data=response.headers.get('content-type')?.includes('application/json')?await response.json():{};
  if(!response.ok)throw Object.assign(new Error(data.error||'Request failed'),{status:response.status});
  return data;
}
async function verifySession(){
  const version=++sessionVersion;
  logoutButton.disabled=true;
  try{
    const auth=await sessionRequest('/auth/me');
    if(version!==sessionVersion)return;
    if(auth?.user?.role!=='admin'||auth.user.mustChange){location.replace('/control-center/login/');return}
    sessionCsrf=auth.csrf||'';
    document.querySelector('#account-user').textContent=(auth.user.username||'admin').toUpperCase()+' / ADMIN';
    document.body.hidden=false;
    logoutButton.disabled=false;
  }catch{
    if(version===sessionVersion)location.replace('/control-center/login/');
  }
}
verifySession();
window.addEventListener('pagehide',()=>{
  ++sessionVersion;
  sessionCsrf='';
  document.body.hidden=true;
});
window.addEventListener('pageshow',event=>{
  if(!event.persisted)return;
  logoutPending=false;
  logoutButton.textContent='Sign out';
  logoutMessage.hidden=true;
  verifySession();
});
logoutButton.addEventListener('click',async()=>{
  if(logoutPending||logoutButton.disabled)return;
  logoutPending=true;
  ++sessionVersion;
  logoutButton.disabled=true;
  logoutButton.textContent='Signing out...';
  logoutMessage.hidden=true;
  let signedOut=false;
  try{
    const result=await sessionRequest('/auth/logout',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':sessionCsrf},body:'{}'});
    signedOut=result.ok===true;
  }catch(error){signedOut=error.status===401}
  if(!signedOut){
    // A lost logout response may still have revoked the session. Confirm it
    // before leaving this origin; network/CSRF/server failures must not skip it.
    try{
      const auth=await sessionRequest('/auth/me');
      sessionCsrf=auth.csrf||sessionCsrf;
    }catch(error){signedOut=error.status===401}
  }
  if(!signedOut){
    logoutPending=false;
    logoutButton.disabled=false;
    logoutButton.textContent='Sign out';
    logoutMessage.textContent='Sign out could not be confirmed. Please try again.';
    logoutMessage.hidden=false;
    return;
  }
  sessionCsrf='';
  document.querySelector('#account-user').textContent='ADMIN SESSION';
  document.body.hidden=true;
  location.replace('https://www.audiotechlabs.com/cdn-cgi/access/logout');
});
