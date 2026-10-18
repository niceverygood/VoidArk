// Offline checks for the uncompressed game-ready planetary GLBs.
export function validateEnemyGeometry(bytes){
 let json,bin;for(let offset=12;offset<bytes.length;){const length=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4);if(type===0x4e4f534a)json=JSON.parse(bytes.subarray(offset+8,offset+8+length));if(type===0x004e4942)bin=bytes.subarray(offset+8,offset+8+length);offset+=8+length;}
 if(!json||!bin)throw Error('Missing geometry chunks');
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],attributeVertices={NORMAL:0,TEXCOORD_0:0};let vertices=0,primitives=0;
 for(const mesh of json.meshes||[])for(const primitive of mesh.primitives){
  const a=json.accessors[primitive.attributes.POSITION],view=json.bufferViews[a?.bufferView];
  if(!view||a.type!=='VEC3'||a.componentType!==5126||a.sparse||!Number.isInteger(a.count)||a.count<=0)throw Error('Unsupported planetary position accessor');
  const start=(view.byteOffset||0)+(a.byteOffset||0),stride=view.byteStride||12;
  for(let i=0;i<a.count;i++)for(let axis=0;axis<3;axis++){const value=bin.readFloatLE(start+i*stride+axis*4);if(!Number.isFinite(value))throw Error('Non-finite planetary position');min[axis]=Math.min(min[axis],value);max[axis]=Math.max(max[axis],value);}
  for(const [name,width,type] of [['NORMAL',3,'VEC3'],['TEXCOORD_0',2,'VEC2']]){
   const id=primitive.attributes[name];if(id===undefined)continue;
   const attribute=json.accessors[id],buffer=json.bufferViews[attribute?.bufferView];
   if(!buffer||attribute.type!==type||attribute.componentType!==5126||attribute.sparse)throw Error('Unsupported planetary '+name+' accessor');
   if(attribute.count!==a.count)throw Error('Planetary '+name+' vertex count mismatch');
   const offset=(buffer.byteOffset||0)+(attribute.byteOffset||0),step=buffer.byteStride||width*4;
   for(let i=0;i<attribute.count;i++)for(let component=0;component<width;component++)if(!Number.isFinite(bin.readFloatLE(offset+i*step+component*4)))throw Error('Non-finite planetary '+name);
   attributeVertices[name]+=attribute.count;
  }
  if(primitive.indices!==undefined){const index=json.accessors[primitive.indices],iv=json.bufferViews[index?.bufferView],width=({5121:1,5123:2,5125:4})[index?.componentType];if(!iv||!width||index.type!=='SCALAR'||index.sparse)throw Error('Unsupported planetary indices');const read=width===1?'readUInt8':width===2?'readUInt16LE':'readUInt32LE',offset=(iv.byteOffset||0)+(index.byteOffset||0);for(let i=0;i<index.count;i++)if(bin[read](offset+i*(iv.byteStride||width))>=a.count)throw Error('Planetary index outside vertex range');}
  vertices+=a.count;primitives++;
 }
 const extent=max.map((value,axis)=>value-min[axis]);if(!vertices||!extent.every(Number.isFinite)||Math.max(...extent)<=0)throw Error('Empty planetary bounds');
 for(const node of json.nodes||[])for(const key of ['matrix','translation','rotation','scale'])if(node[key]&&!node[key].every(Number.isFinite))throw Error('Non-finite planetary transform');
 return {vertices,primitives,attributeVertices,localBounds:{min,max,extent}};
}
