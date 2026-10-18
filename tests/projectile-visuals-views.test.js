import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {ProjectileVisuals} from '../src/projectile-visuals.js';

const source=readFileSync(new URL('../work/unit2before/projectile-visuals.js',import.meta.url),'utf8').replace(/from '(\.\/[^']+)'/g,(_,path)=>`from '${new URL('../src/'+path.slice(2),import.meta.url).href}'`).replace(/from 'three'/g,`from '${import.meta.resolve('three')}'`);
const {ProjectileVisuals:Before}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const assets=()=>({ready:Promise.resolve([]),release(){}});
const bits=array=>new Uint32Array(array.buffer,array.byteOffset,array.byteLength/4);
const attrs=p=>[p.geometry.attributes.aFade,p.mesh.instanceMatrix,p.mesh.instanceColor];
function same(a,b,label){
 assert.equal(a.cursor,b.cursor,label+' cursor');assert.equal(a.mesh.count,b.mesh.count,label+' count');
 for(const key of ['alpha','renderAlpha','life','max','matrices','tints'])assert.deepEqual(bits(a[key]),bits(b[key]),label+' '+key);
 const aa=attrs(a),bb=attrs(b);for(let i=0;i<aa.length;i++){assert.deepEqual(bits(aa[i].array),bits(bb[i].array),label+' gpu '+i);assert.deepEqual(aa[i].updateRanges,bb[i].updateRanges,label+' ranges '+i);assert.equal(aa[i].version,bb[i].version,label+' version '+i);}
}

test('actual original producer stays Uint32-identical through six projectile looks, pool wrap, expiry, clear and relaunch',()=>{
 const a=new ProjectileVisuals(new THREE.Scene(),{acquireAssets:assets}),b=new Before(new THREE.Scene(),{acquireAssets:assets});
 const definitions=[['missile',true,null],['missile',true,'barrage'],['enemyMissile',false,null],['boss',false,null],['cannon',true,null],['enemy',false,null]];
 const shots=definitions.map(([type,friendly,visualVariant],i)=>({id:100+i,type,friendly,visualVariant,position:{x:i,y:i*.2,z:-i},direction:{x:.7,y:.2,z:-.1}}));
 const roots=shots.map(shot=>[a.create(shot),b.create(shot)]);let checkpoints=0;
 const emit=(frame,dt,active=true)=>{for(let i=0;i<shots.length;i++){const shot=shots[i];shot.position.x+=.08+i*.005;shot.position.y=Math.sin(frame*.01+i)*.4;shot.position.z-=.03;shot.direction.y=Math.cos(frame*.03)*.2;for(const [n,p] of [a,b].entries())p.update(roots[i][n],shot,dt,frame*.016,active);}};
 for(let frame=0;frame<1200;frame++){emit(frame,frame%19===0?0:.016,frame%17!==0);if(frame%10===0){for(const p of [a,b])p.tick(frame%70===0?0:.08);same(a,b,'frame '+frame);checkpoints++;}}
 assert.ok(a.cursor>a.capacity);same(a,b,'wrapped');for(const p of [a,b])p.tick(3);same(a,b,'expired');assert.equal(a.mesh.count,0);
 const views=a.matrixViews.slice(),tints=a.tintViews.slice();for(const p of [a,b]){p.clear();p.tick(0);}same(a,b,'cleared');
 for(let frame=1200;frame<1240;frame++){emit(frame,.016);for(const p of [a,b])p.tick(.016);same(a,b,'relaunch '+frame);checkpoints++;}
 assert.ok(a.matrixViews.every((view,i)=>view===views[i]));assert.ok(a.tintViews.every((view,i)=>view===tints[i]));assert.ok(checkpoints>=160);
 roots.forEach(pair=>pair.forEach(root=>root.userData.dispose()));a.dispose();b.dispose();
});

test('fixed views alias only owned pool buffers and compaction preserves NaN payload and signed-zero bits without new views',()=>{
 const a=new ProjectileVisuals(new THREE.Scene(),{acquireAssets:assets}),b=new Before(new THREE.Scene(),{acquireAssets:assets});
 for(const p of [a,b]){p.cursor=p.capacity+11;p.life.fill(0);for(const i of [0,2,127,2048,4095]){p.life[i]=p.max[i]=1;
  const matrix=bits(p.matrices),tint=bits(p.tints);for(let k=0;k<16;k++)matrix[i*16+k]=k%4===0?0x80000000:k%4===1?0x7fc12345:k%4===2?0xffc54321:0x3f800000+i;
  tint[i*3]=0x7fc12345;tint[i*3+1]=0x80000000;tint[i*3+2]=0x3f800000;
 }}
 for(const i of [0,2,127,2048,4095]){assert.equal(a.matrixViews[i].buffer,a.matrices.buffer);assert.equal(a.matrixViews[i].byteOffset,a.matrices.byteOffset+i*16*4);assert.equal(a.matrixViews[i].length,16);assert.equal(a.tintViews[i].buffer,a.tints.buffer);assert.equal(a.tintViews[i].length,3);}
 const nativeSubarray=Float32Array.prototype.subarray;let views=0;
 try{Float32Array.prototype.subarray=function(...args){views++;return nativeSubarray.apply(this,args);};a.tick(0);}finally{Float32Array.prototype.subarray=nativeSubarray;}
 b.tick(0);assert.equal(views,0);same(a,b,'payload');assert.equal(a.mesh.count,5);a.dispose();b.dispose();
});

test('reused pool views preserve borrowed asset ownership and release owned trail resources exactly once',async()=>{
 const sharedGeometry=new THREE.BoxGeometry(),texture=new THREE.Texture(),material=new THREE.MeshStandardMaterial({map:texture}),source=new THREE.Group();source.add(new THREE.Mesh(sharedGeometry,material));
 let sharedDisposed=0,releases=0,ownedDisposed=0;for(const resource of [sharedGeometry,texture,material])resource.addEventListener('dispose',()=>sharedDisposed++);
 const a=new ProjectileVisuals(new THREE.Scene(),{acquireAssets:()=>({ready:Promise.resolve([source]),release(){releases++;}})});await a.preparationReady;
 for(const resource of [a.geometry,a.material])resource.addEventListener('dispose',()=>ownedDisposed++);
 const view=a.matrixViews[0],tint=a.tintViews[0];a.cursor=1;a.life[0]=a.max[0]=1;a.tick(.01);a.clear();a.tick(0);
 assert.equal(a.matrixViews[0],view);assert.equal(a.tintViews[0],tint);assert.equal(source.children.length,1);assert.equal(a.preparationResources().objects[0].geometry,sharedGeometry);assert.equal(a.preparationResources().objects[0].material,material);
 a.dispose();a.dispose();assert.equal(releases,1);assert.equal(ownedDisposed,2);assert.equal(sharedDisposed,0);sharedGeometry.dispose();texture.dispose();material.dispose();
});
