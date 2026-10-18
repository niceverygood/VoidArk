import {fileURLToPath} from 'node:url';
import fs from 'node:fs';import {createRequire} from 'node:module';const require=createRequire(import.meta.url),sharp=require(process.env.VOID_ASSET_SHARP_MODULE||'sharp');const out=fileURLToPath(new URL('../public/assets/fx/',import.meta.url));fs.mkdirSync(out,{recursive:true});
const types=['explosion','smoke','energy','shockwave','engine','warp','spark','ion'];
const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
function noiseAt(x,y){const X=Math.floor(x),Y=Math.floor(y),u=x-X,v=y-Y,s=u*u*(3-2*u),t=v*v*(3-2*v);return ((hash(X,Y)*(1-s)+hash(X+1,Y)*s)*(1-t)+(hash(X,Y+1)*(1-s)+hash(X+1,Y+1)*s)*t)*2-1;}
for(const kind of types){const S=192,W=S*4,buffer=Buffer.alloc(W*W*4);for(let f=0;f<16;f++){const t=f/15;for(let y=0;y<S;y++)for(let x=0;x<S;x++){const X=(x/S-.5)*2,Y=(y/S-.5)*2,r=Math.hypot(X,Y),angle=Math.atan2(Y,X);let noise=0;for(let o=0;o<4;o++){const freq=3.2*2**o;noise+=noiseAt(X*freq+t*.7+o*19.1,Y*freq-t*1.8+o*7.7)*.5/2**o;}let a=0,R=1,G=1,B=1;
if(kind==='explosion'){const shape=r+noise*.14;a=Math.max(0,1-shape)*Math.min(1,t*7+.6)*(1-t*.65);const heat=Math.max(0,1-r-t*.4+noise*.23);R=1;G=.12+heat*.88;B=.015+Math.max(0,heat-.5)*1.8;a*=Math.max(.15,.8+noise);}
if(kind==='smoke'){a=Math.max(0,1-r+noise*.18)**1.3*(.5+t*.2)*(1-t*.9);R=.34+noise*.1;G=.36+noise*.1;B=.4+noise*.1;}
if(kind==='energy'||kind==='ion'){a=Math.max(0,1-r)**2*(.6+Math.sin(angle*8+r*35-t*12)*.25);R=.4;G=.85;B=1;}
if(kind==='shockwave'||kind==='warp'){a=Math.exp(-(((r-(.25+t*.5))/.035)**2))*(1-t*.8)*(kind==='warp'?.6+Math.sin(angle*13+t*6)**2*.4:1);R=kind==='warp'?.7:.8;G=.9;B=1;}
if(kind==='engine'){a=Math.max(0,1-Math.abs(X)*3-Math.max(0,Y)*.5)**2*Math.max(0,1-Math.abs(Y))*(.65+noise*.4);R=.15+Math.max(0,1-Math.abs(Y)*3)*.7;G=.65;B=1;}
if(kind==='spark'){a=Math.exp(-Math.abs(X)*25)*Math.max(0,1-Math.abs(Y))**.4*(1-t*.7);R=1;G=.74;B=.3;}
const i=((Math.floor(f/4)*S+y)*W+(f%4*S+x))*4;buffer[i]=Math.max(0,Math.min(255,R*255));buffer[i+1]=Math.max(0,Math.min(255,G*255));buffer[i+2]=Math.max(0,Math.min(255,B*255));buffer[i+3]=Math.max(0,Math.min(255,a*255));}}
await sharp(buffer,{raw:{width:W,height:W,channels:4}}).png({compressionLevel:9}).toFile(`${out}/${kind}.png`);console.log(kind);}
