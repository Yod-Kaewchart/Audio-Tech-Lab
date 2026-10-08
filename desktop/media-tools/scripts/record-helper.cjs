const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),file=path.join(root,'vendor/manifest.json');
const m=JSON.parse(fs.readFileSync(file));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
m.tools.processHelper={file:'ProcessHost.exe',version:'1.0.0',sha256:hash(path.join(root,'vendor/ProcessHost.exe')),source:'native/ProcessHost.cs',sourceSha256:hash(path.join(root,'native/ProcessHost.cs')),build:'Windows .NET Framework 4.x csc /optimize+ /platform:x64; runtime Windows 10/11 .NET Framework 4.x'};
fs.writeFileSync(file,JSON.stringify(m,null,2));fs.copyFileSync(file,path.join(root,'dependencies.lock.json'));
