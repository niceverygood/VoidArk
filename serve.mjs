import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'dist');
const port=Number(process.env.VOID_ARK_PORT)||4190;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
const server=createServer(async(req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(path==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end('{"game":"VOID ARK","status":"ready"}');return;}
    let file=resolve(root,'.'+path);if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end('Forbidden');return;}
    if((await stat(file)).isDirectory())file=resolve(file,'index.html');
    const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(bytes);
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('파일을 찾을 수 없습니다. dist 폴더와 함께 실행해주세요.');}
});
const url=`http://localhost:${port}`;
function openGame(){if(process.platform==='darwin'&&process.env.VOID_ARK_NO_OPEN!=='1')spawn('open',[url],{stdio:'ignore'}).unref();}
server.on('error',async err=>{if(err.code==='EADDRINUSE'){
  try{const response=await fetch(`${url}/health`,{signal:AbortSignal.timeout(1500)});const data=await response.json();if(data.game==='VOID ARK'&&data.status==='ready'){console.log(`${url} 에 게임이 이미 실행 중입니다.`);openGame();process.exit(0);}}catch{}
  console.error(`${port} 포트를 다른 프로그램이 사용 중입니다. 해당 프로그램을 닫거나 VOID_ARK_PORT 환경 변수로 포트를 바꿔주세요.`);process.exit(1);
}console.error(err);process.exit(1);});
server.listen(port,'127.0.0.1',()=>{console.log(`VOID ARK — 잔해의 방주\n${url}\n종료하려면 Ctrl+C`);openGame();});
