import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const key=process.env.MESHY_API_KEY;
if(!key)throw Error('MESHY_API_KEY must be supplied only to the generation process');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'public/assets/meshy');
const plan=JSON.parse(fs.readFileSync(path.join(root,'skill-asset-plan.json')));
const statePath=path.join(root,'asset-sources/skill-generation-state.json');fs.mkdirSync(path.dirname(statePath),{recursive:true});
const state=fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath)):{reservedCredits:0,entries:{},started:new Date().toISOString()};
const selected=process.argv.includes('--pilot')?['nation-a-scout','nation-a-carrier','nation-y-carrier']:plan.assets.map(a=>a.id);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function persist(){fs.writeFileSync(statePath+'.tmp',JSON.stringify(state,null,2));fs.renameSync(statePath+'.tmp',statePath);}
function manifest(id,task){const file=path.join(out,'manifest.json'),m=JSON.parse(fs.readFileSync(file));m.assets[id]={url:`/assets/meshy/${id}.glb`,thumbnail:`/assets/meshy/${id}.png`,taskId:task.id,provider:'Meshy',model:'meshy-6',status:'ready'};fs.writeFileSync(file,JSON.stringify(m,null,2));}
async function api(route,body){
 for(let retry=0;retry<8;retry++){
  let response;try{response=await fetch(`https://api.meshy.ai/openapi/${route}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});}catch{if(body)throw Error('Ambiguous POST transport failure; inspect task history before retrying');await wait(8000);continue;}
  if(response.status===429){await wait(Math.max(15000,Number(response.headers.get('retry-after')||0)*1000));continue;}
  if(!response.ok)throw Error(`Meshy HTTP ${response.status}`);
  const value=await response.json();return {value,retryAfter:Number(response.headers.get('retry-after')||0)};
 }throw Error('Rate limit retry budget exhausted');
}
async function track(id){for(let tries=0;tries<180;tries++){const {value,retryAfter}=await api(`v2/text-to-3d/${id}`);if(value.status==='SUCCEEDED')return value;if(['FAILED','CANCELED','EXPIRED'].includes(value.status))throw Error(`Task ${value.status}`);await wait(Math.max(20000,retryAfter*1000));}throw Error('Task still running; resume by stored task ID');}
async function download(url,destination){const u=new URL(url);if(u.protocol!=='https:'||!(u.hostname==='meshy.ai'||u.hostname.endsWith('.meshy.ai')))throw Error('Untrusted asset host');for(let i=0;i<4;i++){try{const r=await fetch(url,{signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error('Asset download failed');const bytes=Buffer.from(await r.arrayBuffer());if(destination.endsWith('.glb')&&bytes.toString('ascii',0,4)!=='glTF')throw Error('Invalid GLB');fs.writeFileSync(destination+'.download',bytes);fs.renameSync(destination+'.download',destination);return;}catch{await wait(4000);}}throw Error('Asset download exhausted');}
async function run(asset){const e=state.entries[asset.id]||(state.entries[asset.id]={});if(e.status==='ready')return;
 try{
  if(e.status==='ambiguous'||(!e.preview&&e.status==='creating-preview')||(!e.refine&&e.status==='creating-refine')){e.status='ambiguous';e.error='Unconfirmed task creation; inspect Meshy task history before retrying';persist();return;}
  if(!e.preview){if(state.reservedCredits+20>plan.maxCredits)throw Error('Credit ceiling');state.reservedCredits+=20;e.status='creating-preview';persist();e.preview=(await api('v2/text-to-3d',{mode:'preview',prompt:asset.prompt,ai_model:'meshy-6',should_remesh:true,target_polycount:asset.polycount,target_formats:['glb']})).value.result;persist();console.log(`preview ${asset.id}`);}
  const preview=await track(e.preview);e.previewStatus=preview.status;persist();
  if(!e.refine){if(state.reservedCredits+10>plan.maxCredits)throw Error('Credit ceiling');state.reservedCredits+=10;e.status='creating-refine';persist();e.refine=(await api('v2/text-to-3d',{mode:'refine',preview_task_id:e.preview,enable_pbr:true,texture_resolution:'2k',texture_prompt:asset.texture,target_formats:['glb']})).value.result;persist();}
  e.status='refining';persist();const finished=await track(e.refine);
  await download(finished.model_urls.glb,path.join(out,asset.id+'.glb'));
  if(finished.thumbnail_url)await download(finished.thumbnail_url,path.join(out,asset.id+'.png'));
  e.status='ready';e.bytes=fs.statSync(path.join(out,asset.id+'.glb')).size;e.finished=new Date().toISOString();manifest(asset.id,finished);persist();console.log(`ready ${asset.id} (${Math.round(e.bytes/1024)} KiB)`);
 }catch(error){e.error=error.message;e.status=/Ambiguous/.test(error.message)?'ambiguous':'error';persist();console.log(`error ${asset.id}: ${error.message}`);}
}
const balance=(await api('v1/balance')).value.balance;console.log(JSON.stringify({balance,selected:selected.length,reservedCredits:state.reservedCredits}));
const queue=plan.assets.filter(a=>selected.includes(a.id));
if(process.argv.includes('--pilot'))queue.sort((a,b)=>selected.indexOf(a.id)-selected.indexOf(b.id));
else queue.sort((a,b)=>{const priority=id=>['nation-a-scout','nation-a-cruiser','nation-a-carrier','nation-y-carrier','orbital-dock','star-gate','arkelium-ore'].includes(id)?0:id.startsWith('module')||id.includes('turret')?1:2;return priority(a.id)-priority(b.id);});
let next=0;await Promise.all(Array.from({length:process.argv.includes('--pilot')?3:3},async()=>{while(next<queue.length){const a=queue[next++];await run(a);}}));
console.log(JSON.stringify({ready:Object.values(state.entries).filter(e=>e.status==='ready').length,errors:Object.values(state.entries).filter(e=>e.status==='error'||e.status==='ambiguous').length,reservedCredits:state.reservedCredits,balance:(await api('v1/balance')).value.balance}));
