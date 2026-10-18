import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'public/assets/meshy');
export function validateGLB(bytes){
 if(bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw Error('Invalid GLB header');
 let json,bin;for(let offset=12;offset<bytes.length;){const length=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4);if(length%4||offset+8+length>bytes.length)throw Error('Invalid chunk boundary');const chunk=bytes.subarray(offset+8,offset+8+length);if(type===0x4e4f534a)json=JSON.parse(chunk.toString());if(type===0x004e4942)bin=chunk;offset+=8+length;}
 if(!json||!bin||!json.meshes?.length)throw Error('Missing model data');
 for(const view of json.bufferViews||[])if(view.buffer!==0||(view.byteOffset||0)+view.byteLength>bin.length||(view.byteOffset||0)%4)throw Error('Invalid buffer view');
 const componentBytes={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4},components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};
 for(const a of json.accessors||[]){if(a.bufferView===undefined)continue;const view=json.bufferViews[a.bufferView];if(!view||!componentBytes[a.componentType]||!components[a.type])throw Error('Invalid accessor');const width=componentBytes[a.componentType]*components[a.type],stride=view.byteStride||width,required=(a.byteOffset||0)+(a.count-1)*stride+width;if(required>view.byteLength)throw Error('Accessor outside buffer');}
 for(const image of json.images||[]){if(image.bufferView===undefined)throw Error('External texture is not portable');const v=json.bufferViews[image.bufferView],data=bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);if(image.mimeType==='image/png'&&data.readUInt32BE(0)!==0x89504e47)throw Error('Invalid PNG texture');if(image.mimeType==='image/jpeg'&&(data[0]!==255||data[1]!==216))throw Error('Invalid JPEG texture');}
 const triangles=json.meshes.reduce((n,m)=>n+m.primitives.reduce((p,x)=>p+((json.accessors[x.indices??x.attributes.POSITION]?.count||0)/3),0),0);
 return {bytes:bytes.length,triangles:Math.round(triangles),textures:json.images?.length||0};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'))),plan=JSON.parse(fs.readFileSync(path.join(root,'asset-plan.json'))),entries=[];
 for(const asset of plan.assets){const record=manifest.assets[asset.id];if(!record){if(process.argv.includes('--partial'))continue;throw Error(`Missing asset: ${asset.id}`);}const file=path.join(root,'public',record.url);const result=validateGLB(fs.readFileSync(file));entries.push({id:asset.id,...result});}
 const report={checkedAt:new Date().toISOString(),planned:plan.assets.length,ready:entries.length,optimizedMB:Math.round(entries.reduce((n,a)=>n+a.bytes,0)/1048576*10)/10,maxTriangles:Math.max(...entries.map(a=>a.triangles)),entries};fs.mkdirSync(path.join(root,'qa'),{recursive:true});fs.writeFileSync(path.join(root,'qa/asset-integrity.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,entries:undefined}));
}
