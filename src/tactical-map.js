import {qaRendererOptions} from './qa-render-context.js';
import {battlefieldView,MAP_SCOPES} from './tactical-scope.js';
import * as THREE from 'three';
import { BASE_POSITION } from './sim.js';

// Positions and histories stay in world space; only the map origin follows the pilot.
export function createTacticalMap(canvas, {renderer} = {}) {
  const qaParams=new URLSearchParams(typeof location==='undefined'?'':location.search);
  if(qaParams.get('qa')==='1'&&qaParams.get('qaNoRadar')==='1')return {setScope(){return true;},update(snapshot){return {...battlefieldView(snapshot),labels:[]};}};
  renderer ??= new THREE.WebGLRenderer(qaRendererOptions({canvas, alpha:true, antialias:true}));
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(360, 250, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 360/250, 1, 900);
  camera.position.set(205, 180, 235); camera.lookAt(0,0,0);
  const grid = new THREE.GridHelper(220, 8, 0x568a9a, 0x234653);
  grid.material.transparent=true; grid.material.opacity=.55; scene.add(grid);
  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(220,100,220)),new THREE.LineBasicMaterial({color:0x518995,transparent:true,opacity:.22}));
  scene.add(frame);
  const playerRing=new THREE.Mesh(new THREE.RingGeometry(8,9,40),new THREE.MeshBasicMaterial({color:0x8bffff,side:THREE.DoubleSide,transparent:true,opacity:.6}));playerRing.rotation.x=-Math.PI/2;scene.add(playerRing);
  const bossRing=new THREE.Mesh(new THREE.TorusGeometry(9,.9,6,36),new THREE.MeshBasicMaterial({color:0xffd45c,depthTest:false}));bossRing.rotation.x=Math.PI/2;bossRing.renderOrder=8;scene.add(bossRing);
  const player = new THREE.Mesh(new THREE.ConeGeometry(3,9,4), new THREE.MeshBasicMaterial({color:0x8bffff}));
  player.rotation.x=-Math.PI/2; scene.add(player);
  const base = new THREE.Mesh(new THREE.TorusGeometry(5,1,4,12),new THREE.MeshBasicMaterial({color:0x76ffab}));
  base.rotation.x=Math.PI/2;scene.add(base);
  const dots = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1),new THREE.MeshBasicMaterial({color:0xffffff}),200);
  dots.instanceMatrix.setUsage(THREE.DynamicDrawUsage); dots.frustumCulled=false; scene.add(dots);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(200*22*6), colors = new Float32Array(positions.length);
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3).setUsage(THREE.DynamicDrawUsage));
  const lines = new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.65}));
  lines.frustumCulled=false; scene.add(lines);
  const routeGeometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),route=new THREE.Line(routeGeometry,new THREE.LineBasicMaterial({color:0xffdc78,depthTest:false})),destination=new THREE.Mesh(new THREE.TorusGeometry(5,.8,5,20),new THREE.MeshBasicMaterial({color:0xffdc78,depthTest:false}));destination.rotation.x=Math.PI/2;route.renderOrder=5;destination.renderOrder=5;scene.add(route,destination);
  const histories=new Map(), live=new Set(), dummy=new THREE.Object3D(), color=new THREE.Color();
  const up=new THREE.Vector3(0,1,0), direction=new THREE.Vector3(), viewCache={entities:[],bosses:[]};
  // Buffer capacity stays fixed; subsequent uploads cover only live vertices.
  const upload=(attribute,count)=>{attribute.clearUpdateRanges();if(count){attribute.addUpdateRange(0,count);attribute.needsUpdate=true;}};
  let lastTime=-1,scope='local';
  return {setScope(value){if(!Object.hasOwn(MAP_SCOPES,value))return false;scope=value;histories.clear();lastTime=-1;return true;}, update(snapshot) {
    const view=battlefieldView(snapshot,viewCache),scale=view.scale;
    if(snapshot.time<lastTime) histories.clear();
    const advance=snapshot.time>lastTime; lastTime=snapshot.time;
    const origin=snapshot.player;live.clear();
    const target=null;route.visible=destination.visible=!!target;if(target){let x=(target.x-origin.x)*scale,y=(target.y-origin.y)*scale,z=(target.z-origin.z)*scale;const bound=Math.max(1,Math.abs(x)/100,Math.abs(z)/100,Math.abs(y)/45);x/=bound;y/=bound;z/=bound;destination.position.set(x,y,z);const attribute=routeGeometry.attributes.position;attribute.setXYZ(1,x,y,z);attribute.needsUpdate=true;routeGeometry.computeBoundingSphere();} let count=0, cursor=0;
    base.position.set((BASE_POSITION.x-origin.x)*scale,(BASE_POSITION.y-origin.y)*scale,(BASE_POSITION.z-origin.z)*scale);
    base.visible=!snapshot.campaign&&snapshot.galaxyId==='milky'&&Math.abs(base.position.x)<=110&&Math.abs(base.position.z)<=110&&Math.abs(base.position.y)<=50;
    const segment=(ax,ay,az,bx,by,bz,c,intensity=1)=>{
      if(cursor+6>positions.length)return;
      positions[cursor]=(ax-origin.x)*scale;positions[cursor+1]=(ay-origin.y)*scale;positions[cursor+2]=(az-origin.z)*scale;
      positions[cursor+3]=(bx-origin.x)*scale;positions[cursor+4]=(by-origin.y)*scale;positions[cursor+5]=(bz-origin.z)*scale;
      colors[cursor]=colors[cursor+3]=c.r*intensity;colors[cursor+1]=colors[cursor+4]=c.g*intensity;colors[cursor+2]=colors[cursor+5]=c.b*intensity;cursor+=6;
    };
    for(const e of view.entities) {
      live.add(e.id);
      let history=histories.get(e.id)||[];
      if(advance){const sample=history.length===4?history.shift():{};sample.x=e.x;sample.y=e.y;sample.z=e.z;sample.time=snapshot.time;history.push(sample);histories.set(e.id,history);}
      const boss=/boss/i.test(e.kind);if((!boss&&(Math.abs(e.x-origin.x)>view.extent||Math.abs(e.z-origin.z)>view.extent||Math.abs(e.y-origin.y)>view.verticalExtent))||count>=200)continue;
      color.set(e.kind==='defense'?0x94ffad:e.kind==='cosmic'?0xffa655:e.kind==='planet'?(e.owned?0x87ffd2:0xc8b1ff):e.kind==='fortress'?0xffb65e:e.kind==='fleet'?0x87ffd2:/boss/i.test(e.kind)?0xffd45c:e.kind==='carrier'?0xff914a:0xff425e);
      let mx=(e.x-origin.x)*scale,my=(e.y-origin.y)*scale,mz=(e.z-origin.z)*scale;const edge=Math.max(1,Math.abs(mx)/100,Math.abs(mz)/100,Math.abs(my)/45);if(boss){mx/=edge;my/=edge;mz/=edge;}dummy.position.set(mx,my,mz);dummy.scale.setScalar(e.kind==='planet'?3:e.kind==='fortress'||e.kind==='planetBase'?3:/boss/i.test(e.kind)?6:e.kind==='carrier'?3.5:e.kind==='fleet'?2:2.6);dummy.updateMatrix();
      dots.setMatrixAt(count,dummy.matrix);dots.setColorAt(count++,color);
      if(!boss||edge===1)segment(e.x,e.y,e.z,e.x,origin.y,e.z,color,.3);
      for(let i=1;(!boss||edge===1)&&i<history.length;i++){const a=history[i-1],b=history[i];segment(a.x,a.y,a.z,b.x,b.y,b.z,color,.2+.8*i/history.length);}
      const previous=history.at(-2), elapsed=previous?snapshot.time-previous.time:0;
      if((!boss||edge===1)&&elapsed>0) {
        const vx=(e.x-previous.x)/elapsed,vy=(e.y-previous.y)/elapsed,vz=(e.z-previous.z)/elapsed;
        if(Math.hypot(vx,vy,vz)>.3){
          const tx=e.x+vx*.7,ty=e.y+vy*.7,tz=e.z+vz*.7;
          segment(e.x,e.y,e.z,tx,ty,tz,color);
          direction.set(vx,vy,vz).normalize();const sideLength=Math.hypot(direction.z,direction.x)||1,sx=-direction.z/sideLength,sz=direction.x/sideLength;
          segment(tx,ty,tz,tx-direction.x*3-sx*2,ty-direction.y*3,tz-direction.z*3-sz*2,color);
          segment(tx,ty,tz,tx-direction.x*3+sx*2,ty-direction.y*3,tz-direction.z*3+sz*2,color);
        }
      }
    }
    for(const id of histories.keys())if(!live.has(id))histories.delete(id);
    dots.count=count;upload(dots.instanceMatrix,count*16);if(dots.instanceColor)upload(dots.instanceColor,count*3);
    geometry.setDrawRange(0,cursor/3);upload(geometry.attributes.position,cursor);upload(geometry.attributes.color,cursor);
    const heading=snapshot.heading||0;
    player.quaternion.setFromUnitVectors(up,direction.set(-Math.sin(heading),0,-Math.cos(heading)));
    bossRing.visible=false;const labels=[{text:'나',color:'#8bffff',point:new THREE.Vector3(0,8,0)}];
    for(const e of view.bosses){let x=(e.x-origin.x)*scale,y=(e.y-origin.y)*scale,z=(e.z-origin.z)*scale;const edge=Math.max(1,Math.abs(x)/100,Math.abs(z)/100,Math.abs(y)/45);x/=edge;y/=edge;z/=edge;if(!bossRing.visible){bossRing.visible=true;bossRing.position.set(x,y,z);bossRing.scale.setScalar(1+.12*Math.sin(snapshot.time*4));}const d=Math.round(Math.hypot(e.x-origin.x,e.y-origin.y,e.z-origin.z)),dy=Math.round(e.y-origin.y);labels.push({text:(edge>1?'↗ 보스':'★ 보스')+' '+d+'m '+(dy>8?'↑ '+dy+'m':dy<-8?'↓ '+Math.abs(dy)+'m':'동일 고도'),color:'#ffda68',point:new THREE.Vector3(x,y+10,z)});}
    renderer.render(scene,camera);view.labels=labels.map(label=>{const p=label.point.project(camera);return {text:label.text,color:label.color,left:Math.max(5,Math.min(95,(p.x+1)*50)),top:Math.max(6,Math.min(90,(1-p.y)*50))};});return view;
  }};
}


