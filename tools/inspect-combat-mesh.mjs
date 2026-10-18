import fs from 'node:fs';
const id=process.argv[2]||'fx-ark-missile',bytes=fs.readFileSync(`public/assets/meshy/${id}.glb`),json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12))),bo=20+bytes.readUInt32LE(12)+8,bin=bytes.subarray(bo),p=json.meshes[0].primitives[0];
const access=i=>{const a=json.accessors[i],v=json.bufferViews[a.bufferView],C=a.componentType===5126?Float32Array:a.componentType===5125?Uint32Array:Uint16Array;return new C(bin.buffer,bin.byteOffset+(v.byteOffset||0)+(a.byteOffset||0),a.count*(a.type==='VEC3'?3:1));};
const pos=access(p.attributes.POSITION),idx=access(p.indices),parent=Array.from({length:pos.length/3},(_,i)=>i),seen=new Map();
function find(a){while(parent[a]!==a){parent[a]=parent[parent[a]];a=parent[a];}return a;}
function union(a,b){parent[find(a)]=find(b);}
for(let i=0;i<parent.length;i++){const key=[0,1,2].map(a=>Math.round(pos[i*3+a]*10000)).join(',');if(seen.has(key))union(i,seen.get(key));else seen.set(key,i);}
for(let i=0;i<idx.length;i+=3){union(idx[i],idx[i+1]);union(idx[i],idx[i+2]);}
const components=new Map();for(let i=0;i<idx.length;i+=3){const k=find(idx[i]);let c=components.get(k);if(!c){c={root:k,count:0,min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};components.set(k,c);}c.count++;for(let j=0;j<3;j++)for(let a=0;a<3;a++){c.min[a]=Math.min(c.min[a],pos[idx[i+j]*3+a]);c.max[a]=Math.max(c.max[a],pos[idx[i+j]*3+a]);}}
console.log(JSON.stringify([...components.values()].sort((a,b)=>b.count-a.count).slice(0,25),null,2));
if(process.argv.includes('--clean-largest')){
 const keep=[...components.values()].sort((a,b)=>b.count-a.count)[0].root,triangles=[];for(let i=0;i<idx.length;i+=3)if(find(idx[i])===keep)triangles.push(idx[i],idx[i+1],idx[i+2]);
 const vertices=[...new Set(triangles)].sort((a,b)=>a-b),mapping=new Map(vertices.map((v,i)=>[v,i]));
 const types={SCALAR:1,VEC2:2,VEC3:3,VEC4:4},sizes={5126:4,5125:4,5123:2,5121:1};
 for(const ai of Object.values(p.attributes)){const a=json.accessors[ai],v=json.bufferViews[a.bufferView],size=types[a.type]*sizes[a.componentType],offset=(v.byteOffset||0)+(a.byteOffset||0),original=Buffer.from(bin.subarray(offset,offset+a.count*size));for(let n=0;n<vertices.length;n++)original.copy(bin,offset+n*size,vertices[n]*size,(vertices[n]+1)*size);a.count=vertices.length;if(a.type==='VEC3'&&ai===p.attributes.POSITION){a.min=[0,1,2].map(c=>Math.min(...vertices.map(i=>pos[i*3+c])));a.max=[0,1,2].map(c=>Math.max(...vertices.map(i=>pos[i*3+c])));}}
 // Position bounds are read again after compaction, because buffer writes mutate the views.
 const pa=json.accessors[p.attributes.POSITION],pv=json.bufferViews[pa.bufferView],packed=new Float32Array(bin.buffer,bin.byteOffset+(pv.byteOffset||0)+(pa.byteOffset||0),vertices.length*3);pa.min=[0,1,2].map(c=>Math.min(...Array.from({length:vertices.length},(_,i)=>packed[i*3+c])));pa.max=[0,1,2].map(c=>Math.max(...Array.from({length:vertices.length},(_,i)=>packed[i*3+c])));
 for(let i=0;i<triangles.length;i++)idx[i]=mapping.get(triangles[i]);const ia=json.accessors[p.indices];ia.count=triangles.length;ia.min=[0];ia.max=[vertices.length-1];
 const raw=Buffer.from(JSON.stringify(json)),j=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]),head=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);head.write('glTF');head.writeUInt32LE(2,4);head.writeUInt32LE(28+j.length+bin.length,8);jh.writeUInt32LE(j.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync(`public/assets/meshy/${id}.glb`,Buffer.concat([head,jh,j,bh,bin]));console.log('Removed detached generation artifact; retained '+triangles.length/3+' triangles');
}
