import test from 'node:test';
import assert from 'node:assert/strict';
import {createTacticalMap} from '../src/tactical-map.js';

function fixture(){
 let scene;
 const renderer={setPixelRatio(){},setSize(){},render(value,camera){scene=value;value.updateMatrixWorld();camera.updateMatrixWorld();}};
 const previous=globalThis.devicePixelRatio;globalThis.devicePixelRatio=1;
 const map=createTacticalMap({}, {renderer});globalThis.devicePixelRatio=previous;
 return {map,get scene(){return scene;}};
}
function snapshot(count=120){return {time:1,player:{x:10,y:20,z:30},heading:.6,enemies:Array.from({length:count},(_,i)=>({id:i,kind:i===0?'boss':i===1?'carrier':'scout',x:i===0?900:10+i,y:40,z:30+i})),fleet:{ships:[{id:1,kind:'scout',hp:30,x:0,y:10,z:0},{id:2,hp:0}]},defenses:[],cosmic:[],campaign:{name:'수성'}};}

test('real radar scene retains every dense contact, distant boss, faction colors and bounded live buffer uploads',()=>{
 const f=fixture(),s=snapshot(),view=f.map.update(s),dots=f.scene.children.find(o=>o.isInstancedMesh),lines=f.scene.children.find(o=>o.isLineSegments&&o.type!=='GridHelper'&&o.geometry.attributes.color);
 assert.equal(view.hostiles,120);assert.equal(view.bosses.length,1);assert.equal(dots.count,121);assert.match(view.labels[1].text,/↗ 보스/);assert.match(view.labels[1].text,/↑ 20m/);
 const colors=dots.instanceColor.array;assert.ok(colors[0]>.9&&colors[1]>.6&&colors[2]<.3);assert.ok(colors[3]>.9&&colors[4]<.4);assert.ok(colors[6]>.9&&colors[7]<.1);assert.ok(colors[120*3+1]>.9);
 for(let n=0;n<5;n++){s.time+=.1;for(const e of s.enemies){e.x+=1;e.y+=.5;e.z-=.3;}f.map.update(s);}
 assert.deepEqual(dots.instanceMatrix.updateRanges,[{start:0,count:121*16}]);assert.deepEqual(dots.instanceColor.updateRanges,[{start:0,count:121*3}]);
 for(const name of ['position','color']){const attribute=lines.geometry.attributes[name];assert.deepEqual(attribute.updateRanges,[{start:0,count:lines.geometry.drawRange.count*3}]);assert.ok(attribute.updateRanges[0].count<attribute.array.length/4);for(const value of attribute.array.subarray(0,attribute.updateRanges[0].count))assert.ok(Number.isFinite(value));}
 const before=Array.from(lines.geometry.attributes.position.array),labels=structuredClone(view.labels);f.map.update(s);assert.deepEqual(Array.from(lines.geometry.attributes.position.array),before);assert.deepEqual(view.labels,labels);
});

test('radar resets histories on scope/restart and removes dead contacts without stale draws',()=>{
 const f=fixture(),s=snapshot(72);f.map.update(s);s.time+=.1;s.enemies[1].x+=20;f.map.update(s);const lines=f.scene.children.find(o=>o.isLineSegments&&o.type!=='GridHelper'&&o.geometry.attributes.color);assert.ok(lines.geometry.drawRange.count>72*2);
 assert.equal(f.map.setScope('system'),true);assert.equal(f.map.setScope('invalid'),false);f.map.update(s);assert.equal(lines.geometry.drawRange.count,72*2); // distant boss has no altitude stem; 71 enemies + one escort remain
 s.time=0;s.enemies=[];s.fleet.ships=[];const view=f.map.update(s),dots=f.scene.children.find(o=>o.isInstancedMesh);assert.equal(dots.count,0);assert.equal(lines.geometry.drawRange.count,0);assert.equal(view.bosses.length,0);assert.equal(view.labels.length,1);
});
