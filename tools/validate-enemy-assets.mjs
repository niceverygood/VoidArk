import fs from 'node:fs';
const projectFile=relative=>new URL('../'+relative,import.meta.url);
import {validateGLB} from './validate-assets.mjs';
import {validateEnemyGeometry} from './validate-enemy-geometry.mjs';
const plan=JSON.parse(fs.readFileSync(projectFile('enemy-asset-plan.json'))),manifest=JSON.parse(fs.readFileSync(projectFile('public/assets/meshy/manifest.json'))),entries=[];
for(const a of plan.assets){const m=manifest.assets[a.id];if(!m){if(process.argv.includes('--partial'))continue;throw Error('Missing '+a.id);}if(m.provider!=='Meshy'||m.status!=='ready')throw Error('Not ready '+a.id);const bytes=fs.readFileSync(projectFile('public'+m.url));const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));if(!json.materials.some(x=>x.normalTexture&&x.pbrMetallicRoughness?.metallicRoughnessTexture))throw Error('Missing PBR maps '+a.id);const thumbnail=fs.readFileSync(projectFile('public'+m.thumbnail));if(thumbnail.readUInt32BE(0)!==0x89504e47)throw Error('Invalid thumbnail '+a.id);entries.push({id:a.id,planet:a.planet,role:a.role,task:m.taskId,...validateGLB(bytes),...validateEnemyGeometry(bytes)});}
if(new Set(entries.map(e=>e.task)).size!==entries.length)throw Error('Reused generation task');
const report={checkedAt:new Date().toISOString(),planned:plan.assets.length,ready:entries.length,totalMB:+(entries.reduce((n,e)=>n+e.bytes,0)/1048576).toFixed(2),maxTriangles:Math.max(0,...entries.map(a=>a.triangles)),entries};fs.mkdirSync(projectFile('qa'),{recursive:true});fs.writeFileSync(projectFile('qa/enemy-assets-integrity.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,entries:undefined}));


