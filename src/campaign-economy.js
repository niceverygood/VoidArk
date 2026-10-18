// Campaign-only permanent purchases: combat level-up choices remain free.
export const CAMPAIGN_EQUIPMENT_COSTS=Object.freeze([40,70,120,190,280]);
export const LATE_EQUIPMENT_COSTS=Object.freeze([40,70,180,340,560]);
export const BEGINNER_REPAIR_CAP=8;
export const BEGINNER_SHIELD_CAP=4;
export function beginnerSupport(sim){return !!sim.campaignDock&&(sim.meta.campaign?.cleared||0)<3;}
export function permanentEquipmentCost(level,discount=0,late=false){return Math.ceil((late?LATE_EQUIPMENT_COSTS:CAMPAIGN_EQUIPMENT_COSTS)[Math.min(4,Math.max(0,level))]*Math.max(.5,1-discount));}
export function equipmentPriceSteps(sim){return (sim.meta.campaign?.cleared||0)>=3?LATE_EQUIPMENT_COSTS:CAMPAIGN_EQUIPMENT_COSTS;}
export function campaignFleetRepairUnits(sim){return sim.campaignDock&&(sim.meta.campaign?.cleared||0)>=3?sim.fleet.reduce((n,a)=>n+Math.max(0,a.maxHp-a.hp),0)*.02:0;}
export function preparationBudget(sim){const c=sim.baseServices(),maintenanceNeeded=sim.player.boost<100||Object.values(sim.skillTimers).some(t=>t>0)||sim.fleet.some(a=>a.hp<a.maxHp);return {...c,maintenance:maintenanceNeeded?c.maintenance:0,reserve:c.repair+c.shield+(maintenanceNeeded?c.maintenance:0)};}
export function supportedServiceCosts(sim,costs){return beginnerSupport(sim)?{...costs,repair:Math.min(BEGINNER_REPAIR_CAP,costs.repair),shield:Math.min(BEGINNER_SHIELD_CAP,costs.shield)}:costs;}
