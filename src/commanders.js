import {civilizationCaptain} from './civilization-captains.js';
import {civilizationForPlanet} from './civilizations.js';
import {captainFor} from './enemy-captains.js';
import {FACTIONS,regionFor} from './universe.js';
export function commanderDefinition(planet,rank,ownerFaction){
 const faction=Number.isInteger(ownerFaction)&&ownerFaction>=1&&ownerFaction<=5?ownerFaction:regionFor(planet).faction,final=planet.id==='planet-95'&&rank==='crown',lord=rank==='crown';
 const captain=civilizationCaptain(planet,typeof ownerFaction==='string'?ownerFaction:undefined);const names=['방주 감시자','헬릭스 집정관','결정 대사제','철혈 감독관','군락 여왕','망각 집행자'];
 return {personality:captain,quote:captain.quote,name:final?'최종보스 · 오블리비언 원핵':(lord?'행성 우두머리 · ':'중간보스 · ')+captain.name+' · '+captain.title+' · 지휘관 / '+planet.name,rank,final,faction,scale:final?1.65:lord?1.15:.72,hp:(lord?650:300)+planet.level*(lord?120:65),damage:12+planet.level*(lord?1.1:.65),pattern:faction%3,color:captain.color};
}
