import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {verifyEnemyRelease} from '../tools/verify-enemy-release.mjs';
function fixture(t){
 const base=fileURLToPath(new URL('../work/',import.meta.url));fs.mkdirSync(base,{recursive:true});const folder=fs.mkdtempSync(path.join(base,'enemy-release-test-')),buildDir=path.join(folder,'build'),gameDir=path.join(folder,'game'),id='enemy-mercury-fighter';
 t.after(()=>{const target=fs.realpathSync(folder),allowed=fs.realpathSync(base);assert.ok(target.startsWith(allowed+path.sep));fs.rmSync(target,{recursive:true,force:true});});
 const files={'index.html':'<script src="/assets/game.js"></script>','planet-enemies-preview.html':'<script src="/assets/enemies.js"></script>','assets/game.js':'game','assets/enemies.js':'enemies','assets/meshy/manifest.json':JSON.stringify({assets:{[id]:{status:'ready',url:'/assets/meshy/'+id+'.glb',thumbnail:'/assets/meshy/'+id+'.png'}}}),['assets/meshy/'+id+'.glb']:'model fixture',['assets/meshy/'+id+'.png']:'thumbnail fixture'};
 for(const directory of [buildDir,gameDir])for(const [file,bytes] of Object.entries(files)){const target=path.join(directory,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);}return {buildDir,gameDir,plan:{assets:[{id}]}};
}
test('enemy release audit verifies copied models, thumbnails and referenced compiled files',t=>{const data=fixture(t),report=verifyEnemyRelease(data);assert.equal(report.models,1);assert.equal(report.checkedFiles,7);});
test('enemy release audit rejects a corrupted model and missing compiled file',t=>{const data=fixture(t);fs.writeFileSync(path.join(data.gameDir,'assets/meshy/enemy-mercury-fighter.glb'),'different');assert.throws(()=>verifyEnemyRelease(data),/content mismatch.*enemy-mercury-fighter.glb/);fs.unlinkSync(path.join(data.gameDir,'assets/game.js'));assert.throws(()=>verifyEnemyRelease(data),/Missing release file: assets\/game.js/);});
test('enemy release audit includes indirect campaign chunks and their fonts',t=>{
 const data=fixture(t);for(const file of ['solar-campaign-abc.js','space-reflections-def.js','space-grotesk.woff2']){
  fs.writeFileSync(path.join(data.buildDir,'assets',file),'indirect dependency');
  assert.throws(()=>verifyEnemyRelease(data),new RegExp('Missing release file: assets/'+file.replaceAll('.','\\.')));
  fs.writeFileSync(path.join(data.gameDir,'assets',file),'indirect dependency');
 }
 assert.equal(verifyEnemyRelease(data).checkedFiles,10);
 fs.writeFileSync(path.join(data.gameDir,'assets/solar-campaign-abc.js'),'old version');
 assert.throws(()=>verifyEnemyRelease(data),/content mismatch.*solar-campaign/);
});
