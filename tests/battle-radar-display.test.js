import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattleRadarDisplay} from '../src/battle-radar-display.js';

function fixture(){
 const stats={created:0,textWrites:0,styleWrites:0,removed:0};
 const document={createElement(tag){stats.created++;return new Element(tag);}};
 class Element{
  constructor(tag){this.tag=tag;this.ownerDocument=document;this.children=[];this.value='';this.style=new Proxy({},{set:(target,key,value)=>{stats.styleWrites++;target[key]=value;return true;}});}
  set textContent(value){stats.textWrites++;this.value=String(value);}get textContent(){return this.value;}
  set innerHTML(_){assert.fail('live radar must not reparse HTML');}
  replaceChildren(...nodes){this.children=[];for(const node of nodes)this.appendChild(node);}
  appendChild(node){this.children.push(node);node.parent=this;return node;}
  remove(){this.parent.children.splice(this.parent.children.indexOf(this),1);stats.removed++;}
 }
 return {status:new Element('div'),labels:new Element('div'),stats};
}

test('actual radar DOM updater preserves labels across dense changing counts, altitude and boss transitions',()=>{
 const f=fixture(),update=createBattleRadarDisplay(f.status,f.labels),view={hostiles:120,bosses:[{id:1}],labels:[{text:'나',color:'#8bffff',left:50,top:50},{text:'↗ 보스 900m ↑ 80m',color:'#ffda68',left:75,top:20}]};
 update(view);const nodes=[...f.labels.children],initial={...f.stats};
 for(let i=0;i<120;i++)update(view);
 assert.deepEqual(f.stats,initial);assert.deepEqual(f.labels.children,nodes);assert.equal(f.status.children[1].textContent,'적 120 · 보스 1');
 view.hostiles=72;view.labels[1]={text:'★ 보스 240m ↓ 40m',color:'#ffda68',left:30,top:70};update(view);
 assert.equal(f.stats.created,initial.created);assert.equal(f.labels.children[1],nodes[1]);assert.equal(nodes[1].textContent,'★ 보스 240m ↓ 40m');assert.equal(nodes[1].style.left,'clamp(58px,30%,calc(100% - 58px))');assert.equal(nodes[1].style.top,'70%');
 view.bosses=[];view.labels.length=1;update(view);assert.equal(f.labels.children.length,1);assert.equal(f.labels.children[0],nodes[0]);assert.equal(f.stats.removed,1);assert.equal(f.status.children[1].textContent,'적 72 · 보스 0');
 view.labels.push({text:'<enemy & boss>',color:'#ffda68',left:60,top:35});view.bosses=[{id:2}];update(view);assert.equal(f.labels.children[1].textContent,'<enemy & boss>');assert.equal(f.labels.children[0],nodes[0]);
});
