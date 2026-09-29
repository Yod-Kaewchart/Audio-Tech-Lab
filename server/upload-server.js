const http=require("http"),fs=require("fs"),path=require("path"),crypto=require("crypto");
const PORT=8787,MAX=2000*1000*1000,CHUNK=8*1024*1024,ROOT=path.resolve(__dirname,"..","uploads");
const sessions=new Map(); fs.mkdirSync(ROOT,{recursive:true});
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type,X-Upload-Id,X-Chunk-Index","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
function send(res,code,obj){res.writeHead(code,{...cors,"Content-Type":"application/json; charset=utf-8"});res.end(JSON.stringify(obj))}
function body(req,limit=1024*1024){return new Promise((ok,bad)=>{let b=[],n=0;req.on("data",c=>{n+=c.length;if(n>limit){bad(new Error("body too large"));req.destroy();return}b.push(c)});req.on("end",()=>ok(Buffer.concat(b)));req.on("error",bad)})}
function safeName(n){return path.basename(n).replace(/[^a-zA-Z0-9._ -]/g,"_")}
const server=http.createServer(async(req,res)=>{try{
 if(req.method==="OPTIONS"){res.writeHead(204,cors);return res.end()}
 if(req.method==="GET"&&req.url==="/health")return send(res,200,{ok:true,maxMB:2000,chunkMB:8});
 if(req.method==="POST"&&req.url==="/upload/init"){const d=JSON.parse((await body(req)).toString()||"{}"),name=safeName(d.name||""),ext=path.extname(name).toLowerCase();if(![".wav",".flac",".m4a"].includes(ext))return send(res,415,{error:"unsupported file type"});if(!Number.isSafeInteger(d.size)||d.size<=0||d.size>MAX)return send(res,413,{error:"file exceeds 2000 MB limit"});const id=crypto.randomUUID(),file=path.join(ROOT,id+".part");fs.writeFileSync(file,"");sessions.set(id,{id,name,size:d.size,file,received:0,next:0});return send(res,200,{uploadId:id,chunkSize:CHUNK})}
 if(req.method==="POST"&&req.url==="/upload/chunk"){const id=req.headers["x-upload-id"],s=sessions.get(id),idx=Number(req.headers["x-chunk-index"]);if(!s)return send(res,404,{error:"upload session not found"});if(idx!==s.next)return send(res,409,{error:"unexpected chunk",expected:s.next});const b=await body(req,CHUNK+1024);if(s.received+b.length>s.size||s.received+b.length>MAX)return send(res,413,{error:"upload exceeds declared size"});fs.appendFileSync(s.file,b);s.received+=b.length;s.next++;return send(res,200,{received:s.received,size:s.size})}
 if(req.method==="POST"&&req.url==="/upload/complete"){const d=JSON.parse((await body(req)).toString()||"{}"),s=sessions.get(d.uploadId);if(!s)return send(res,404,{error:"upload session not found"});if(s.received!==s.size)return send(res,409,{error:"upload incomplete",received:s.received,size:s.size});const final=path.join(ROOT,s.id+"-"+s.name);fs.renameSync(s.file,final);sessions.delete(s.id);return send(res,200,{ok:true,fileId:s.id,name:s.name,size:s.size})}
 send(res,404,{error:"not found"});
}catch(e){send(res,500,{error:e.message})}});
server.listen(PORT,"0.0.0.0",()=>console.log("Audio Tech Lab upload backend http://0.0.0.0:"+PORT));
