const choices={hull:['fighter','capital','fortress','warden','boss'],role:['striker','guard','gunner','support'],view:['fit','compare','far'],damage:['0','2','4','5'],angle:['0','90','180','270']};
export function readPlanetGalleryState(search){
 const params=new URLSearchParams(search),state={};
 for(const [key,values] of Object.entries(choices))state[key]=values.includes(params.get(key))?params.get(key):values[0];
 return state;
}
export function planetGalleryURL(href,state){
 const url=new URL(href);
 for(const [key,values] of Object.entries(choices)){
  const value=values.includes(state[key])?state[key]:values[0];
  if(value===values[0])url.searchParams.delete(key);else url.searchParams.set(key,value);
 }
 return url.href;
}
