import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function verifyEnemyRelease({buildDir,gameDir,plan}){
 const files=new Set(['index.html','planet-enemies-preview.html','assets/meshy/manifest.json']);
 for(const page of ['index.html','planet-enemies-preview.html']){
  const html=fs.readFileSync(path.join(buildDir,page),'utf8');let scripts=0;
  for(const match of html.matchAll(/(?:src|href)=["'](\/assets\/[A-Za-z0-9._-]+\.(?:js|css))["']/g)){files.add(match[1].slice(1));if(match[1].endsWith('.js'))scripts++;}
  if(!scripts)throw Error('No compiled scripts in '+page);
 }
 // Vite splits campaign/model code into indirect chunks. Audit every current
 // compiled output, including CSS fonts, without requiring old release chunks.
 for(const entry of fs.readdirSync(path.join(buildDir,'assets'),{withFileTypes:true})){
  if(entry.isFile()&&/^[A-Za-z0-9._-]+\.(?:js|css|woff2?|ttf|otf)$/.test(entry.name))files.add('assets/'+entry.name);
 }
 const manifest=JSON.parse(fs.readFileSync(path.join(buildDir,'assets/meshy/manifest.json')));
 for(const asset of plan.assets){const entry=manifest.assets[asset.id];if(!entry||entry.status!=='ready')throw Error('Missing ready enemy '+asset.id);for(const url of [entry.url,entry.thumbnail]){if(!/^\/assets\/meshy\/[a-z0-9-]+\.(glb|png)$/.test(url||''))throw Error('Invalid enemy asset path '+asset.id);files.add(url.slice(1));}}
 const entries=[];
 for(const file of files){const source=fs.readFileSync(path.join(buildDir,file));let target;try{target=fs.readFileSync(path.join(gameDir,file));}catch{throw Error('Missing release file: '+file);}const expected=hash(source);if(hash(target)!==expected)throw Error('Release content mismatch: '+file);entries.push({file,bytes:source.length,sha256:expected});}
 return {checkedAt:new Date().toISOString(),models:plan.assets.length,checkedFiles:entries.length,entries};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const gameDir=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'release/VOID-ARK-win-x64-1791852745110/resources/app/game');
 const report=verifyEnemyRelease({buildDir:path.join(root,'dist'),gameDir,plan:JSON.parse(fs.readFileSync(path.join(root,'enemy-asset-plan.json')))});
 fs.mkdirSync(path.join(root,'qa'),{recursive:true});fs.writeFileSync(path.join(root,'qa/enemy-release-integrity.json'),JSON.stringify({...report,gameDir},null,2));console.log(JSON.stringify({...report,entries:undefined}));
}
