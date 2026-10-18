import * as THREE from 'three';
export class EnergyShieldMaterial extends THREE.ShaderMaterial{
 constructor({color=0x66ddff,opacity=.15}={}){
  super({uniforms:{tint:{value:new THREE.Color(color)},strength:{value:opacity},time:{value:0}},vertexShader:`varying vec2 vUv;varying vec3 N;varying vec3 V;
    void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(position,1.);N=normalize(normalMatrix*normal);V=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,
   fragmentShader:`varying vec2 vUv;varying vec3 N;varying vec3 V;uniform vec3 tint;uniform float strength;uniform float time;
    void main(){vec2 q=vUv*vec2(48.,24.);q.x+=mod(floor(q.y),2.)*.5;vec2 p=abs(fract(q)-.5);float hex=max(dot(p,vec2(.866,.5)),p.y);float grid=1.-smoothstep(.015,.045,abs(hex-.43));float rim=pow(1.-abs(dot(normalize(N),normalize(V))),2.);float ripple=.85+.15*sin(vUv.y*35.-time*8.);gl_FragColor=vec4(tint*(1.+rim+grid*.4),(rim*.85+.05+grid*.15)*strength*ripple);}`,
   transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false});
  Object.defineProperty(this,'opacity',{configurable:true,get:()=>this.uniforms.strength.value,set:v=>{this.uniforms.strength.value=v;}});
  Object.defineProperty(this,'color',{configurable:true,get:()=>this.uniforms.tint.value});
 }
}
