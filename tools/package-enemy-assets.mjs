import fs from 'node:fs';
import path from 'node:path';
const outputs=process.argv[2];if(!path.isAbsolute(outputs))throw Error('Absolute output required');
const plan=JSON.parse(fs.readFileSync('enemy-asset-plan.json')),manifest=JSON.parse(fs.readFileSync('public/assets/meshy/manifest.json'));
const root=path.join(outputs,'VOID-ARK-enemy-3D');fs.mkdirSync(path.join(root,'models'),{recursive:true});fs.mkdirSync(path.join(root,'previews'),{recursive:true});
const assets={};for(const a of plan.assets){const m=manifest.assets[a.id];if(!m)throw Error('Missing '+a.id);fs.copyFileSync('public'+m.url,path.join(root,'models',a.id+'.glb'));fs.copyFileSync('public'+m.thumbnail,path.join(root,'previews',a.id+'.png'));assets[a.id]={...m,url:'models/'+a.id+'.glb',thumbnail:'previews/'+a.id+'.png',planet:a.planet,role:a.role,name:a.name};}
fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify({version:1,assets},null,2));fs.copyFileSync('qa/enemy-assets-integrity.json',path.join(root,'검수기록.json'));
fs.writeFileSync(path.join(root,'처음읽기.txt'),'VOID ARK · 행성별 적 3D 에셋\n17개 행성 × 전투함(fighter) / 지휘함·보스(capital) / 궤도 요새(fortress) = 51종\nMeshy-6 preview→refine, PBR 금속·거칠기·노멀·발광 재질. 원본 2K는 게임 프로젝트 asset-sources에 보관. 이 패키지는 게임용 텍스처를 최대768px로 최적화한 내장재질 GLB입니다.\nmodels/: 3D GLB, previews/: 공급자 대표 이미지, manifest.json: 행성·역할 매핑.\n게임 내 엔진, 역할별 무장, 보스 체력비례 선체분절은 런타임에서 결합합니다.\n');console.log({packaged:plan.assets.length,root});
