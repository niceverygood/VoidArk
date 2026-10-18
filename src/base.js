import {mountAsset} from './asset-library.js';
import * as THREE from 'three';
import { BASE_FACILITIES, cleanBase } from './base-tech.js';

function facilityShape(group,index,rank,material,glow,scale=1){
  const add=(g,m,p)=>{const o=new THREE.Mesh(g,m);o.position.set(...p);group.add(o);return o;};
  for(let level=0;level<rank;level++){
    const y=level*3*scale;
    const body=index%3===0?new THREE.CylinderGeometry(3*scale,4*scale,2*scale,6):index%3===1?new THREE.BoxGeometry(5*scale,2*scale,6*scale):new THREE.SphereGeometry(3*scale,12,8);
    add(body,material,[0,y,0]);
    const ring=add(new THREE.TorusGeometry((3.3+level*.2)*scale,.2*scale,4,20),glow,[0,y+1.2*scale,0]);ring.rotation.x=Math.PI/2;
    for(const side of [-1,1])add(new THREE.BoxGeometry(.35*scale,(2+index*.25)*scale,.35*scale),glow,[side*2*scale,y+2*scale,-2*scale]);
  }
}

export function createShipSupport(ship,input,stage=0){
  const levels=cleanBase(input),support=new THREE.Group(),materials=[],geometries=[];
  BASE_FACILITIES.forEach((d,i)=>{if(!levels[d.id])return;const group=new THREE.Group();support.add(group);group.position.set((i%2?1:-1)*(2.5+stage*1.2),.8,Math.floor(i/2)*2.3-4);
    const hull=new THREE.MeshStandardMaterial({color:0xa3b5b7,metalness:.6,roughness:.4}),glow=new THREE.MeshBasicMaterial({color:d.color});materials.push(hull,glow);facilityShape(group,i,levels[d.id],hull,glow,.18+stage*.06);mountAsset(ship,`facility-${d.id}`,{parent:group,size:1.1+levels[d.id]*.25+stage*.25,hide:group.children.filter(o=>o.isMesh)});
  });
  (ship.userData.visualRoot||ship).add(support);support.traverse(o=>{if(o.isMesh)geometries.push(o.geometry);});
  ship.userData.baseSupport=support;
  const dispose=ship.userData.dispose;ship.userData.dispose=()=>{dispose?.();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());};
}
export function createBase(scene,position){
  const root=new THREE.Group();root.position.set(position.x,position.y,position.z);scene.add(root);
  const hull=new THREE.MeshStandardMaterial({color:0x8197a2,metalness:.7,roughness:.4});
  const light=new THREE.MeshBasicMaterial({color:0x60e4d4});
  const add=(geometry,material,x,y,z)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);root.add(mesh);return mesh;};
  const ring=add(new THREE.TorusGeometry(20,1,8,64),hull,0,-5,0);ring.rotation.x=Math.PI/2;
  const beacon=add(new THREE.TorusGeometry(17,.18,6,64),light,0,-4.3,0);beacon.rotation.x=Math.PI/2;
  for(let i=0;i<6;i++){const a=i*Math.PI/3,x=Math.cos(a)*23,z=Math.sin(a)*23;const tower=add(new THREE.BoxGeometry(5,10,7),hull,x,-4,z);tower.rotation.y=-a;add(new THREE.BoxGeometry(.8,3,.8),light,x,3,z);}
  const deck=add(new THREE.CylinderGeometry(10,12,1.5,6),hull,0,-6,0);
  const geometry=new THREE.RingGeometry(5,6,32);const pad=add(geometry,new THREE.MeshBasicMaterial({color:0x76ffcc,side:THREE.DoubleSide,transparent:true,opacity:.55}),0,-5.1,0);pad.rotation.x=-Math.PI/2;
  const expansions=new THREE.Group();root.add(expansions);mountAsset(root,'orbital-dock',{size:58,position:[0,-7,0],hide:root.children.filter(o=>o.isMesh&&o.material===hull)});let previous='';
  return {update(time,input){beacon.material.color.setHSL(.47,.7,.55+Math.sin(time*2)*.12);
    const levels=cleanBase(input),key=JSON.stringify(levels);if(key===previous)return;previous=key;
    for(const group of [...expansions.children])group.userData.dispose?.();const resources=new Set();expansions.traverse(o=>{if(o.isMesh){resources.add(o.geometry);resources.add(o.material);}});for(const r of resources)r.dispose();expansions.clear();
    BASE_FACILITIES.forEach((d,i)=>{if(!levels[d.id])return;const a=i*Math.PI/4,group=new THREE.Group();group.position.set(Math.cos(a)*32,-4,Math.sin(a)*32);expansions.add(group);
      const material=new THREE.MeshStandardMaterial({color:0x718d9d,metalness:.65,roughness:.4}),glow=new THREE.MeshBasicMaterial({color:d.color});facilityShape(group,i,levels[d.id],material,glow);const fallback=group.children.filter(o=>o.isMesh);for(let n=0;n<levels[d.id];n++)mountAsset(group,`facility-${d.id}`,{size:10+levels[d.id]*2,position:[(n-(levels[d.id]-1)/2)*10,levels[d.id],0],hide:n===0?fallback:[]});
    });
  },root};
}
