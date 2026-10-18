import {captainFor} from './enemy-captains.js';
import {civilizationForPlanet,civilizationForOwner,DOCTRINES} from './civilizations.js';
export function civilizationCaptain(p,owner){const n=civilizationForOwner(owner)||civilizationForPlanet(p),original=captainFor(p);return {...original,...DOCTRINES[n.doctrine],id:n.id+'-'+original.id,title:n.name+' 원정 사령관',color:n.color,trait:n.doctrine+' 함대 · '+n.goal,history:n.history+'. '+original.history,nation:n.id};}
