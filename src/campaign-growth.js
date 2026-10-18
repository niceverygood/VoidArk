// Per-sortie acquisition only; existing saved tuning ranks keep their full value.
export const CAMPAIGN_TUNING_LIMIT=3;
export function tuningAvailable(sim){return sim.mode!=='campaign'||(sim.campaign?.tuningEarned||0)<CAMPAIGN_TUNING_LIMIT;}
