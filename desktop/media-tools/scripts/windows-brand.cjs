'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function windowsVersion(version){
 const m=/^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/.exec(version);if(!m||m.slice(1).some(n=>Number(n||0)>65535))throw Error('Unsupported Windows app version: '+version);
 return m.slice(1).map(n=>n||'0').join('.');
}
function brand(root,exe,pkg){
 const tool=JSON.parse(fs.readFileSync(path.join(root,'build-tools.lock.json'),'utf8')).rcedit,file=path.join(root,'cache',tool.file);
 if(!fs.existsSync(file)||sha(fs.readFileSync(file))!==tool.sha256)throw Error('Pinned rcedit is missing or checksum mismatched: '+tool.url);
 cp.execFileSync(file,[exe,'--set-version-string','ProductName',pkg.productName,'--set-version-string','FileDescription',pkg.productName,'--set-version-string','CompanyName','Audio Tech Labs','--set-version-string','OriginalFilename',path.basename(exe),'--set-file-version',windowsVersion(pkg.version),'--set-product-version',windowsVersion(pkg.version),'--set-version-string','ProductVersion',pkg.version,'--set-icon',path.join(root,'installer/assets/media-tools.ico')],{windowsHide:true});
 return verifyBrand(exe,path.join(root,'installer/assets/media-tools.ico'),pkg);
}
function versionInfo(exe){
 return JSON.parse(cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$v=(Get-Item -LiteralPath $env:ATL_BRAND_EXE).VersionInfo; [ordered]@{ProductName=$v.ProductName;FileDescription=$v.FileDescription;FileVersion=$v.FileVersion;ProductVersion=$v.ProductVersion;OriginalFilename=$v.OriginalFilename;fixedFileVersion=($v.FileMajorPart.ToString()+'.'+$v.FileMinorPart+'.'+$v.FileBuildPart+'.'+$v.FilePrivatePart)}|ConvertTo-Json -Compress"],{env:{...process.env,ATL_BRAND_EXE:exe},windowsHide:true,encoding:'utf8'}).trim());
}
// Read the PE resource table and compare every icon referenced by its first
// RT_GROUP_ICON against the exact image payloads in our ICO (including PNG sizes).
function peIconHashes(exe){
 const b=fs.readFileSync(exe),pe=b.readUInt32LE(0x3c),count=b.readUInt16LE(pe+6),optional=pe+24,size=b.readUInt16LE(pe+20),dirs=optional+(b.readUInt16LE(optional)===0x20b?112:96),rva=b.readUInt32LE(dirs+16),sections=[];
 for(let i=0;i<count;i++){const o=optional+size+i*40;sections.push({rva:b.readUInt32LE(o+12),size:Math.max(b.readUInt32LE(o+8),b.readUInt32LE(o+16)),raw:b.readUInt32LE(o+20)});}
 const offset=r=>{const s=sections.find(s=>r>=s.rva&&r<s.rva+s.size);if(!s)throw Error('Invalid PE RVA');return s.raw+r-s.rva;},base=offset(rva),resources=[];
 function visit(at,keys=[]){const o=base+at,n=b.readUInt16LE(o+12)+b.readUInt16LE(o+14);for(let i=0;i<n;i++){const e=o+16+i*8,id=b.readUInt32LE(e),v=b.readUInt32LE(e+4),k=[...keys,id];if(v&0x80000000)visit(v&0x7fffffff,k);else{const d=base+v;resources.push({keys:k,data:b.subarray(offset(b.readUInt32LE(d)),offset(b.readUInt32LE(d))+b.readUInt32LE(d+4))});}}}
 visit(0);const group=resources.find(r=>r.keys[0]===14);if(!group)throw Error('EXE has no icon group');const hashes=[];
 for(let i=0;i<group.data.readUInt16LE(4);i++){const id=group.data.readUInt16LE(6+i*14+12),icon=resources.find(r=>r.keys[0]===3&&r.keys[1]===id);if(!icon)throw Error('Missing EXE icon');hashes.push(sha(icon.data));}return hashes.sort();
}
function icoHashes(file){const b=fs.readFileSync(file),hashes=[];for(let i=0;i<b.readUInt16LE(4);i++){const o=6+i*16,len=b.readUInt32LE(o+8),at=b.readUInt32LE(o+12);hashes.push(sha(b.subarray(at,at+len)));}return hashes.sort();}
function verifyBrand(exe,icon,pkg){const info=versionInfo(exe);assert.equal(info.ProductName,pkg.productName);assert.equal(info.FileDescription,pkg.productName);assert.equal(info.FileVersion,windowsVersion(pkg.version));assert.equal(info.fixedFileVersion,windowsVersion(pkg.version));assert.equal(info.ProductVersion,pkg.version);assert.equal(info.OriginalFilename,path.basename(exe));const iconImages=peIconHashes(exe);assert.deepEqual(iconImages,icoHashes(icon));return {versionInfo:info,iconSha256:sha(fs.readFileSync(icon)),iconImages};}
module.exports={brand,verifyBrand,windowsVersion,peIconHashes,icoHashes};
