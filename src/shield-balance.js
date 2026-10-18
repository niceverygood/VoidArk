export const SHIELD_RECOVERY_DELAY=7;
export function shieldRecoveryRate(maxShield,rank=0,tech=0,vessel=0){return Math.min(1.5+rank*.6+(tech+vessel)*.5,maxShield*.025);}
