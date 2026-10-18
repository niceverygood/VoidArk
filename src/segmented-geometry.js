import * as THREE from 'three';

// Preserve triangle order, group materials and the existing section boundaries.
// Count first so each output attribute is allocated once, instead of creating
// an entries array for every vertex and growing temporary number arrays.
export function splitBossGeometry(geometry,material,parts,ordered=[6,0,1,2,3,4,5]){
 const position=geometry.attributes.position,attributes=Object.entries(geometry.attributes);
 const triangles=position.count/3,assignments=new Uint32Array(triangles),buckets=[],byPart=new Map();
 for(let v=0;v<position.count;v+=3){
  const z=(position.getZ(v)+position.getZ(v+1)+position.getZ(v+2))/3;
  let section=0;while(section<6&&z>(parts[ordered[section]].position.z+parts[ordered[section+1]].position.z)/2)section++;
  const partIndex=ordered[section],group=geometry.groups.find(g=>v>=g.start&&v<g.start+g.count),m=Array.isArray(material)?material[group?.materialIndex||0]:material;
  let materials=byPart.get(partIndex);if(!materials)byPart.set(partIndex,materials=new Map());
  let bucket=materials.get(m.uuid);if(!bucket){bucket={index:buckets.length,part:parts[partIndex],material:m,count:0,cursor:0};materials.set(m.uuid,bucket);buckets.push(bucket);}
  assignments[v/3]=bucket.index;bucket.count+=3;
 }
 for(const bucket of buckets)bucket.attributes=attributes.map(([name,a])=>({name,source:a,data:new Float32Array(bucket.count*a.itemSize)}));
 for(let v=0;v<position.count;v+=3){
  const bucket=buckets[assignments[v/3]];
  for(const {name,source:a,data} of bucket.attributes){
   const offset=bucket.cursor*a.itemSize;
   for(let j=0;j<3;j++)for(let c=0;c<a.itemSize;c++)data[offset+j*a.itemSize+c]=a.getComponent(v+j,c)-(name==='position'?bucket.part.position.getComponent(c):0);
  }
  bucket.cursor+=3;
 }
 const results=[];
 try{
  for(const bucket of buckets){const g=new THREE.BufferGeometry();results.push({geometry:g,material:bucket.material,part:bucket.part});for(const {name,source,data} of bucket.attributes)g.setAttribute(name,new THREE.BufferAttribute(data,source.itemSize));g.computeBoundingSphere();}
  return results;
 }catch(error){for(const item of results)item.geometry.dispose();throw error;}
}
