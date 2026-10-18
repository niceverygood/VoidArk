import {Source} from 'three';
// QA-only alternating submission: same sprites and pixels, independent maps vs shared maps.
export function compareFactionMarkerTextures(scene,render,repeats=3){
 const sprites=[];scene.traverse(o=>{if(o.userData.factionIdentity){const sprite=o.children.find(c=>c.isSprite);if(sprite)sprites.push(sprite);}});const originals=sprites.map(o=>o.material.map),clones=originals.map(t=>{const clone=t.clone();clone.source=new Source(t.image);clone.needsUpdate=true;return clone;}),rows=[];
 const apply=shared=>sprites.forEach((o,i)=>{o.material.map=shared?originals[i]:clones[i];});
 try{for(let i=0;i<repeats;i++){const pair=[];for(const shared of i%2?[true,false]:[false,true]){apply(shared);if(!shared)clones.forEach(t=>{t.needsUpdate=true;});const start=performance.now(),counts=render();pair.push({shared,submitMs:performance.now()-start,...counts});if(!shared){apply(true);clones.forEach(t=>t.dispose());}}rows.push(pair);}return {sprites:sprites.length,uniqueShared:new Set(originals).size,uniqueIndependent:clones.length,sameImages:clones.every((t,i)=>t.image===originals[i].image),rows};}finally{apply(true);clones.forEach(t=>t.dispose());}
}

