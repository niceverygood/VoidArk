export const SOUND_MIX={
 cannon:{gain:.36,tail:.32,fade:.09},missile:{gain:.43,tail:.78,fade:.2},enemyMissile:{gain:.48,tail:.7,fade:.18},
 hit:{gain:.22,tail:.45,fade:.12},explosion:{gain:.62,tail:2.2,fade:.3},
 barrage:{gain:.50,tail:3,fade:.35},
 damage:{gain:.62,tail:.8,fade:.12},shield:{gain:.42,tail:.75,fade:.12},
 pickup:{gain:.08,tail:.3,fade:.07},click:{gain:.16,tail:.2,fade:.04},
 alert:{gain:.26,tail:.62,fade:.12},boss:{gain:.48,tail:2.4,fade:.3},
 boost:{gain:.22,tail:.55,fade:.2},laser:{gain:.20,tail:.38,fade:.14},chain:{gain:.34,tail:.7,fade:.12},
 upgrade:{gain:.28,tail:1.4,fade:.2}
};
// Overlap the generated loop's end/start; the output wraps on adjacent PCM samples.
export function seamlessLoop(data,sampleRate) {
 const overlap=Math.min(Math.floor(sampleRate*.35),Math.floor(data.length/4));
 if(overlap<2)return data.slice();
 const output=new Float32Array(data.length-overlap),middle=data.length-2*overlap;
 output.set(data.subarray(overlap,data.length-overlap));
 for(let i=0;i<overlap;i++){const t=i/(overlap-1);output[middle+i]=data[data.length-overlap+i]*(1-t)+data[i]*t;}
 return output;
}




