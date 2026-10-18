import * as THREE from 'three';
export function createSpaceReflections(renderer){
 const width=256,height=128,data=new Float32Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const lon=x/width*Math.PI*2,lat=(y/height-.5)*Math.PI,band=Math.exp(-((lat+Math.sin(lon*2)*.24)**2)*9),cloud=(.5+.5*Math.sin(lon*5+Math.sin(lat*8)))*band;
  const sun=Math.exp(-((lon-4.1)**2+(lat-.45)**2)*130)*35,i=(y*width+x)*4;
  data[i]=.025+cloud*.15+sun;data[i+1]=.045+band*.19+sun*.87;data[i+2]=.09+cloud*.32+band*.15+sun*.65;data[i+3]=1;
 }
 const source=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.FloatType);source.mapping=THREE.EquirectangularReflectionMapping;source.needsUpdate=true;const generator=new THREE.PMREMGenerator(renderer);const target=generator.fromEquirectangular(source);source.dispose();generator.dispose();return target;
}
