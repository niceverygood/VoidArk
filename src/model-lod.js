import * as THREE from 'three';
// Cached models own these shared alternatives; individual ships only select them.
function clusteredLOD(geometry,gridSize=48){
 
 if(geometry.attributes.position.count<3000||geometry.groups.length)return;
 geometry.computeBoundingBox();const box=geometry.boundingBox,size=box.getSize(new THREE.Vector3()),step=Math.max(size.x,size.y,size.z)/gridSize;
 if(!step)return;
 const p=geometry.attributes.position,remap=new Uint32Array(p.count),cells=new Map(),representatives=[];
 for(let i=0;i<p.count;i++){const key=[Math.round((p.getX(i)-box.min.x)/step),Math.round((p.getY(i)-box.min.y)/step),Math.round((p.getZ(i)-box.min.z)/step)].join(',');let id=cells.get(key);if(id===undefined){id=representatives.length;cells.set(key,id);representatives.push(i);}remap[i]=id;}
 const indices=[],source=geometry.index,count=source?source.count:p.count;
 for(let i=0;i<count;i+=3){const a=remap[source?source.getX(i):i],b=remap[source?source.getX(i+1):i+1],c=remap[source?source.getX(i+2):i+2];if(a!==b&&b!==c&&a!==c)indices.push(a,b,c);}
 if(indices.length>=count*.8)return;
 const lod=new THREE.BufferGeometry();for(const [name,attr] of Object.entries(geometry.attributes)){const data=new Float32Array(representatives.length*attr.itemSize);representatives.forEach((i,j)=>{for(let k=0;k<attr.itemSize;k++)data[j*attr.itemSize+k]=attr.array[i*attr.itemSize+k];});lod.setAttribute(name,new THREE.BufferAttribute(data,attr.itemSize));}lod.setIndex(indices);lod.boundingSphere=geometry.boundingSphere?.clone()||null;return lod;
}


export function prepareModelLOD(geometry){
 if(geometry.userData.lodPrepared)return;geometry.userData.lodPrepared=true;
 geometry.computeBoundingSphere();const medium=clusteredLOD(geometry,48);if(medium)geometry.userData.combatLOD=medium;
 const distant=clusteredLOD(geometry,24);if(distant&&(!medium||distant.index.count<medium.index.count*.8))geometry.userData.distantLOD=distant;else distant?.dispose();
}
