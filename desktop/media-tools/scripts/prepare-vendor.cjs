'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),cache=path.join(root,'cache'),vendor=path.join(root,'vendor');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function download(url,file){
  const r=await fetch(url);if(!r.ok)throw Error(`${r.status} ${url}`);
  const b=Buffer.from(await r.arrayBuffer());if(b.length===0)throw Error('Empty download');await fs.writeFile(file,b);return b;
}
async function checked(url,file,expected){let b;try{b=await fs.readFile(file);}catch{}if(!b || hash(b)!==expected)b=await download(url,file);if(hash(b)!==expected)throw Error('Publisher checksum mismatch: '+url);return b;}
async function main(){
 await fs.mkdir(cache,{recursive:true});await fs.mkdir(vendor,{recursive:true});await fs.mkdir(path.join(vendor,'notices'),{recursive:true});
 const manifest={schema:1,target:'win32-x64',createdAt:new Date().toISOString(),tools:{},archives:[]};
 const ybase='https://github.com/yt-dlp/yt-dlp/releases/download/2026.08.19/';
 const ysha=(await download(ybase+'SHA2-256SUMS',path.join(cache,'yt-dlp-SHA2-256SUMS'))).toString();
 const yhash=ysha.split(/\r?\n/).find(l=>/\s\*?yt-dlp\.exe$/.test(l))?.split(/\s/)[0];if(!yhash)throw Error('Missing yt-dlp publisher hash');
 await checked(ybase+'yt-dlp.exe',path.join(vendor,'yt-dlp.exe'),yhash);
 await download('https://raw.githubusercontent.com/yt-dlp/yt-dlp/2026.08.19/THIRD_PARTY_LICENSES.txt',path.join(vendor,'notices/yt-dlp-THIRD_PARTY_LICENSES.txt'));
 await download('https://raw.githubusercontent.com/yt-dlp/yt-dlp/2026.08.19/LICENSE',path.join(vendor,'notices/yt-dlp-LICENSE.txt'));
 manifest.tools.ytDlp={file:'yt-dlp.exe',version:'2026.08.19',sha256:yhash,source:ybase+'yt-dlp.exe',publisherChecksum:ybase+'SHA2-256SUMS'};
 const nbase='https://nodejs.org/dist/v24.19.0/',nname='node-v24.19.0-win-x64.zip';
 const nsha=(await download(nbase+'SHASUMS256.txt',path.join(cache,'node-SHASUMS256.txt'))).toString();
 const nhash=nsha.split(/\r?\n/).find(l=>l.endsWith(nname))?.split(/\s/)[0];if(!nhash)throw Error('Missing Node publisher hash');
 await checked(nbase+nname,path.join(cache,nname),nhash);
 expand(path.join(cache,nname),path.join(cache,'node'));
 await fs.copyFile(path.join(cache,'node/node-v24.19.0-win-x64/node.exe'),path.join(vendor,'node.exe'));
 await fs.copyFile(path.join(cache,'node/node-v24.19.0-win-x64/LICENSE'),path.join(vendor,'notices/Node-LICENSE.txt'));
 manifest.archives.push({name:nname,sha256:nhash,source:nbase+nname,publisherChecksum:nbase+'SHASUMS256.txt'});
 manifest.tools.jsRuntime={file:'node.exe',version:'24.19.0',sha256:hash(await fs.readFile(path.join(vendor,'node.exe'))),source:nbase+nname};
 const fbase='https://www.gyan.dev/ffmpeg/builds/',fname='ffmpeg-release-essentials.zip';
 const fver=(await download(fbase+fname+'.ver',path.join(cache,'ffmpeg.ver'))).toString().trim();if(!fver.startsWith('9.0.2'))throw Error('FFmpeg release moved: '+fver);
 const fhash=(await download(fbase+fname+'.sha256',path.join(cache,'ffmpeg.sha256'))).toString().trim().split(/\s/)[0];
 const fzip=path.join(cache,'ffmpeg-9.0.2-essentials.zip');
 try {const existing=await fs.readFile('D:/Projects/Audio Album Splitter AI/tools/ffmpeg-local/ffmpeg-release-essentials.zip');if(hash(existing)===fhash)await fs.writeFile(fzip,existing);}catch{}
 await checked(fbase+fname,fzip,fhash);expand(fzip,path.join(cache,'ffmpeg'));
 const fdir=path.join(cache,'ffmpeg',(await fs.readdir(path.join(cache,'ffmpeg'))).find(n=>n.startsWith('ffmpeg-9.0.2')));
 for(const name of ['ffmpeg','ffprobe']){await fs.copyFile(path.join(fdir,'bin',name+'.exe'),path.join(vendor,name+'.exe'));manifest.tools[name]={file:name+'.exe',version:'9.0.2-essentials_build',sha256:hash(await fs.readFile(path.join(vendor,name+'.exe'))),source:fbase+fname};}
 await fs.cp(path.join(fdir,'LICENSE'),path.join(vendor,'notices/FFmpeg-GPLv3.txt'));
 await fs.cp(path.join(fdir,'README.txt'),path.join(vendor,'notices/FFmpeg-README.txt'));
 manifest.archives.push({name:'ffmpeg-9.0.2-essentials.zip',sha256:fhash,source:fbase+fname,publisherChecksum:fbase+fname+'.sha256'});
 const electronZip='electron-v44.7.0-win32-x64.zip',ebase='https://github.com/electron/electron/releases/download/v44.7.0/';
 const esha=(await download(ebase+'SHASUMS256.txt',path.join(cache,'electron-SHASUMS256.txt'))).toString();
 const ehash=esha.split(/\r?\n/).find(l=>l.endsWith(electronZip))?.split(/\s/)[0];if(!ehash)throw Error('Missing Electron publisher hash');
 await checked(ebase+electronZip,path.join(cache,electronZip),ehash);
 manifest.archives.push({name:electronZip,version:'44.7.0',sha256:ehash,source:ebase+electronZip,publisherChecksum:ebase+'SHASUMS256.txt'});
 await fs.writeFile(path.join(vendor,'manifest.json'),JSON.stringify(manifest,null,2));
 await fs.copyFile(path.join(vendor,'manifest.json'),path.join(root,'dependencies.lock.json'));
 console.log('Verified vendor dependencies prepared. Build helper next.');
}
function expand(file,to){execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'expand.ps1'),file,to],{windowsHide:true,stdio:'inherit'});}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
