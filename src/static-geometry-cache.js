// Only merged vertex buffers are shared. Materials, meshes and transforms stay
// owned by each craft. Sources are immutable cached model geometry; edits must
// follow Three's needsUpdate contract, while transforms use exact values.
const entries=new Map();
let builds=0,hits=0,releases=0;
const attributeIds=new WeakMap();let nextAttributeId=1;
function attributeKey(a){if(!a)return '';if(!attributeIds.has(a))attributeIds.set(a,nextAttributeId++);return [attributeIds.get(a),a.itemSize,a.count,a.normalized,a.version,a.array?.constructor.name,a.data?.version||0].join(':');}
export function staticGeometryKey(parts){
 return parts.map(o=>{
  o.updateMatrix();const g=o.geometry;
  return JSON.stringify([g.uuid,attributeKey(g.index),...['position','normal','uv'].map(n=>attributeKey(g.attributes[n])),g.drawRange.start,g.drawRange.count,o.matrix.elements]);
 }).join('|');
}
function bytes(g){const buffers=new Set(Object.values(g.attributes).map(a=>a.array));if(g.index)buffers.add(g.index.array);return [...buffers].reduce((n,a)=>n+a.byteLength,0);}
export function acquireStaticGeometry(parts,build,{shared=true}={}){
 const key=shared?staticGeometryKey(parts):null;let entry=key===null?null:entries.get(key);
 if(entry)hits++;else{const geometry=build();if(!geometry)return null;builds++;entry={geometry,refs:0,key,bytes:bytes(geometry)};if(key!==null)entries.set(key,entry);}
 entry.refs++;let released=false;
 return {geometry:entry.geometry,release(){if(released)return;released=true;releases++;if(--entry.refs===0){if(entry.key!==null)entries.delete(entry.key);entry.geometry.dispose();}}};
}
export function staticGeometryDiagnostics(){return {entries:entries.size,references:[...entries.values()].reduce((n,e)=>n+e.refs,0),bytes:[...entries.values()].reduce((n,e)=>n+e.bytes,0),builds,hits,releases};}
