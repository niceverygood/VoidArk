import {anchorPlanetBossWeapons} from './planet-boss-weapons.js';
import {anchorPlanetBossCore} from './planet-boss-core.js';
import {anchorPlanetHullCore} from './planet-hull-core.js';
import {anchorPlanetHullWeapons} from './planet-hull-weapons.js';
import {anchorPlanetHullEngines} from './planet-hull-engines.js';
import {anchorPlanetBossEngines} from './planet-boss-engines.js';
import {beginPlanetAssetReadiness} from './planet-enemy-readiness.js';
import {installPlanetEquipmentLOD} from './planet-equipment-lod.js';
import {installPlanetSignature} from './planet-enemy-signatures.js';
import {PLANET_ENEMIES} from './planet-enemies.js';
import {notifyEngineFlamesAttached} from './engine-flame-batch.js';
import {equipmentLayout} from './equipment-layout.js';
import {installSolarModules} from './solar-base-visuals.js';
import {EnergyShieldMaterial} from './energy-shield.js';
import {mountAsset,hullAsset,moduleAsset,dedicatedHull} from './asset-library.js';
import {visualNation} from './asset-hangar.js';
import {engineMaterial} from './engine-material.js';
import {mountBossHull} from './segmented-asset.js';
import {SHIP_FAMILIES, shipDefinition} from './ships.js';
import { sectorDefinition } from './sectors.js';
import { shipGrowth } from './ship-growth.js';
import { TREE_BRANCHES, TREE_NODES, RESEARCH_VISUALS, cleanTree } from './skill-tree.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// All craft point down -Z. Geometry and opaque materials are intentionally shared.
const geometryCache = new Map();
const TAU = Math.PI * 2;
const palette = {
  orangeGlow: new THREE.MeshStandardMaterial({color:0xffcb82,emissive:0xff872c,emissiveIntensity:2,roughness:.3}),
  ivory: new THREE.MeshStandardMaterial({ color: 0xd7ddd5, metalness: 0.62, roughness: 0.34 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf0f2e6, metalness: 0.42, roughness: 0.29 }),
  graphite: new THREE.MeshStandardMaterial({ color: 0x17232b, metalness: 0.8, roughness: 0.38 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x47565e, metalness: 0.88, roughness: 0.28 }),
  black: new THREE.MeshStandardMaterial({ color: 0x050a12, metalness: 0.5, roughness: 0.56 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xad8051, metalness: 0.75, roughness: 0.4 }),
  teal: new THREE.MeshStandardMaterial({ color: 0x3debe3, emissive: 0x17c9c3, emissiveIntensity: 2.3, metalness: 0.28, roughness: 0.23 }),
  ice: new THREE.MeshStandardMaterial({ color: 0xcffff5, emissive: 0x58fff1, emissiveIntensity: 3.1, roughness: 0.25 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x103744, emissive: 0x087d91, emissiveIntensity: 0.55, metalness: 0.85, roughness: 0.14 }),
  crimson: new THREE.MeshStandardMaterial({ color: 0x741c3f, metalness: 0.75, roughness: 0.32 }),
  scarlet: new THREE.MeshStandardMaterial({ color: 0xd74857, metalness: 0.62, roughness: 0.34 }),
  violet: new THREE.MeshStandardMaterial({ color: 0x3a254f, metalness: 0.78, roughness: 0.31 }),
  enemyDark: new THREE.MeshStandardMaterial({ color: 0x171323, metalness: 0.84, roughness: 0.39 }),
  redGlow: new THREE.MeshStandardMaterial({ color: 0xff737d, emissive: 0xff244b, emissiveIntensity: 2.8, roughness: 0.25 }),
  purpleGlow: new THREE.MeshStandardMaterial({ color: 0xd2a1ff, emissive: 0x9e41ff, emissiveIntensity: 3, roughness: 0.2 }),
  orangeGlow: new THREE.MeshStandardMaterial({ color: 0xffcc88, emissive: 0xff6935, emissiveIntensity: 2.7, roughness: 0.25 }),
};

function cached(key, build) {
  if (!geometryCache.has(key)) geometryCache.set(key, build());
  return geometryCache.get(key);
}

const boxGeometry = () => cached('box', () => new THREE.BoxGeometry(1, 1, 1));
const orbGeometry = () => cached('orb', () => new THREE.SphereGeometry(1, 16, 10));
const icoGeometry = () => cached('ico', () => new THREE.IcosahedronGeometry(1, 1));
const coneGeometry = () => cached('cone', () => new THREE.ConeGeometry(1, 1, 10));
const cylinderGeometry = (top = 1, bottom = 1, sides = 12) => cached(`cylinder:${top}:${bottom}:${sides}`, () => new THREE.CylinderGeometry(top, bottom, 1, sides));
const torusGeometry = (radius = 1, tube = 0.1, segments = 32) => cached(`torus:${radius}:${tube}:${segments}`, () => new THREE.TorusGeometry(radius, tube, 6, segments));

function mesh(parent, geometry, material, position = [0, 0, 0], scale = [1, 1, 1]) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  item.scale.set(...scale);
  parent.add(item);
  return item;
}

function box(parent, size, position, material = palette.graphite) {
  return mesh(parent, boxGeometry(), material, position, size);
}

function cylinder(parent, radius, length, position, material, top = 1, bottom = 1, axis = 'z') {
  const part = mesh(parent, cylinderGeometry(top, bottom), material, position, [radius, length, radius]);
  if (axis === 'z') part.rotation.x = Math.PI / 2;
  if (axis === 'x') part.rotation.z = Math.PI / 2;
  return part;
}

function torus(parent, radius, tube, position, material, axis = 'z') {
  const part = mesh(parent, torusGeometry(radius, tube), material, position);
  if (axis === 'y') part.rotation.x = Math.PI / 2;
  if (axis === 'x') part.rotation.y = Math.PI / 2;
  return part;
}

function plateGeometry(points, thickness = 0.3, bevel = 0.065) {
  return cached(`plate:${JSON.stringify(points)}:${thickness}:${bevel}`, () => {
    const shape = new THREE.Shape();
    points.forEach(([x, z], i) => i ? shape.lineTo(x, z) : shape.moveTo(x, z));
    shape.closePath();
    const result = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: bevel > 0, bevelSegments: 1, steps: 1, bevelSize: bevel, bevelThickness: bevel });
    result.rotateX(Math.PI / 2);
    result.translate(0, thickness / 2, 0);
    result.computeVertexNormals();
    return result;
  });
}

function plate(parent, points, thickness, y, material, bevel = 0.065) {
  return mesh(parent, plateGeometry(points, thickness, bevel), material, [0, y, 0]);
}

// Tapered, bevelled hull sections share geometry just like the main hull.
function fairing(parent,size,position,material=palette.ivory){
 const [w,h,l]=size,[x,y,z]=position;
 const points=[[-w*.28,-l*.5],[w*.28,-l*.5],[w*.5,-l*.22],[w*.46,l*.28],[w*.3,l*.5],[-w*.3,l*.5],[-w*.46,l*.28],[-w*.5,-l*.22]];
 const o=plate(parent,points,h,y,material,Math.min(.055,h*.15,w*.08,l*.08));o.position.x=x;o.position.z=z;o.userData.integratedHull=true;
 if(material===palette.ivory&&w>.4&&l>.5&&h>.12){
  const inset=points.map(([px,pz])=>[px*.7,pz*.68]);const cap=plate(parent,inset,.018,y+h*.5+.012,palette.steel,.008);cap.position.set(x,y+h*.5+.012,z);
  for(const side of [-1,1]){const seam=plate(parent,[[-w*.018,-l*.26],[w*.018,-l*.26],[w*.018,l*.22],[-w*.018,l*.22]],.014,y+h*.5+.028,palette.teal,.004);seam.position.set(x+side*w*.3,y+h*.5+.028,z);}
  ventArray(parent,x,y+h*.5+.04,z+l*.17,3,Math.min(.09,w*.07),w*.38);
 }return o;
}

function craftRoot(kind, radius) {
  const group = new THREE.Group();
  group.name = kind;
  const visual = new THREE.Group();
  visual.name = 'animated-hull';
  group.add(visual);
  Object.assign(group.userData, { kind, radius, visualRoot: visual, turrets: [], engines: [], rotors: [], escorts: [], parts: [] });
  let disposed = false;
  group.userData.dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const nozzle of group.userData.engines) {
      nozzle.userData.flame.material.dispose();
      nozzle.userData.hot.material.dispose();
    }
    group.userData.hitFlash?.material.dispose();
  };
  return group;
}

function hitShell(root, size, color = 0x71fff2) {
  const material = new EnergyShieldMaterial({color,opacity:0});
  const shell = mesh(root.userData.visualRoot, orbGeometry(), material, [0, 0, 0], size);
  shell.name = 'impact-envelope';
  shell.visible = false;
  root.userData.hitFlash = shell;
}

// Bake fixed armor into one mesh per material, while retaining every moving joint.
// Resulting geometries are cached per craft type, so a swarm shares its hull buffers.
function bakeArmor(root) {
  const data = root.userData;
  const boundaries = [data.visualRoot, ...data.parts, ...data.turrets];
  const moving = new Set([...boundaries, ...data.turrets, ...data.engines, ...data.rotors, ...data.escorts, data.core, data.hitFlash].filter(Boolean));
  root.updateMatrixWorld(true);
  for (let boundaryIndex = 0; boundaryIndex < boundaries.length; boundaryIndex++) {
    const boundary = boundaries[boundaryIndex];
    const inverse = boundary.matrixWorld.clone().invert();
    const buckets = new Map();
    const gather = object => {
      for (const child of object.children) {
        if (moving.has(child)) continue;
        if (child.isMesh && !Array.isArray(child.material)) {
          const key = child.material.uuid;
          if (!buckets.has(key)) buckets.set(key, { material: child.material, meshes: [] });
          buckets.get(key).meshes.push(child);
        } else gather(child);
      }
    };
    gather(boundary);
    for (const [materialKey, bucket] of buckets) {
      const cacheKey = `baked:${data.kind}:${boundaryIndex}:${boundary.name}:${materialKey}`;
      const geometry = cached(cacheKey, () => {
        const pieces = bucket.meshes.map(part => {
          const copy = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
          copy.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, part.matrixWorld));
          return copy;
        });
        const combined = mergeGeometries(pieces, false);
        for (const piece of pieces) piece.dispose();
        return combined;
      });
      if (!geometry) continue;
      for (const original of bucket.meshes) original.removeFromParent();
      const armor = mesh(boundary, geometry, bucket.material);
      armor.name = 'baked-armor';
    }
  }
}

function engine(root, x, y, z, radius, length = 0.6, enemy = false) {
  const frame = new THREE.Group();
  frame.position.set(x, y, z);
  frame.name = 'engine-nozzle';
  const glow = enemy ? palette.redGlow : palette.teal;
  cylinder(frame, radius, length, [0, 0, 0], palette.steel, 0.78, 1.1);
  cylinder(frame, radius * 0.77, 0.08, [0, 0, length * 0.51], palette.black);
  torus(frame, radius * 0.8, radius * 0.11, [0, 0, length * 0.58], glow);
  const exhaustMaterial = engineMaterial(enemy ? 0xff466d : 0x2df0ed);
  exhaustMaterial.side=THREE.DoubleSide;
  const flame = mesh(frame, coneGeometry(), exhaustMaterial, [0, 0, length * 0.6 + radius * 1.8], [radius * 0.7, radius * 3.6, radius * 0.7]);
  flame.rotation.x = Math.PI / 2;
  const hot = mesh(frame, coneGeometry(), new THREE.MeshBasicMaterial({ color: enemy ? 0xffbfaa : 0xccffff, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }), [0, 0, length * 0.6 + radius * 0.8], [radius * 0.35, radius * 1.6, radius * 0.35]);
  hot.rotation.x = Math.PI / 2;
  flame.userData.engineBatchKind='flame';hot.userData.engineBatchKind='hot';
  Object.assign(frame.userData, { flame, hot, radius, length, seed: root.userData.engines.length * 1.73 });
  root.userData.visualRoot.add(frame);
  root.userData.engines.push(frame);
  notifyEngineFlamesAttached(frame);
  return frame;
}

function turret(root, position, scale = 1, enemy = false, heavy = false, parent = root.userData.visualRoot) {
  const [x, y, z] = position;
  cylinder(parent, scale * 0.55, scale * 0.15, [x, y, z], palette.steel, 1, 1, 'y');
  torus(parent, scale * 0.44, scale * 0.04, [x, y + scale * 0.09, z], enemy ? palette.redGlow : palette.teal, 'y');
  const pivot = new THREE.Group();
  pivot.name = heavy ? 'rail-cannon' : 'turret';
  pivot.position.set(x, y + scale * 0.17, z);
  const casing = mesh(pivot, icoGeometry(), enemy ? palette.crimson : palette.ivory, [0, scale * 0.12, 0], [scale * 0.52, scale * 0.28, scale * 0.51]);
  casing.rotation.y = Math.PI / 4;
  const muzzles = [];
  for (const side of [-1, 1]) {
    const barrelX = side * scale * (heavy ? 0.23 : 0.18);
    const barrelLength = scale * (heavy ? 1.45 : 0.95);
    cylinder(pivot, scale * (heavy ? 0.105 : 0.075), barrelLength, [barrelX, scale * 0.19, -barrelLength * 0.47], palette.steel, 0.85, 1);
    const muzzleZ = -barrelLength * 0.97;
    torus(pivot, scale * (heavy ? 0.105 : 0.075), scale * 0.027, [barrelX, scale * 0.19, muzzleZ], enemy ? palette.redGlow : palette.ice);
    const muzzle = new THREE.Object3D();
    muzzle.name = 'muzzle';
    muzzle.position.set(barrelX, scale * 0.19, muzzleZ - scale * 0.05);
    pivot.add(muzzle);
    muzzles.push(muzzle);
  }
  pivot.userData.muzzles = muzzles;
  pivot.userData.muzzle = muzzles[0];
  pivot.userData.heavy = heavy;
  pivot.userData.scale = scale;
  parent.add(pivot);
  root.userData.turrets.push(pivot);
  return pivot;
}

function ventArray(parent, x, y, z, count, spacing, scale = 1, material = palette.black) {
  for (let i = 0; i < count; i++) box(parent, [0.32 * scale, 0.035 * scale, 0.085 * scale], [x, y, z + (i - (count - 1) / 2) * spacing], material);
}

function modulePod(parent, x, y, z, scale, side) {
  const pod = new THREE.Group();
  pod.position.set(x, y, z);
  const points = [[-0.34, -1.1], [0.24, -1.2], [0.42, -0.65], [0.42, 0.8], [0.15, 1], [-0.34, 0.75]].map(([a, b]) => [a * scale * side, b * scale]);
  plate(pod, points, 0.38 * scale, 0, palette.ivory, 0.04 * scale);
  box(pod, [0.14 * scale, 0.09 * scale, 1.3 * scale], [0, 0.24 * scale, 0], palette.graphite);
  for (let i = 0; i < 3; i++) {
    cylinder(pod, 0.09 * scale, 0.12 * scale, [0.14 * scale * side, 0.2 * scale, (i - 1) * 0.3 * scale], palette.black, 1, 1, 'y');
    torus(pod, 0.075 * scale, 0.018 * scale, [0.14 * scale * side, 0.27 * scale, (i - 1) * 0.3 * scale], palette.teal, 'y');
  }
  parent.add(pod);
  return pod;
}

function escort(root, side, index) {
  const fighter = new THREE.Group();
  const hull = [[-0.38, 0.65], [-0.53, 0.25], [-0.13, -0.8], [0, -0.32], [0.13, -0.8], [0.53, 0.25], [0.38, 0.65]];
  plate(fighter, hull, 0.13, 0, palette.ivory, 0.025);
  box(fighter, [0.14, 0.1, 0.7], [0, 0.12, -0.05], palette.glass);
  box(fighter, [0.11, 0.08, 0.3], [0, 0.1, 0.45], palette.teal);
  const jet = mesh(fighter, coneGeometry(), palette.teal, [0, 0, 0.95], [0.1, 0.55, 0.1]);
  jet.rotation.x = Math.PI / 2;
  fighter.position.set(side * (5.3 + index * 0.8), index ? -0.5 : 0.8, -1.5 + index * 3.5);
  fighter.userData.home = fighter.position.clone();
  fighter.userData.phase = index * 1.9 + (side > 0 ? 1.1 : 0);
  fighter.name = 'escort-fighter';
  root.userData.visualRoot.add(fighter);
  root.userData.escorts.push(fighter);
}

/** A modular split-prow craft. Decorative escorts do not enlarge radius. */
export function createPlayer(stage = 0, upgrades = {}, tree = {}, base = {}, shipId = 'ark', research = {}, nationDesign = visualNation(), preferDedicated = true) {
  stage = THREE.MathUtils.clamp(Math.floor(Number(stage) || 0), 0, 2);
  const width = [3.05, 5.25, 8.05][stage];
  const length = [5.2, 8.0, 12.1][stage];
  const thickness = [0.48, 0.7, 1.05][stage];
  const root = craftRoot(`player-${stage}`, width * 0.57);
  Object.assign(root.userData, { stage, width, length });
  const frame = root.userData.visualRoot;
  const scaled = points => points.map(([x, z]) => [x * width, z * length]);
  plate(frame, scaled([[-0.16, -0.32], [0.16, -0.32], [0.32, 0.14], [0.24, 0.4], [-0.24, 0.4], [-0.32, 0.14]]), thickness * 0.9, -0.12, palette.graphite);
  for (const side of [-1, 1]) {
    const points = scaled([[0.065, -0.5], [0.2, -0.45], [0.41, -0.13], [0.43, 0.23], [0.28, 0.38], [0.13, 0.14], [0.12, -0.18]]).map(([x, z]) => [x * side, z]);
    plate(frame, points, thickness, 0, palette.ivory, thickness * 0.1);
    const inset = scaled([[0.12, -0.3], [0.2, -0.28], [0.35, -0.05], [0.33, 0.17], [0.24, 0.23], [0.17, 0.02]]).map(([x, z]) => [x * side, z]);
    plate(frame, inset, 0.045, thickness * 0.57, palette.graphite, 0.018);
    const conductor = box(frame, [width * 0.025, 0.045, length * 0.26], [side * width * 0.13, thickness * 0.62, -length * 0.24], palette.teal);
    conductor.rotation.y = -side * 0.12;
    box(frame, [width * 0.03, 0.04, length * 0.18], [side * width * 0.32, thickness * 0.57, length * 0.055], palette.brass);
    ventArray(frame, side * width * 0.23, thickness * 0.6, length * 0.21, stage + 3, 0.13 + stage * 0.03, 0.7 + stage * 0.25);
  }
  const cockpitZ = stage === 2 ? length * 0.13 : -length * 0.055;
  const cockpitY = thickness * (stage === 2 ? 1.25 : 0.78);
  plate(frame, scaled([[-0.09, -0.15], [0.09, -0.15], [0.13, 0.17], [-0.13, 0.17]]), thickness * 0.45, thickness * 0.42, palette.steel);
  mesh(frame, orbGeometry(), palette.glass, [0, cockpitY, cockpitZ], [width * 0.09, thickness * 0.52, length * 0.095]);
  box(frame, [0.045, 0.06, length * 0.14], [0, cockpitY + thickness * 0.45, cockpitZ], palette.ice);
  const coreZ = length * 0.23;
  cylinder(frame, width * 0.115, thickness * 0.24, [0, thickness * 0.6, coreZ], palette.graphite, 1, 1, 'y');
  const core = mesh(frame, orbGeometry(), palette.teal, [0, thickness * 0.83, coreZ], [width * 0.075, thickness * 0.31, width * 0.075]);
  root.userData.core = core;
  const coreCage = torus(frame, width * 0.105, width * 0.014, [0, thickness * 0.83, coreZ], palette.steel, 'y');
  coreCage.rotation.z = 0.12;
  root.userData.rotors.push(coreCage);
  for (const side of [-1, 1]) {
    engine(root, side * width * 0.29, -thickness * 0.1, length * 0.38, width * 0.095, thickness * 1.15);
    turret(root, [side * width * 0.23, thickness * 0.64, -length * 0.015], [0.38, 0.58, 0.78][stage], false, stage === 2);
  }
  if (stage >= 1) {
    for (const side of [-1, 1]) {
      box(frame, [width * 0.13, thickness * 0.36, length * 0.28], [side * width * 0.4, -0.1, length * 0.16], palette.steel);
      modulePod(frame, side * width * 0.43, thickness * 0.12, length * 0.035, stage === 2 ? 1.65 : 1, side);
      turret(root, [side * width * 0.27, thickness * 0.7, length * 0.22], stage === 2 ? 0.74 : 0.48);
      plate(frame, [[side * width * 0.18, length * 0.28], [side * width * 0.22, length * 0.36], [side * width * 0.22, length * 0.06]], thickness * 0.25, thickness * 0.9, palette.ivory, 0.025).rotation.z = side * 0.4;
      cylinder(frame, 0.035, 0.6 + stage * 0.25, [side * width * 0.12, thickness * 1.25, length * 0.2], palette.steel, 1, 1, 'y');
      mesh(frame, orbGeometry(), palette.teal, [side * width * 0.12, thickness * 1.7, length * 0.2], [0.055, 0.055, 0.055]);
    }
  }
  if (stage === 2) {
    // A recessed aft launch bay gives the capital ship a different function and silhouette.
    box(frame, [2.25, 1.03, 2.65], [0, -0.52, length * 0.31], palette.graphite);
    box(frame, [1.84, 0.66, 0.08], [0, -0.46, length * 0.425], palette.black);
    for (const side of [-1, 1]) {
      box(frame, [0.1, 0.73, 0.12], [side * 0.98, -0.45, length * 0.436], palette.teal);
      box(frame, [0.06, 0.04, 2.05], [side * 0.62, -0.87, length * 0.31], palette.teal);
      engine(root, side * width * 0.15, thickness * 0.13, length * 0.4, width * 0.058, 0.9);
      turret(root, [side * width * 0.19, thickness * 0.73, -length * 0.23], 0.67, false, true);
      turret(root, [side * width * 0.39, thickness * 0.66, length * 0.3], 0.62);
      escort(root, side, 0);
      escort(root, side, 1);
    }
    box(frame, [2.03, 0.08, 0.1], [0, -0.06, length * 0.436], palette.ice);
    box(frame, [1.24, 0.5, 1.2], [0, thickness * 0.9, length * 0.16], palette.ivory);
    box(frame, [0.88, 0.11, 0.15], [0, thickness * 1.18, length * 0.11], palette.glass);
    const antenna = torus(frame, 0.5, 0.055, [0, thickness * 1.55, length * 0.24], palette.steel, 'y');
    root.userData.rotors.push(antenna);
  }
  hitShell(root, [width * 0.57, thickness * 2.1, length * 0.57]);
  bakeArmor(root);
  const selectedHull=(preferDedicated&&dedicatedHull(shipId))|| (nationDesign?`nation-${nationDesign}-${['scout','cruiser','carrier'][stage]}`:hullAsset(shipId,stage,preferDedicated));
  mountAsset(root,selectedHull,{parent:frame,size:length,onReady:()=>{root.userData.hullAssetId=selectedHull;},hide:frame.children.filter(o=>o.isMesh&&o!==root.userData.hitFlash&&o!==root.userData.core)});
  installPlayerModules(root, upgrades);
  installTechModules(root, tree, research);
  installCapitalExpansion(root,shipGrowth(upgrades,tree,base,research));
  installShipFrame(root,shipId);
  installSolarModules(root,research?.solar,shipId);
  return root;
}

function installShipFrame(root,id){
  const spec=shipDefinition(id);root.userData.vessel=spec;if(spec.id==='ark')return;
  const family=SHIP_FAMILIES[spec.family],{width:w,length:l,stage}=root.userData;
  const extra=craftRoot(`vessel-${id}-${stage}`,1),frame=extra.userData.visualRoot,n=spec.variant;
  for(const side of [-1,1]){
    const x=side*w*.5;
    if(spec.family===0){plate(frame,[[x,-l*.3],[side*w*(.7+n*.06),l*.3],[x,l*.1]],.16,.1,palette.ivory);engine(extra,x,.1,l*.38,.18+n*.04,.65);}
    if(spec.family===1){fairing(frame,[.28+n*.08,.38,l*(.6+n*.08)],[side*w*.26,.6,-l*.28],palette.graphite);fairing(frame,[.12,.13,l*.35],[side*w*.26,.82,-l*.4],palette.orangeGlow);}
    if(spec.family===2){fairing(frame,[w*.3,.7+n*.1,l*.75],[x,-.2,l*.05],palette.ivory);fairing(frame,[w*.2,.35,.1],[x,-.15,l*.44],palette.black);fairing(frame,[w*.22,.05,l*.55],[x,.25,l*.08],palette.teal);engine(extra,x,-.1,l*.45,.28,.9);}
    if(spec.family===3){fairing(frame,[w*.27,.65+n*.1,l*.56],[x,.05,0],palette.ivory);fairing(frame,[w*.31,.15,l*.3],[x,.55,-l*.04],palette.steel);turret(extra,[x,.7,l*.03],.4+n*.08);}
    if(spec.family===4){const ring=torus(frame,w*(.16+n*.025),.08,[x,.5,0],palette.purpleGlow,'y');extra.userData.rotors.push(ring);cylinder(frame,.15,1+n*.2,[x,.6,0],palette.steel,1,1,'y');}
    if(spec.family===5){fairing(frame,[w*.25,.8,l*.5],[x,-.15,l*.15],palette.graphite);for(let j=0;j<2+n;j++)fairing(frame,[w*.26,.12,.12],[x,.32,l*.3-j*.3],palette.orangeGlow);cylinder(frame,.08,1.1,[side*w*.65,.15,-l*.15],palette.steel,1,1,'z');}
  }
  if(n>0)fairing(frame,[.35,.25+n*.1,l*.25],[0,.65,-l*.04],palette.ivory);
  bakeArmor(extra);root.userData.visualRoot.add(extra);root.userData.engines.push(...extra.userData.engines);root.userData.turrets.push(...extra.userData.turrets);root.userData.rotors.push(...extra.userData.rotors);
  root.userData.visualRoot.scale.multiply(new THREE.Vector3(...family.shape));root.userData.growth.camera*=Math.max(...family.shape);root.userData.shipFrame=extra;
}

function installCapitalExpansion(root,growth){
  root.userData.growth=growth;
  const {width:w,length:l,stage}=root.userData;
  if(growth.tier>0){
    const addition=craftRoot(`capital-${stage}-${growth.tier}`,1),frame=addition.userData.visualRoot;
    for(let layer=0;layer<growth.tier;layer++){
      const z=-l*.34+layer*l*.14;
      for(const side of [-1,1]){
        fairing(frame,[w*.23,.3+layer*.06,l*.2],[side*w*(.47+layer*.025),.05,z],palette.ivory);
        fairing(frame,[w*.18,.08,l*.16],[side*w*(.47+layer*.025),.25+layer*.03,z],palette.graphite);
        fairing(frame,[.05,.06,l*.16],[side*w*(.55+layer*.025),.3,z],palette.teal);
        if(layer%2===0)turret(addition,[side*w*.52,.38,z],.45+stage*.2);
      }
    }
    // A tall command spine, stepped bridge and projecting armored bow.
    for(let deck=0;deck<growth.tier;deck++){
      fairing(frame,[w*(.28-deck*.025),.22,l*.2],[0,.4+deck*.24,l*.12+deck*.06],palette.ivory);
      fairing(frame,[w*(.22-deck*.018),.06,.06],[0,.55+deck*.24,l*.02+deck*.06],palette.glass);
    }
    for(const side of [-1,1]){
      fairing(frame,[w*.1,.32,l*.34],[side*w*.19,-.03,-l*.52],palette.ivory);
      if(growth.tier>=3){fairing(frame,[w*.18,.45,l*.4],[side*w*.62,-.25,l*.1],palette.graphite);fairing(frame,[w*.13,.08,l*.3],[side*w*.62,0,l*.1],palette.teal);}
      if(growth.tier>=5){fairing(frame,[w*.24,.5,l*.36],[side*w*.83,-.18,l*.18],palette.ivory);fairing(frame,[w*.17,.06,l*.28],[side*w*.83,.1,l*.18],palette.graphite);}
    }
    bakeArmor(addition);root.userData.visualRoot.add(addition);
    root.userData.turrets.push(...addition.userData.turrets);root.userData.capitalExpansion=addition;
  }
  root.userData.visualRoot.scale.set(growth.scale.x,growth.scale.y,growth.scale.z);
}

function installTechModules(root, tree, research) {
  const ranks=cleanTree(tree),{width:w,length:l,stage}=root.userData;
  const branches=TREE_BRANCHES.map(b=>b.id);
  root.userData.techModules=[];
  for(const node of [...TREE_NODES,...RESEARCH_VISUALS.map(n=>({...n,id:'research-'+n.id,research:n.id}))]) {
    const rank=node.research?Math.max(0,Math.min(5,Math.floor(Number(research?.[node.research])||0))):ranks[node.id];if(!rank)continue;
    const branch=branches.indexOf(node.branch),side=branch%2?1:-1;
    const module=craftRoot(`tech-${stage}-${node.id}-${rank}`,0);
    module.name=`tech-${node.id}-rank${rank}`;
    const g=module.userData.visualRoot;
    const glow=[palette.teal,palette.purpleGlow,palette.orangeGlow,palette.ice,palette.teal,palette.orangeGlow][branch%6];
    const size=.65+stage*.24;
    module.position.set(side*(w*.42+.55+Math.floor(branch/2)*size*.85),
      .7+stage*.3+Math.floor(branch/2)*.12,
      -l*.35+(node.tier-1)*l*.175);
    if(node.research)module.position.set((RESEARCH_VISUALS.findIndex(n=>n.id===node.research)-1)*w*.28,.85+stage*.4,l*.58);
    module.scale.setScalar(size);
    box(g,[.72+rank*.1,.2,.82],[0,0,0],palette.steel);
    box(g,[.5,.035,.55],[0,.12,0],palette.graphite);
    // Repeated structural pieces grow from one to three, not just a tint swap.
    for(let i=0;i<rank;i++){
      const x=(i-(rank-1)/2)*.32;
      if(node.shape==='lance'){
        box(g,[.16,.18,1.9+rank*.25],[x,.3,-.55],palette.ivory);box(g,[.06,.06,1.7],[x,.42,-.65],glow);torus(g,.15,.04,[x,.3,-1.55-rank*.12],glow);
      }else if(['scanner','jammer'].includes(node.shape)){
        cylinder(g,.035,.8+rank*.16,[x,.5,0],palette.brass,1,1,'y');const panel=box(g,[.34,.42,.09],[x,.95+rank*.07,0],palette.ivory);panel.rotation.y=i*.45;box(g,[.25,.28,.04],[x,.95+rank*.07,-.07],glow);
      }else if(node.shape==='radiator'){
        for(let j=0;j<3;j++)box(g,[.14,.48+rank*.15,.8],[x+j*.1,.4,0],j===1?glow:palette.steel);
      }else if(node.shape==='refinery'){
        cylinder(g,.17,.5+rank*.2,[x,.4,0],palette.ivory,1,1,'y');torus(g,.18,.04,[x,.5,0],glow,'y');
      }else if(node.shape==='droneBay'){
        box(g,[.3,.2,.65],[x,.25,0],palette.ivory);box(g,[.23,.14,.05],[x,.25,.34],palette.black);mesh(g,icoGeometry(),glow,[x,.45,.2],[.12,.07,.16]);
      }else if(node.shape==='barrels'||node.shape==='rails'){
        cylinder(g,node.shape==='barrels'?.09:.065,1.05+rank*.16,[x,.24,-.3],palette.steel);
        torus(g,.12,.035,[x,.24,-.8-rank*.08],glow);
      }else if(node.shape==='rack'){
        box(g,[.23,.3+rank*.06,.65],[x,.28,0],palette.ivory);
        box(g,[.18,.035,.11],[x,.46+rank*.03,-.16],glow);
      }else if(node.shape==='lens'){
        cylinder(g,.18,.45,[x,.3,-.35],palette.graphite);
        mesh(g,orbGeometry(),palette.ice,[x,.3,-.6],[.14,.14,.05]);
      }else if(node.shape==='missiles'){
        cylinder(g,.12,.5+rank*.12,[x,.38,0],palette.graphite,1,1,'y');
        mesh(g,coneGeometry(),palette.orangeGlow,[x,.7+rank*.06,0],[.11,.24,.11]);
      }else if(node.shape==='armor'){
        box(g,[.85+i*.1,.14,.9],[0,.2+i*.15,0],palette.ivory).rotation.z=side*.18;
      }else if(node.shape==='fins'){
        const fin=box(g,[.12,.6+rank*.2,.7],[x,.4,0],palette.ivory);fin.rotation.z=side*.35;
        box(g,[.035,.45,.5],[x,.55,0],glow);
      }else if(node.shape==='nozzle'){
        cylinder(g,.15,.65,[x,.22,.25],palette.steel);
        torus(g,.14,.04,[x,.22,.6],glow);
      }else if(node.shape==='claw'){
        for(const sign of [-1,1]){
          box(g,[.12,.15,.8],[sign*(.25+i*.12),.2,.2],palette.brass);
          box(g,[.25,.15,.12],[sign*(.2+i*.12),.2,.55],palette.ivory);
        }
      }else if(node.shape==='hangar'){
        box(g,[.65,.28,.55],[0,.24,i*.48],palette.ivory);
        box(g,[.45,.2,.045],[0,.24,.29+i*.48],palette.black);
        box(g,[.45,.025,.06],[0,.37,.3+i*.48],glow);
      }
    }
    if(['coil','core','dish','antenna','gyroscope'].includes(node.shape)){
      cylinder(g,.12,.5+rank*.14,[0,.35,0],palette.steel,1,1,'y');
      for(let i=0;i<rank;i++){
        const ring=torus(g,.24+rank*.07,.045,[0,.3+i*.17,0],glow,'y');
        if(node.shape==='gyroscope'){ring.rotation.x=i*.7;module.userData.rotors.push(ring);}
      }
      if(node.shape==='core')mesh(g,icoGeometry(),glow,[0,.5+rank*.12,0],[.22+rank*.04,.28+rank*.05,.22+rank*.04]);
      if(node.shape==='dish'){
        const dish=torus(g,.38+rank*.08,.06,[0,.62+rank*.14,0],palette.ivory,'y');dish.rotation.z=side*.4;
        mesh(g,orbGeometry(),glow,[0,.66+rank*.14,0],[.09,.09,.09]);
      }
      if(node.shape==='antenna')for(let i=0;i<rank;i++){
        cylinder(g,.035,.8+rank*.18,[(i-(rank-1)/2)*.25,.65,0],palette.brass,1,1,'y');
        mesh(g,orbGeometry(),glow,[(i-(rank-1)/2)*.25,1.05+rank*.09,0],[.07,.07,.07]);
      }
    }
    bakeArmor(module);
    mountAsset(root,moduleAsset(node.shape),{parent:g,size:(size+rank*.2)*1.25,hide:[...g.children.filter(o=>o.isMesh),...module.userData.rotors]});
    // Exterior modules are supported by real deck beams, not floating props.
    if(node.research){
      fairing(root.userData.visualRoot,[w*.18,.15,l*.2],[module.position.x,.3,l*.48],palette.steel);
    }else{
      const reach=Math.max(.15,Math.abs(module.position.x)-w*.25);
      fairing(root.userData.visualRoot,[reach,.15,size*.3],[side*(w*.25+reach*.5),.3,module.position.z],palette.steel);
      fairing(root.userData.visualRoot,[size*.25,Math.max(.15,module.position.y-.3),size*.3],[module.position.x,(module.position.y+.3)*.5,module.position.z],palette.graphite);
    }
    root.userData.visualRoot.add(module);
    root.userData.rotors.push(...module.userData.rotors);
    root.userData.techModules.push({id:node.id,rank,object:module});
  }
}

function installPlayerModules(root, upgrades) {
  const {width:w,length:l,stage}=root.userData;
  root.userData.modules=[];
  const limits={cannon:5,chain:5,missile:5,laser:5,fighter:4,armor:5,shield:5,magnet:4,reactor:4};
  for(const [id,max] of Object.entries(limits)) {
    const level=Math.max(0,Math.min(max,Math.floor(Number(upgrades[id])||0)));
    // The starting cannon already has the two standard hull turrets.
    if(!level||(id==='cannon'&&level===1))continue;
    const module=craftRoot(`module-${stage}-${id}-${level}`,0);
    module.name=`installed-${id}-lv${level}`;
    const g=module.userData.visualRoot, y=.8+stage*.3, spread=w*.48;
    const pod=(x,z,color=palette.ivory)=>{
      fairing(g,[.65+level*.12,.35+level*.07,1.1+level*.18],[x,y,z],color);
      box(g,[.48,.1,.7],[x,y+.25,z],palette.graphite);
    };
    for(const side of [-1,1]) {
      const x=side*spread;
      if(id==='cannon'){
        turret(module,[side*w*.2,y,-l*.27],.4+level*.11);
        for(let n=0;n<level-1;n++)cylinder(g,.08,.9+level*.15,[side*w*.2+(n-(level-2)/2)*.18,y+.4,-l*.4],palette.steel);
      }
      if(id==='chain'){
        pod(x,-l*.08,palette.violet);
        cylinder(g,.18,.5+level*.14,[x,y+.5,-l*.08],palette.steel,1,1,'y');
        for(let n=0;n<level;n++)torus(g,.28+level*.035,.055,[x,y+.35+n*.17,-l*.08],palette.purpleGlow,'y');
        mesh(g,orbGeometry(),palette.purpleGlow,[x,y+.7+level*.14,-l*.08],[.2,.2,.2]);
      }
      if(id==='missile'){
        pod(x,l*.08);
        for(let n=0;n<level+1;n++){
          const z=l*.08+(n-level/2)*.3;
          cylinder(g,.13,.5,[x,y+.45,z],palette.graphite,1,1,'y');
          mesh(g,coneGeometry(),palette.orangeGlow,[x,y+.74,z],[.1,.18,.1]);
        }
      }
      if(id==='laser'){
        pod(side*w*.32,-l*.3,palette.steel);
        cylinder(g,.18+level*.025,1.2+level*.25,[side*w*.32,y+.3,-l*.43],palette.graphite);
        for(let n=0;n<level+1;n++)torus(g,.2+level*.025,.04,[side*w*.32,y+.3,-l*.43-n*.18],palette.ice);
      }
      if(id==='fighter'){
        pod(side*(spread+.25),l*.3,palette.graphite);
        box(g,[.7+level*.16,.12,1.5+level*.25],[side*(spread+.25),y+.3,l*.3],palette.ivory);
        for(let n=0;n<level;n++)box(g,[.45,.06,.08],[side*(spread+.25),y+.4,l*.3+n*.25],palette.teal);
        for(let n=0;n<Math.min(2,level);n++){
          escort(module,side,n);
          const fighter=module.userData.escorts.at(-1);
          fighter.scale.setScalar(.65+stage*.1);
          fighter.position.set(side*(spread+1+n*.55),.4,l*.15+n*1.2);
          fighter.userData.home.copy(fighter.position);
        }
      }
      if(id==='armor')for(let n=0;n<level;n++){
        const panel=fairing(g,[.55+level*.07,.25,.8],[side*w*.35,.35+stage*.2+n*.12,l*.05+n*.35],palette.ivory);
        panel.rotation.z=side*.2;
      }
      if(id==='shield'){
        pod(side*w*.28,l*.23,palette.steel);
        for(let n=0;n<level;n++)torus(g,.27+n*.045,.045,[side*w*.28,y+.35+n*.12,l*.23],palette.teal,'y');
      }
      if(id==='magnet'){
        cylinder(g,.09,.65+level*.15,[side*(spread+.3),y+.5,0],palette.brass,1,1,'y');
        const dish=torus(g,.32+level*.07,.055,[side*(spread+.3),y+.9+level*.1,0],palette.orangeGlow,'y');
        module.userData.rotors.push(dish);
      }
    }
    if(id==='reactor'){
      box(g,[.9+level*.2,.3,.9+level*.2],[0,y+.2,l*.2],palette.graphite);
      for(let n=0;n<level;n++){
        const ring=torus(g,.4+n*.12,.065,[0,y+.45+n*.15,l*.2],palette.purpleGlow,'y');
        module.userData.rotors.push(ring);
      }
      mesh(g,icoGeometry(),palette.ice,[0,y+.7,l*.2],[.25+level*.07,.3+level*.1,.25+level*.07]);
    }
    bakeArmor(module);
    const asset=({cannon:'module-cannon',chain:'module-gravity',missile:'module-missile',laser:'module-laser',fighter:'module-hangar',armor:'module-armor',shield:'module-shield',magnet:'module-salvage',reactor:'module-reactor'})[id];
    const fallback=g.children.filter(o=>o.isMesh);const layout=equipmentLayout(id,level,w,l);for(const [index,slot] of layout.entries())mountAsset(root,asset,{parent:g,size:slot.size,position:slot.position,hide:index===0?fallback:[]});
    module.userData.equipmentLayout=layout;
    for(const side of [-1,1]){fairing(root.userData.visualRoot,[w*.34,.18+stage*.06,l*.25],[side*w*.34,.22+stage*.08,id==='laser'?-l*.28:id==='fighter'?l*.27:0],palette.ivory);}
    root.userData.visualRoot.add(module);
    root.userData.modules.push({id,level,object:module});
    for(const key of ['turrets','rotors','escorts'])root.userData[key].push(...module.userData[key]);
  }
}

export function createEnemy(kind = 'swarm') {
  const radius = { swarm: 0.82, interceptor: 1.65, sniper: 1.5, gravity: 2, carrier: 3.1 };
  if (!(kind in radius)) kind = 'swarm';
  const root = craftRoot(kind, radius[kind]);
  const frame = root.userData.visualRoot;
  if (kind === 'swarm') {
    const dart = mesh(frame, coneGeometry(), palette.enemyDark, [0, 0, -0.05], [0.39, 1.6, 0.39]);
    dart.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 3; i++) {
      const blade = plate(frame, [[0.12, -0.52], [0.77, 0.46], [0.27, 0.65]], 0.09, 0, palette.crimson, 0.025);
      blade.rotation.z = i * TAU / 3;
    }
    root.userData.core = mesh(frame, icoGeometry(), palette.orangeGlow, [0, 0, -0.62], [0.21, 0.21, 0.25]);
    torus(frame, 0.3, 0.04, [0, 0, 0.38], palette.redGlow);
    engine(root, 0, 0, .7, .23, .3, true);
  } else if (kind === 'interceptor') {
    plate(frame, [[-0.37, -1.2], [0.37, -1.2], [0.45, 0.9], [0, 1.4], [-0.45, 0.9]], 0.38, 0, palette.enemyDark);
    for (const side of [-1, 1]) {
      plate(frame, [[side * 0.32, -0.76], [side * 1.65, -0.2], [side * 1.18, 0.28], [side * 1.48, 1.19], [side * 0.43, 0.8]], 0.18, 0, palette.crimson, 0.045);
      plate(frame, [[side * 0.52, -0.51], [side * 1.29, -0.17], [side * 0.77, 0.12]], 0.035, 0.16, palette.scarlet, 0.015);
      engine(root, side * 0.55, -0.04, 1.0, 0.19, 0.4, true);
    }
    root.userData.core = mesh(frame, orbGeometry(), palette.redGlow, [0, 0.22, -0.5], [0.17, 0.1, 0.46]);
    turret(root, [0, 0.29, 0.1], 0.45, true);
  } else if (kind === 'sniper') {
    cylinder(frame, 0.28, 3.55, [0, 0, -0.5], palette.enemyDark, 0.48, 1);
    cylinder(frame, 0.12, 1.8, [0, 0, -1.75], palette.steel, 0.85, 1);
    for (const side of [-1, 1]) {
      plate(frame, [[side * 0.13, -0.5], [side * 0.93, 1.45], [side * 1.03, 2], [side * 0.4, 1.65]], 0.22, 0, palette.violet, 0.04);
      box(frame, [0.055, 0.05, 1.1], [side * 0.39, 0.17, 0.75], palette.purpleGlow).rotation.y = side * 0.25;
    }
    torus(frame, 0.28, 0.055, [0, 0, -1.0], palette.purpleGlow);
    torus(frame, 0.16, 0.04, [0, 0, -2.64], palette.purpleGlow);
    root.userData.core = mesh(frame, orbGeometry(), palette.purpleGlow, [0, 0, -0.1], [0.31, 0.31, 0.48]);
    engine(root, 0, 0, 1.7, 0.25, 0.42, true);
    const muzzle = new THREE.Object3D();
    muzzle.position.z = -2.75;
    frame.add(muzzle);
    root.userData.muzzle = muzzle;
  } else if (kind === 'gravity') {
    for (const side of [-1, 1]) engine(root, side * .65, 0, 1.05, .26, .4, true);
    root.userData.core = mesh(frame, icoGeometry(), palette.purpleGlow, [0, 0, 0], [0.62, 0.62, 0.62]);
    const ring1 = torus(frame, 1.25, 0.15, [0, 0, 0], palette.violet);
    const ring2 = torus(frame, 0.95, 0.055, [0, 0, 0], palette.purpleGlow, 'y');
    ring1.rotation.y = 0.35;
    ring2.rotation.z = 0.6;
    root.userData.rotors.push(ring1, ring2);
    for (let i = 0; i < 4; i++) {
      const mount = new THREE.Group();
      mount.rotation.z = i * Math.PI / 2;
      plate(mount, [[0.9, -0.6], [1.6, -0.1], [1.4, 0.9], [0.96, 0.45]], 0.35, 0, palette.enemyDark);
      mesh(mount, icoGeometry(), palette.purpleGlow, [1.26, 0, -0.22], [0.12, 0.12, 0.35]);
      frame.add(mount);
    }
  } else if (kind === 'carrier') {
    plate(frame, [[-0.65, -2.2], [0.65, -2.2], [2.25, -0.8], [2.55, 1.25], [1.5, 2.0], [-1.5, 2.0], [-2.55, 1.25], [-2.25, -0.8]], 0.85, 0, palette.enemyDark, 0.12);
    for (const side of [-1, 1]) {
      plate(frame, [[side * 0.75, -1.65], [side * 1.85, -0.5], [side * 2.12, 1.2], [side * 0.84, 1.5]], 0.22, 0.53, palette.crimson, 0.065);
      for (let i = 0; i < 3; i++) {
        box(frame, [0.78, 0.35, 0.24], [side * 1.65, -0.08, -0.35 + i * 0.5], palette.black);
        box(frame, [0.52, 0.06, 0.26], [side * 1.7, 0.11, -0.35 + i * 0.5], palette.orangeGlow);
      }
      engine(root, side * 1.2, 0, 1.88, 0.35, 0.65, true);
      turret(root, [side * 0.98, 0.71, 0.65], 0.6, true);
    }
    root.userData.core = mesh(frame, icoGeometry(), palette.redGlow, [0, 0.65, -0.15], [0.37, 0.32, 0.72]);
    const crown = torus(frame, 0.71, 0.07, [0, 0.79, -0.15], palette.scarlet, 'y');
    root.userData.rotors.push(crown);
  }
  hitShell(root, kind === 'carrier' ? [2.9, 1.5, 2.6] : kind === 'sniper' ? [1.3, 0.7, 2.9] : [radius[kind] * 1.1, radius[kind] * 0.8, radius[kind] * 1.2], 0xff527f);
  bakeArmor(root);
  mountAsset(root,`nation-${({swarm:'k',interceptor:'n',sniper:'q',gravity:'o',carrier:'y'})[kind]||'j'}-${kind==='carrier'?'carrier':kind==='sniper'?'cruiser':'scout'}`,{parent:frame,size:kind==='carrier'?5.2:kind==='sniper'?5.8:radius[kind]*2.2,hide:frame.children.filter(o=>o.isMesh&&o!==root.userData.hitFlash&&o!==root.userData.core)});
  return root;
}

/** Thirty-unit segmented siege machine, with individually named breakable modules. */
export function createBoss(commander=null,titan=false,nation='y') {
  const root = craftRoot('boss', 9.5);if(titan)root.scale.set(3.3,3.3,3.3);if(commander){root.scale.setScalar(commander.scale);root.userData.commander=commander;}
  root.name = 'THE MAW / siege leviathan';
  root.userData.length = 31;
  const frame = root.userData.visualRoot;
  const segments = [];
  for (let i = 0; i < 6; i++) {
    const section = new THREE.Group();
    const z = -8.7 + i * 4.05;
    section.position.set(Math.sin(i * 0.75) * 0.7, 0, z);
    section.name = ['reactor-collar', 'forward-battery', 'gravity-spine', 'carrier-vault', 'aft-battery', 'drive-crown'][i];
    section.userData.part = section.name;
    section.userData.breakable = true;
    section.userData.home = section.position.clone();
    cylinder(section, 1.15, 3.6, [0, 0, 0], palette.enemyDark, 0.92, 1.1);
    torus(section, 1.08, 0.16, [0, 0, 1.9], palette.steel);
    torus(section, 1.09, 0.055, [0, 0, 1.97], i === 2 ? palette.purpleGlow : palette.redGlow);
    for (const side of [-1, 1]) {
      plate(section, [[side * 0.24, -1.8], [side * 1.35, -1.25], [side * 1.65, 0.3], [side * 1.0, 1.6], [side * 0.3, 1.35]], 0.52, 0.89, i % 2 ? palette.crimson : palette.violet, 0.1);
      plate(section, [[side * 0.5, -1.1], [side * 1.15, -0.8], [side * 1.1, 0.7], [side * 0.6, 1]], 0.22, -0.9, palette.crimson, 0.055);
      box(section, [0.08, 0.07, 1.9], [side * 0.65, 1.22, 0.02], i === 2 ? palette.purpleGlow : palette.redGlow);
    }
    if (i === 1 || i === 4) {
      for (const side of [-1, 1]) {
        plate(section, [[side * 1.0, -1], [side * 3.9, -0.35], [side * 4.55, 1.4], [side * 1.25, 0.85]], 0.65, 0.1, palette.crimson, 0.08);
        turret(root, [side * 2.7, 0.62, 0.3], 1.25, true, true, section);
      }
    } else if (i === 2) {
      const gravityRotor = torus(section, 2.1, 0.12, [0, 0, 0], palette.purpleGlow);
      gravityRotor.rotation.x = 0.4;
      root.userData.rotors.push(gravityRotor);
      mesh(section, icoGeometry(), palette.purpleGlow, [0, 1.35, 0], [0.52, 0.52, 0.52]);
    } else if (i === 3) {
      for (const side of [-1, 1]) {
        box(section, [1.1, 1.1, 2.4], [side * 1.9, -0.1, 0], palette.enemyDark);
        for (let k = 0; k < 3; k++) box(section, [0.06, 0.52, 0.35], [side * 2.48, -0.07, (k - 1) * 0.7], palette.orangeGlow);
        plate(section, [[side * 1.3, -1.4], [side * 2.6, -1.15], [side * 2.6, 1.1], [side * 1.5, 1.45]], 0.24, 0.6, palette.scarlet);
      }
    }
    frame.add(section);
    segments.push(section);
    root.userData.parts.push(section);
  }
  const head = new THREE.Group();
  head.position.set(0, 0, -11.8);
  head.name = 'exposed-heart / prow';
  head.userData.breakable = true;
  for (const side of [-1, 1]) {
    plate(head, [[side * 0.3, -3.1], [side * 1.45, -2.35], [side * 2.0, 0.1], [side * 0.8, 1.9]], 0.85, 0, palette.crimson, 0.13);
    plate(head, [[side * 0.6, -2.2], [side * 1.2, -1.8], [side * 1.45, 0.2], [side * 0.75, 0.8]], 0.24, 0.63, palette.scarlet);
    cylinder(head, 0.18, 2.6, [side * 1.0, -0.42, -1.4], palette.steel, 0.45, 1);
    torus(head, 0.19, 0.04, [side * 1.0, -0.42, -2.72], palette.redGlow);
  }
  cylinder(head, 0.86, 1.5, [0, 0, -0.4], palette.enemyDark);
  const heart = mesh(head, icoGeometry(), palette.orangeGlow, [0, 0, -1.25], [0.67, 0.67, 0.67]);
  root.userData.core = heart;
  torus(head, 0.85, 0.11, [0, 0, -1.45], palette.steel);
  torus(head, 0.94, 0.05, [0, 0, -1.5], palette.redGlow);
  frame.add(head);
  root.userData.parts.push(head);
  for (const side of [-1, 1]) {
    engine(root, side * 1.1, 0, 13.2, 0.65, 1.2, true);
    engine(root, side * 0.55, 0.85, 13.1, 0.3, 0.8, true);
  }
  root.userData.parts.forEach((part,i)=>mountAsset(root,i===6?'module-reactor':i%2?'module-missile':'module-armor',{parent:part,size:i===6?3.2:7,position:[0,1,0]}));
  root.userData.segments = segments;
  hitShell(root, [5.15, 2.6, 16.0], 0xff6475);
  bakeArmor(root);
  mountBossHull(root,frame,nation);
  return root;
}

/** Animates model-local details, leaving gameplay position/quaternion and turret aim intact. */
export function animateShip(group, time, { thrust = 0, bank = 0, boost = false, hit = 0, verticalSpeed = null, horizontalSpeed = 0, dt = 1 / 60 } = {}) {
  const data = group.userData;
  const visual = data.visualRoot;
  if (!visual) return;
  for(const pivot of data.turrets||[])if(!pivot.userData.realAsset){pivot.userData.realAsset=true;mountAsset(group,'module-cannon',{parent:pivot,size:(pivot.userData.scale||.5)*(pivot.userData.heavy?2:1.5),hide:pivot.children.filter(o=>o.isMesh)});}
  const movement = THREE.MathUtils.clamp(Number(thrust) || 0, 0, 1);
  visual.rotation.z = THREE.MathUtils.clamp(Number(bank) || 0, -1, 1) * -0.23;
  if (verticalSpeed === null) visual.rotation.x = movement * -0.035;
  else {
    // Craft point toward -Z: positive X rotation lifts the bow toward +Y.
    const pitch = THREE.MathUtils.clamp(Math.atan2(verticalSpeed, Math.max(8, horizontalSpeed)), -.58, .58);
    visual.rotation.x += (pitch - visual.rotation.x) * (1 - Math.exp(-Math.max(0, dt) * 6));
  }
  for (const item of data.engines || []) {
    const { flame, hot, radius, length, seed } = item.userData;
    if(!item.userData.realAsset){item.userData.realAsset=true;mountAsset(group,'module-engine',{parent:item,size:radius*2.6,rotation:[Math.PI/2,0,0],hide:item.children.filter(o=>o.isMesh&&o!==flame&&o!==hot)});}
    const pulse = 1 + Math.sin(time * 37 + seed) * 0.09;
    const power = (0.52 + movement * 0.75 + (boost ? 1.0 : 0)) * pulse;
    flame.scale.y = radius * 3.6 * power;
    flame.position.z = length * 0.6 + radius * 1.8 * power;
    flame.material.opacity = 0.26 + movement * 0.19 + (boost ? 0.17 : 0);
    if(flame.material.uniforms){flame.material.uniforms.time.value=time+seed;flame.material.uniforms.opacity.value=flame.material.opacity;}
    hot.scale.y = radius * 1.6 * power;
    hot.position.z = length * 0.6 + radius * 0.8 * power;
  }
  for (let i = 0; i < (data.rotors || []).length; i++) {
    const rotor = data.rotors[i];
    rotor.rotation.z = time * (i % 2 ? -0.35 : 0.24) + i * 0.5;
    if (data.kind === 'gravity') rotor.rotation.y = time * (i ? -0.42 : 0.32);
  }
  for (const fighter of data.escorts || []) {
    const home = fighter.userData.home;
    const phase = fighter.userData.phase;
    fighter.position.set(home.x + Math.sin(time * 0.8 + phase) * 0.23, home.y + Math.sin(time * 1.2 + phase) * 0.25, home.z + Math.cos(time * 0.9 + phase) * 0.4);
    fighter.rotation.z = Math.sin(time * 0.9 + phase) * 0.08;
  }
  for (let i = 0; i < (data.segments || []).length; i++) {
    const section = data.segments[i];
    section.position.y = section.userData.home.y + Math.sin(time * 1.1 - i * 0.55) * 0.16;
    section.rotation.z = Math.sin(time * 0.7 - i * 0.5) * 0.035;
  }
  if (data.core) {
    const pulse = 1 + Math.sin(time * 3.6) * 0.035;
    if (!data.core.userData.restScale) data.core.userData.restScale = data.core.scale.clone();
    data.core.scale.copy(data.core.userData.restScale).multiplyScalar(pulse);
  }
  if (data.hitFlash) {
    data.hitFlash.visible = hit > 0.005;if(data.hitFlash.material.uniforms)data.hitFlash.material.uniforms.time.value=time;
    data.hitFlash.material.opacity = THREE.MathUtils.clamp(hit/.14, 0, 1) * 0.55;
  }
}

function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function canvasTexture(size, draw) {
  if (typeof document === 'undefined') {
    const fallback = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    fallback.needsUpdate = true;
    return fallback;
  }
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  draw(context, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}


/** Structured, dark deep space. The shader dome and stars ignore scene fog. */
export function createEnvironment(scene) {
  const root = new THREE.Group();
  root.name = 'VOID ARK / deep-space backdrop';
  root.userData.collision = false;
  scene.add(root);
  const owned = new Set();
  const own = resource => (owned.add(resource), resource);
  const random = randomGenerator(0x41524b);
  const sky = new THREE.Group();
  root.add(sky);
  const skyMaterial = own(new THREE.ShaderMaterial({
    uniforms: { sectorTeal:{value:new THREE.Color().setRGB(.013,.22,.25)}, sectorViolet:{value:new THREE.Color().setRGB(.19,.035,.29)} },
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: false,
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      precision highp float;
      uniform vec3 sectorTeal;
      uniform vec3 sectorViolet;
      varying vec3 vDirection;
      float hash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.11, 0.23, 0.37));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float noise(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                       mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                       mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p) {
        float sum = 0.0, amplitude = 0.56;
        for (int i = 0; i < 4; i++) {
          sum += noise(p) * amplitude;
          p = p * 2.07 + vec3(13.1, 7.3, 2.7);
          amplitude *= 0.49;
        }
        return sum;
      }
      void main() {
        vec3 d = normalize(vDirection);
        vec3 warp = vec3(fbm(d * 3.2 + 5.1), fbm(d * 3.2 - 8.3), fbm(d * 3.2 + 14.7));
        float clouds = fbm(d * 7.2 + warp * 4.0);
        float dust = fbm(d * 14.0 + warp * 7.0);
        float band = exp(-pow((d.y + d.x * 0.35 - d.z * 0.13 + (clouds - 0.5) * 0.65) * 2.6, 2.0));
        float mass = smoothstep(0.34, 0.78, clouds) * band;
        float lanes = smoothstep(0.31, 0.66, dust);
        float filaments = pow(max(0.0, 1.0 - abs(dust - 0.52) * 3.7), 5.0);
        float temperature = smoothstep(0.30, 0.7, fbm(d * 3.0 + vec3(1.1, 6.8, 4.9)));
        vec3 teal = sectorTeal;
        vec3 violet = sectorViolet;
        vec3 nebula = mix(teal, violet, temperature);
        vec3 color = vec3(0.0015, 0.0025, 0.006);
        color += nebula * mass * (0.12 + lanes * 0.75);
        color += mix(vec3(0.09, 0.21, 0.22), vec3(0.24, 0.12, 0.32), temperature) * filaments * mass * 0.2;
        color *= 0.68 + noise(d * 230.0) * 0.32;
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  const dome = mesh(sky, own(new THREE.SphereGeometry(1130, 32, 20)), skyMaterial);
  dome.renderOrder = -1000;
  const starTexture = own(canvasTexture(128, (ctx, size) => {
    const mid = size / 2;
    const glow = ctx.createRadialGradient(mid, mid, 0, mid, mid, mid);
    glow.addColorStop(0, 'rgba(255,255,255,1)');
    glow.addColorStop(0.09, 'rgba(255,255,255,1)');
    glow.addColorStop(0.2, 'rgba(215,236,255,0.85)');
    glow.addColorStop(0.45, 'rgba(150,205,255,0.2)');
    glow.addColorStop(1, 'rgba(90,160,255,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, size, size);
    const spike = ctx.createLinearGradient(0, mid, size, mid);
    spike.addColorStop(0, 'rgba(220,245,255,0)');
    spike.addColorStop(0.48, 'rgba(220,245,255,0.35)');
    spike.addColorStop(0.5, 'rgba(255,255,255,1)');
    spike.addColorStop(0.52, 'rgba(220,245,255,0.35)');
    spike.addColorStop(1, 'rgba(220,245,255,0)');
    ctx.fillStyle = spike; ctx.fillRect(0, mid - 0.7, size, 1.4);
    ctx.save(); ctx.translate(mid, mid); ctx.rotate(Math.PI / 2); ctx.translate(-mid, -mid);
    ctx.fillRect(0, mid - 0.7, size, 1.4); ctx.restore();
  }));
  const starLayers = [];
  for (let layer = 0; layer < 3; layer++) {
    const count = [4800, 1250, 190][layer];
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const azimuth = random() * TAU;
      const elevation = random() * 2 - 1;
      const radius = 440 + random() * 470;
      const circle = Math.sqrt(1 - elevation * elevation);
      positions.set([Math.cos(azimuth) * circle * radius, elevation * radius, Math.sin(azimuth) * circle * radius], i * 3);
      color.setHSL(random() < 0.18 ? 0.09 : 0.53 + random() * 0.13, 0.12 + random() * 0.34, 0.65 + random() * 0.3);
      colors.set([color.r, color.g, color.b], i * 3);
    }
    const geometry = own(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = own(new THREE.PointsMaterial({ size: [3.1, 6.2, 13.5][layer], map: starTexture, vertexColors: true, transparent: true, opacity: [0.73, 0.88, 1][layer], depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false, sizeAttenuation: true }));
    const stars = new THREE.Points(geometry, material);
    stars.renderOrder = -900;
    sky.add(stars); starLayers.push(stars);
  }

  const planetTexture = own(canvasTexture(1024, (ctx, size) => {
    ctx.fillStyle = '#3a5964'; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 360; i++) {
      const y = random() * size;
      ctx.fillStyle = 'rgba(' + (44 + Math.floor(random() * 64)) + ',' + (70 + Math.floor(random() * 61)) + ',' + (79 + Math.floor(random() * 57)) + ',' + (0.2 + random() * 0.5) + ')';
      ctx.fillRect(0, y, size, 0.5 + random() * 9);
    }
    for (let i = 0; i < 160; i++) {
      const x = random() * size, y = random() * size;
      const r = 5 + random() * 65;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, i % 4 ? 'rgba(162,182,175,0.13)' : 'rgba(13,30,43,0.23)');
      gradient.addColorStop(1, 'rgba(70,100,110,0)');
      ctx.fillStyle = gradient; ctx.save(); ctx.translate(x, y); ctx.scale(2.5, 0.4); ctx.translate(-x, -y);
      ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
    }
  }));
  const planetMaterial = own(new THREE.ShaderMaterial({
    uniforms: { surface: { value: planetTexture } },
    vertexShader: `
      varying vec2 vUv; varying vec3 vNormal; varying vec3 vWorld;
      void main() {
        vUv = uv; vNormal = normalize(mat3(modelMatrix) * normal);
        vec4 world = modelMatrix * vec4(position, 1.0); vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform sampler2D surface; varying vec2 vUv; varying vec3 vNormal; varying vec3 vWorld;
      void main() {
        vec3 n = normalize(vNormal);
        vec3 eye = normalize(cameraPosition - vWorld);
        vec3 sun = normalize(vec3(-0.55, 0.45, 0.72));
        float daylight = smoothstep(-0.18, 0.75, dot(n, sun));
        float rim = pow(1.0 - max(dot(n, eye), 0.0), 3.7);
        vec3 color = texture2D(surface, vUv).rgb * (0.035 + daylight * 0.63);
        color += vec3(0.055, 0.24, 0.31) * rim * (0.22 + daylight * 0.7);
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }`,
    fog: false, toneMapped: false,
  }));
  const planetGeometry = own(new THREE.SphereGeometry(1, 48, 32));
  const planet = mesh(sky, planetGeometry, planetMaterial, [-340, -185, -590], [87, 87, 87]);
  planet.rotation.z = -0.24;
  const atmosphereMaterial = own(new THREE.MeshBasicMaterial({ color: 0x5bbed3, transparent: true, opacity: 0.07, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
  mesh(planet, planetGeometry, atmosphereMaterial, [0, 0, 0], [1.025, 1.025, 1.025]);
  const planetRing = mesh(sky, own(new THREE.RingGeometry(111, 145, 96)), own(new THREE.MeshBasicMaterial({ color: 0x8aa1ad, side: THREE.DoubleSide, transparent: true, opacity: 0.17, depthWrite: false, fog: false })), [-340, -185, -590]);
  planetRing.rotation.set(1.17, 0.08, -0.28);
  const backdropMoon=mesh(sky, planetGeometry, own(new THREE.MeshStandardMaterial({ color: 0x4e5363, emissive: 0x141825, emissiveIntensity: 0.35, roughness: 1, fog: false })), [310, 170, 240], [24, 24, 24]);

  const grimeTexture = own(canvasTexture(512, (ctx, size) => {
    ctx.fillStyle = '#82878a'; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 18000; i++) {
      const value = 40 + Math.floor(random() * 160);
      ctx.fillStyle = 'rgba(' + value + ',' + value + ',' + value + ',' + (0.05 + random() * 0.22) + ')';
      const s = 0.5 + random() * 2.5;
      ctx.fillRect(random() * size, random() * size, s, s);
    }
    for (let i = 0; i < 100; i++) {
      const x = random() * size, y = random() * size, radius = 4 + random() * 40;
      const spot = ctx.createRadialGradient(x, y, 0, x, y, radius);
      spot.addColorStop(0, 'rgba(15,22,29,0.28)'); spot.addColorStop(1, 'rgba(30,38,44,0)');
      ctx.fillStyle = spot; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = 'rgba(20,27,35,0.3)'; ctx.beginPath();
      let x = random() * size, y = random() * size; ctx.moveTo(x, y);
      for (let j = 0; j < 4; j++) { x += (random() - 0.5) * 60; y += random() * 40; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }));
  const rubbleMaterial = own(new THREE.MeshStandardMaterial({ color: 0xc1b5a4, map: grimeTexture, bumpMap: grimeTexture, bumpScale: 0.17, roughness: 0.93, metalness: 0.1, vertexColors: true }));
  const rubbleGeometry = own(new THREE.IcosahedronGeometry(1, 2));
  const rubbleVertices = rubbleGeometry.getAttribute('position');
  const rockCorners = new Map(), rockColors = new Float32Array(rubbleVertices.count * 3), rockColor = new THREE.Color();
  for (let i = 0; i < rubbleVertices.count; i++) {
    const x = rubbleVertices.getX(i), y = rubbleVertices.getY(i), z = rubbleVertices.getZ(i);
    const key = x.toFixed(4) + ':' + y.toFixed(4) + ':' + z.toFixed(4);
    if (!rockCorners.has(key)) rockCorners.set(key, 0.78 + random() * 0.4);
    const variation = rockCorners.get(key);
    rubbleVertices.setXYZ(i, x * variation, y * variation, z * variation);
    const tint = 0.42 + Math.sin(x * 14 + y * 7 + z * 11) * 0.09 + variation * 0.17;
    rockColor.setRGB(tint * 0.93, tint * 0.97, tint);
    rockColors.set([rockColor.r, rockColor.g, rockColor.b], i * 3);
  }
  rubbleGeometry.setAttribute('color', new THREE.BufferAttribute(rockColors, 3));
  rubbleGeometry.computeVertexNormals();
  const asteroidCount = 176;
  const asteroids = new THREE.InstancedMesh(rubbleGeometry, rubbleMaterial, asteroidCount);
  asteroids.name = 'non-colliding weathered asteroid belt';
  asteroids.frustumCulled = false; asteroids.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  root.add(asteroids);
  const rocks = Array.from({ length: asteroidCount }, () => ({ x: (random() - 0.5) * 440, y: (random() - 0.5) * 260, z: (random() - 0.5) * 440, size: 0.6 + Math.pow(random(), 2) * 4.1, rx: random() * TAU, ry: random() * TAU, rz: random() * TAU }));
  // Nearby fixed altitude bands make vertical travel visible through perspective
  // and occlusion. Their world sizes never change with player altitude.
  for (let i = 104; i < asteroidCount; i++) {
    const rock = rocks[i], layer = (i - 104) % 3;
    Object.assign(rock, { x:(random()-.5)*140, z:(random()-.5)*140,
      y:[-24,12,48][layer]+(random()-.5)*14,
      size:.65+random()*1.75, near:true });
  }
  for (let i = 0; i < rocks.length; i++) asteroids.setColorAt(i, new THREE.Color().setHSL(0.07 + random() * 0.07, 0.04 + random() * 0.1, 0.63 + random() * 0.25));

  const hullGeometry = own(plateGeometry([[-0.8, -1.8], [0.1, -1.9], [0.9, -0.4], [0.72, 0.62], [0.16, 0.32], [-0.3, 1.5], [-0.95, 0.55]], 0.2, 0.055).clone());
  const hullMaterial = own(new THREE.MeshStandardMaterial({ color: 0x87999d, map: grimeTexture, metalness: 0.72, roughness: 0.51 }));
  const panels = new THREE.InstancedMesh(hullGeometry, hullMaterial, 74);
  panels.name = 'torn hull plating'; panels.frustumCulled = false; panels.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(panels);
  const frameParts = [];
  for (const [size, position] of [[[0.14, 0.2, 3.3], [-0.7, 0, 0]], [[0.14, 0.2, 2.7], [0.7, 0, -0.3]], [[1.5, 0.16, 0.16], [0, 0, -1]], [[1.2, 0.16, 0.16], [-0.1, 0, 0.7]]]) {
    const geometry = boxGeometry().toNonIndexed();
    geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion(), new THREE.Vector3(...size)));
    frameParts.push(geometry);
  }
  const skeletonGeometry = own(mergeGeometries(frameParts, false)); frameParts.forEach(part => part.dispose());
  const skeletons = new THREE.InstancedMesh(skeletonGeometry, hullMaterial, 32);
  skeletons.name = 'broken ship ribs'; skeletons.frustumCulled = false; skeletons.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(skeletons);
  const debris = Array.from({ length: 106 }, (_, i) => ({ x: (random() - 0.5) * 360, y: (random() - 0.5) * 210, z: (random() - 0.5) * 360, size: 0.4 + random() * 0.85, rx: random() * TAU, ry: random() * TAU, rz: random() * TAU, spin: (random() - 0.5) * 0.09 }));
  for (let i = 0; i < 74; i++) panels.setColorAt(i, new THREE.Color([0xcdd5ca, 0x667c87, 0x915a55, 0xa29a84][i % 4]));
  for (let i = 0; i < 32; i++) skeletons.setColorAt(i, new THREE.Color(i % 3 ? 0x8799a0 : 0xb5a080));

  const ring = new THREE.Group();
  ring.name = 'ruined orbital shipyard'; ring.position.set(92, 8, -240); ring.rotation.set(0.62, -0.32, 0.18); sky.add(ring);
  const stationMaterial = own(new THREE.MeshStandardMaterial({ color: 0x34454d, map: grimeTexture, metalness: 0.78, roughness: 0.52 }));
  const stationTrimMaterial = own(new THREE.MeshStandardMaterial({ color: 0x789199, metalness: 0.74, roughness: 0.4 }));
  const stationGlowMaterial = own(new THREE.MeshBasicMaterial({ color: 0x4ac7be, transparent: true, opacity: 0.6, fog: false, toneMapped: false }));
  for (const [start, arc] of [[0.08, 1.62], [2.03, 0.97], [3.32, 1.74], [5.48, 0.48]]) {
    const chunk = mesh(ring, own(new THREE.TorusGeometry(76, 1.25, 6, Math.ceil(arc * 24), arc)), stationMaterial); chunk.rotation.z = start;
    const rail = mesh(ring, own(new THREE.TorusGeometry(78, 0.12, 4, Math.ceil(arc * 24), arc)), stationGlowMaterial); rail.rotation.z = start;
  }
  for (let i = 0; i < 16; i++) {
    const angle = i / 16 * TAU;
    if ((angle > 1.7 && angle < 2.02) || (angle > 5.06 && angle < 5.48)) continue;
    const brace = box(ring, [5.5, 2.1, 3.2], [Math.cos(angle) * 76, Math.sin(angle) * 76, 0], stationTrimMaterial); brace.rotation.z = angle;
    if (i % 3 === 0) {
      const arm = box(ring, [15, 0.6, 0.6], [Math.cos(angle) * 67, Math.sin(angle) * 67, 0], stationMaterial); arm.rotation.z = angle;
      const dock = box(ring, [6, 3.7, 5], [Math.cos(angle) * 59, Math.sin(angle) * 59, 0], stationMaterial); dock.rotation.z = angle;
      box(dock, [1.4, 0.12, 3.1], [0, 0.55, 0], stationGlowMaterial);
    }
  }
  const dummy = new THREE.Object3D();
  const stationAnchor = ring.position.clone();
  const wrapped = (value, center, span) => THREE.MathUtils.euclideanModulo(value - center + span / 2, span) - span / 2 + center;
  let disposed = false;
  const update = (playerPosition, time = 0) => {
    if (disposed) return;
    sky.position.copy(playerPosition); planet.rotation.y = time * 0.006;
    // The star dome follows the camera region; solid landmarks stay in space.
    ring.position.copy(stationAnchor).sub(playerPosition);
    for (let i = 0; i < starLayers.length; i++) starLayers[i].rotation.y = time * (i + 1) * 0.0004;
    for (let i = 0; i < rocks.length; i++) {
      const rock = rocks[i];
      const span=rock.near?140:440;
      dummy.position.set(wrapped(rock.x, playerPosition.x, span), rock.near?rock.y:wrapped(rock.y, playerPosition.y, 260), wrapped(rock.z, playerPosition.z, span));
      dummy.rotation.set(rock.rx + time * 0.007, rock.ry + time * 0.011, rock.rz);
      dummy.scale.set(rock.size, rock.size * 0.76, rock.size * 1.22); dummy.updateMatrix(); asteroids.setMatrixAt(i, dummy.matrix);
    }
    for (let i = 0; i < debris.length; i++) {
      const part = debris[i];
      dummy.position.set(wrapped(part.x, playerPosition.x, 360), wrapped(part.y, playerPosition.y, 210), wrapped(part.z, playerPosition.z, 360));
      dummy.rotation.set(part.rx + time * part.spin, part.ry + time * part.spin * 0.7, part.rz);
      dummy.scale.setScalar(part.size); dummy.updateMatrix();
      if (i < 74) panels.setMatrixAt(i, dummy.matrix); else skeletons.setMatrixAt(i - 74, dummy.matrix);
    }
    asteroids.instanceMatrix.needsUpdate = panels.instanceMatrix.needsUpdate = skeletons.instanceMatrix.needsUpdate = true;
  };
  update(new THREE.Vector3(), 0);
  return {
    update,
    setCampaign(active){planet.visible=!active;planetRing.visible=!active;backdropMoon.visible=!active;ring.visible=!active;},
    setSector(sector) {
      const def=sectorDefinition(sector);
      skyMaterial.uniforms.sectorTeal.value.setRGB(...def.colors[0]);
      skyMaterial.uniforms.sectorViolet.value.setRGB(...def.colors[1]);
      ring.visible=sector===1;
    },
    dispose() {
      if (disposed) return; disposed = true; scene.remove(root);
      asteroids.dispose(); panels.dispose(); skeletons.dispose();
      for (const resource of owned) resource.dispose(); owned.clear();
    },
  };
}

/** A real maintenance gantry around the origin. The caller owns the displayed ship. */
export function createDock(scene) {
  const root = craftRoot('orbital-dock', 0);
  root.name = 'ORBITAL DOCK / maintenance gantry';
  root.userData.collision = false;
  root.visible = false;
  const frame = root.userData.visualRoot;
  scene.add(root);
  const owned = new Set();
  const arms = [], modules = [];
  const addBoundary = group => { root.userData.parts.push(group); return group; };
  const attach = (parent, group, position) => { group.position.set(...position); parent.add(group); return group; };
  for (const side of [-1, 1]) {
    const x = side * 8.4;
    box(frame, [2.7, 0.65, 19], [x, -2.55, 0], palette.graphite);
    box(frame, [2.35, 0.16, 18.7], [x, -2.13, 0], palette.steel);
    box(frame, [0.07, 0.07, 18], [x - side * 0.93, -2.01, 0], palette.teal);
    box(frame, [0.12, 0.09, 18], [x + side * 0.92, -2.01, 0], palette.brass);
    for (let i = 0; i < 9; i++) {
      box(frame, [1.7, 0.04, 0.055], [x, -2.02, -8 + i * 2], palette.black);
      const stripe = box(frame, [0.55, 0.045, 0.18], [x + side * 0.45, -2.0, -7.7 + i * 2], palette.brass);
      stripe.rotation.y = 0.5;
    }
    for (const z of [-7.7, 7.7]) {
      cylinder(frame, 0.67, 0.35, [x, -1.93, z], palette.steel, 1, 1, 'y');
      box(frame, [0.65, 5.2, 0.65], [x, 0.65, z], palette.graphite);
      box(frame, [0.18, 4.3, 0.12], [x - side * 0.35, 0.7, z + 0.34], palette.teal);
      box(frame, [1.1, 0.6, 1.0], [x, 2.9, z], palette.ivory);
      torus(frame, 0.35, 0.065, [x, 2.92, z + 0.54], palette.brass);
    }
    // Utility cabinets, vents and module sockets visibly ground the shipyard.
    box(frame, [1.35, 1.5, 2.1], [side * 9.1, -1.25, 2.5], palette.ivory);
    box(frame, [0.045, 0.35, 0.8], [side * 9.8, -1.0, 2.3], palette.glass);
    ventArray(frame, side * 9.1, -0.46, 2.5, 6, 0.22, 1.7);
    for (const z of [-4.7, 4.5]) {
      const base = addBoundary(attach(frame, new THREE.Group(), [side * 6.9, -1.55, z]));
      base.rotation.y = side > 0 ? Math.PI : 0;
      cylinder(base, 0.53, 0.28, [0, 0, 0], palette.steel, 1, 1, 'y');
      torus(base, 0.42, 0.055, [0, 0.19, 0], palette.teal, 'y');
      const shoulder = addBoundary(attach(base, new THREE.Group(), [0, 0.35, 0]));
      cylinder(shoulder, 0.34, 0.66, [0, 0, 0], palette.ivory);
      box(shoulder, [2.35, 0.3, 0.34], [1.12, 0, 0], palette.ivory);
      box(shoulder, [1.8, 0.08, 0.08], [1.1, 0.18, 0], palette.graphite);
      box(shoulder, [1.8, 0.025, 0.025], [1.1, 0.23, 0], palette.teal);
      const elbow = addBoundary(attach(shoulder, new THREE.Group(), [2.27, 0, 0]));
      cylinder(elbow, 0.28, 0.52, [0, 0, 0], palette.steel);
      torus(elbow, 0.27, 0.045, [0, 0, 0.29], palette.brass);
      box(elbow, [1.65, 0.22, 0.25], [0.8, 0, 0], palette.graphite);
      cylinder(elbow, 0.09, 1.48, [0.8, -0.17, 0], palette.steel, 1, 1, 'x');
      box(elbow, [0.45, 0.35, 0.45], [1.65, 0, 0], palette.ivory);
      for (const clawSide of [-1, 1]) {
        const claw = box(elbow, [0.55, 0.055, 0.08], [1.98, 0, clawSide * 0.19], palette.steel);
        claw.rotation.y = clawSide * 0.17;
      }
      const spark = mesh(elbow, orbGeometry(), palette.ice, [2.21, 0, 0], [0.045, 0.045, 0.045]);
      root.userData.rotors.push(spark);
      arms.push({ shoulder, elbow, spark, phase: z * 0.5 + side });
    }
  }
  box(frame, [17.7, 0.7, 0.8], [0, 3.05, -7.7], palette.graphite);
  box(frame, [16.6, 0.055, 0.08], [0, 3.46, -7.2], palette.teal);
  for (let i = 0; i < 7; i++) box(frame, [0.8, 0.05, 0.15], [-6 + i * 2, 3.48, -7.68], palette.brass);
  // An open lattice rather than a solid floor keeps the starfield visible below.
  for (const z of [-8.6, 8.6]) {
    box(frame, [16.7, 0.3, 0.4], [0, -2.7, z], palette.steel);
    box(frame, [15.8, 0.05, 0.045], [0, -2.5, z + 0.22], palette.teal);
  }
  const grid = new THREE.GridHelper(16, 16, 0x36b5b4, 0x284952);
  grid.position.y = -2.75;
  grid.material.transparent = true; grid.material.opacity = 0.12; grid.material.depthWrite = false;
  frame.add(grid); owned.add(grid.geometry); owned.add(grid.material);
  for (let index = 0; index < 3; index++) {
    const assembly = addBoundary(attach(frame, new THREE.Group(), [index === 1 ? 6.1 : -6.1, 1.3, -3.7 + index * 3.8]));
    assembly.name = 'floating assembly ' + index;
    if (index === 0) {
      plate(assembly, [[-0.8, -0.8], [0.65, -0.8], [0.9, 0.5], [-0.65, 0.8]], 0.45, 0, palette.ivory, 0.07);
      for (const side of [-1, 1]) {
        cylinder(assembly, 0.12, 1.8, [side * 0.3, 0.2, -0.9], palette.steel);
        torus(assembly, 0.13, 0.035, [side * 0.3, 0.2, -1.82], palette.teal);
      }
    } else if (index === 1) {
      box(assembly, [1.4, 0.75, 1.4], [0, 0, 0], palette.ivory);
      for (const x of [-0.32, 0.32]) for (const y of [-0.2, 0.2]) {
        cylinder(assembly, 0.18, 0.8, [x, y, -0.5], palette.graphite);
        torus(assembly, 0.15, 0.025, [x, y, -0.93], palette.brass);
      }
    } else {
      cylinder(assembly, 0.6, 0.65, [0, 0, 0], palette.graphite, 0.8, 1, 'y');
      torus(assembly, 0.65, 0.07, [0, 0.15, 0], palette.steel, 'y');
      mesh(assembly, icoGeometry(), palette.teal, [0, 0.3, 0], [0.36, 0.36, 0.36]);
    }
    const cradle = torus(frame, 1.15, 0.06, [assembly.position.x, -1.55, assembly.position.z], palette.steel, 'y');
    torus(frame, 1.0, 0.025, [assembly.position.x, -1.5, assembly.position.z], palette.teal, 'y');
    modules.push({ group: assembly, home: assembly.position.clone(), phase: index * 2.1 });
  }
  const scanner = addBoundary(attach(frame, new THREE.Group(), [0, 2.7, 0]));
  box(scanner, [15.5, 0.22, 0.3], [0, 0, 0], palette.steel);
  box(scanner, [11.5, 0.04, 0.05], [0, -0.14, 0], palette.teal);
  for (const side of [-1, 1]) box(scanner, [0.6, 0.55, 0.9], [side * 7.7, 0, 0], palette.ivory);
  bakeArmor(root);
  mountAsset(root,'orbital-dock',{parent:frame,size:36,position:[0,-3,0]});
  let disposed = false;
  return {
    setVisible(visible) { if (!disposed) root.visible = Boolean(visible); },
    update(time = 0) {
      if (disposed || !root.visible) return;
      for (const arm of arms) {
        arm.shoulder.rotation.z = 0.22 + Math.sin(time * 0.34 + arm.phase) * 0.13;
        arm.elbow.rotation.z = -0.45 + Math.sin(time * 0.43 + arm.phase + 1) * 0.19;
        arm.spark.scale.setScalar(0.045 * (1 + Math.max(0, Math.sin(time * 12 + arm.phase)) * 1.8));
      }
      for (const module of modules) {
        module.group.position.y = module.home.y + Math.sin(time * 0.7 + module.phase) * 0.17;
        module.group.rotation.y = Math.sin(time * 0.2 + module.phase) * 0.16;
      }
      scanner.position.z = Math.sin(time * 0.17) * 6.5;
    },
    dispose() {
      if (disposed) return; disposed = true; scene.remove(root); root.userData.dispose();
      for (const resource of owned) resource.dispose(); owned.clear();
    },
  };
}

export function createFleetShip(configuration,enemy=false){const d=configuration,ship=createPlayer(d.stage,d.gear,{}, {},d.ship,{},enemy?(d.nation||''):visualNation(),!enemy);for(let i=0;i<(d.upgrades?.engine||0);i++)for(const sign of [-1,1])engine(ship,sign*(3+i*.8),-.5,3+i*.4,.4+i*.06,.8);ship.scale.multiplyScalar(d.scale);return ship;}

export function createEnemyFleetShip(d){const root=createFleetShip(d,true),originals=(root.userData.engines||[]).flatMap(e=>[e.userData.flame.material,e.userData.hot.material]),owned=new Map();if(root.userData.hitFlash)originals.push(root.userData.hitFlash.material);root.traverse(o=>{if(o.isMesh&&o.material&&!Array.isArray(o.material)){const source=o.material;if(!owned.has(source)){const mat=source.clone();if(mat.color)mat.color.lerp(new THREE.Color(d.color),.42);if(mat.emissive)mat.emissive.set(d.color).multiplyScalar(.15);owned.set(source,mat);}o.material=owned.get(source);}});for(const m of originals)m.dispose();const dispose=root.userData.dispose;let disposed=false;root.userData.dispose=()=>{if(disposed)return;disposed=true;dispose?.();for(const [source,m] of owned)if(!originals.includes(source))m.dispose();};return root;}


const planetEnemyMaterials=new Map();
const planetEnemyFallbackCache=new Map();
const planetEnemyCachedRoles=new Set(['guard','gunner','striker','support','flagship']);
// Campaign enemies have their own hulls rather than recolored player vessels.
export function createPlanetEnemy(e) {
 const theme=PLANET_ENEMIES[e.planetTheme];
 if(!theme)return createEnemy(e.kind);
 const boss=!!e.campaignBoss,base=!!e.campaignBase,role=e.fleetRole||'striker';
 const root=craftRoot('planet-'+e.planetTheme+'-'+(boss?e.campaignBoss:base?'base':role),e.radius||3),frame=root.userData.visualRoot;
 root.userData.planetTheme=e.planetTheme;root.userData.design=theme.shape;
 const cacheable=boss?['warden','crown'].includes(e.campaignBoss):base||planetEnemyCachedRoles.has(role);
 const cachedFallback=cacheable?planetEnemyFallbackCache.get(root.userData.kind):null;
 if(!planetEnemyMaterials.has(e.planetTheme)){
 const armor=new THREE.MeshStandardMaterial({color:theme.hull,metalness:.72,roughness:.4});
 const dark=new THREE.MeshStandardMaterial({color:theme.hull,metalness:.85,roughness:.52});dark.color.multiplyScalar(.38);
 const light=new THREE.MeshStandardMaterial({color:theme.glow,emissive:theme.glow,emissiveIntensity:2,roughness:.25});
 planetEnemyMaterials.set(e.planetTheme,{armor,dark,light});
 }
 const {armor,dark,light}=planetEnemyMaterials.get(e.planetTheme);
 const shell=(size,pos,mat=armor)=>box(frame,size,pos,mat);
 const orb=(pos,size,mat=armor)=>mesh(frame,icoGeometry(),mat,pos,size);
 const ring=(radius,pos=[0,0,0],axis='y',mat=light)=>torus(frame,radius,.09,pos,mat,axis);
 const spike=(pos,size,mat=armor)=>{const o=mesh(frame,coneGeometry(),mat,pos,size);o.rotation.x=-Math.PI/2;return o;};
 const pod=(x,z=0)=>cylinder(frame,.55,3,[x,0,z],armor,.65,1.1);
 if(!cachedFallback){
 switch(theme.shape){
 case 'radiator':
  shell([.9,.55,4],[0,0,0]);for(const s of [-1,1])for(let i=0;i<5;i++){const p=shell([2.1,.12,.45],[s*1.5,0,-1.4+i*.65],i%2?dark:armor);p.rotation.z=s*.22; shell([1.8,.04,.06],[s*1.5,.12,-1.4+i*.65],light);}spike([0,0,-2.3],[.4,1.3,.25]);break;
 case 'pressure':
  orb([0,0,0],[1.35,.8,2.1]);for(let i=0;i<3;i++)ring(1.1,[0,0,-1+i], 'z',dark);for(const s of [-1,1]){pod(s*1.8);shell([.8,.3,1],[s*1.8,.5,0],light);}ring(.55,[0,.8,-.7]);break;
 case 'scorpion':
  shell([1.6,.65,2.5],[0,0,0]);for(const s of [-1,1]){for(let i=0;i<3;i++){const leg=shell([1.5,.2,.35],[s*1.35,0,-.9+i*.8]);leg.rotation.y=s*.5;}shell([.65,.6,1.5],[s*1.7,0,-1.9]);spike([s*1.7,0,-2.8],[.4,1.2,.4],light);}shell([.4,1.4,.4],[0,.9,1]);spike([0,1.5,.1],[.3,1.5,.3],light);break;
 case 'storm':
  orb([0,0,0],[1.8,.9,2.1]);for(let i=0;i<4;i++)ring(1.5-i*.18,[0,(i-1.5)*.35,0],'y',i%2?dark:armor);orb([.5,.95,-.5],[.6,.18,.45],light);for(const s of [-1,1])pod(s*2.1,.4);break;
 case 'ring':
  orb([0,0,0],[.95,.7,1.6]);ring(2.1);ring(2.5,[0,0,0],'y',armor);for(const s of [-1,1])shell([4.3,.15,.25],[0,0,s*.6],dark);break;
 case 'tilted':
  orb([0,0,0],[1.2,.85,1.6]);ring(2,[0,0,0],'x');ring(1.7,[0,0,0],'x',armor);for(const s of [-1,1]){spike([s*1.6,0,0],[.4,3,.4]);orb([0,s*1.5,0],[.4,.6,.4],light);}break;
 case 'trident':
  for(const s of [-1,0,1]){pod(s*1.35,s===0?-.7:.2);spike([s*1.35,0,s===0?-3:-2.2],[.4,2,.4],light);}shell([3.3,.3,.6],[0,0,1]);break;
 case 'shard':
  for(let i=0;i<5;i++){const a=i*TAU/5;const o=orb([Math.cos(a)*1.2,Math.sin(a)*.5,0],[.55,.55,2]);o.rotation.y=Math.cos(a)*.4;}spike([0,0,-1.8],[.4,2,.4],light);break;
 case 'glacier':
  shell([.8,.5,3.6],[0,0,0]);for(const s of [-1,1])for(let i=0;i<3;i++){const o=spike([s*(.8+i*.6),0,i*.4],[.45,3-i*.5,.22]);o.rotation.z=s*.35;}ring(.5,[0,.45,0]);break;
 case 'jellyfish':
  orb([0,0,-.6],[1.7,.6,1.7]);ring(1.6,[0,0,-.6]);for(let i=0;i<5;i++){const x=(i-2)*.55;shell([.12,.12,3],[x,-.4,1.3],light);orb([x,-.4,2.8],[.2,.2,.3],light);}break;
 case 'crystal':
  orb([0,0,0],[1.1,1.1,2],light);for(let i=0;i<6;i++){const a=i*TAU/6;spike([Math.cos(a)*1.5,Math.sin(a)*.8,0],[.5,2.7,.5]);}break;
 case 'caldera':
  orb([0,0,0],[1.8,.6,1.8],dark);ring(1.25,[0,.5,0]);for(let i=0;i<8;i++){const a=i*TAU/8;orb([Math.cos(a)*1.4,.2,Math.sin(a)*1.4],[.45,.7,.45]);}break;
 case 'iron':
  shell([2.3,.9,3.4],[0,0,0]);for(const s of [-1,1]){shell([.7,1.2,4],[s*1.6,0,0],dark);for(let i=0;i<4;i++)shell([.8,.2,.5],[s*1.6,.7,-1.2+i*.8]);}shell([1.7,.13,2],[0,.6,0],light);break;
 case 'furnace':
  for(const s of [-1,1]){shell([1.2,1.1,4],[s*1.3,0,0]);for(let i=0;i<4;i++)shell([1.3,.12,.18],[s*1.3,.6,-1.2+i*.7],light);}shell([2,.4,1.2],[0,0,0],dark);break;
 case 'crescent':
  for(let i=0;i<9;i++){const a=-Math.PI*.8+i*Math.PI*1.6/8;const o=shell([.6,.3,.9],[Math.cos(a)*1.9,0,Math.sin(a)*1.9]);o.rotation.y=-a;}spike([-.9,0,-2],[.3,2,.3],light);spike([-.9,0,2],[.3,2,.3],light);break;
 case 'twin':
  for(const s of [-1,1]){orb([s*1.2,0,0],[.7,.7,1.7]);ring(.8,[s*1.2,0,0],'z');spike([s*1.2,0,-2],[.4,2,.4],light);}shell([2.5,.25,.5],[0,0,.5]);break;
 case 'crown':
  orb([0,0,0],[1.1,.7,1.8]);ring(2.1);for(let i=0;i<7;i++){const a=i*TAU/7;const o=mesh(frame,coneGeometry(),armor,[Math.cos(a)*1.8,.7,Math.sin(a)*1.8],[.35,1.5,.35]);orb([o.position.x,1.5,o.position.z],[.18,.18,.18],light);}break;
 }
 }
 root.userData.core=orb([0,.6,-.5],[.3,.3,.4],light);
 // Role shapes are already included in a cached silhouette.
 if(!cachedFallback){
 if(role==='guard'){for(const s of [-1,1])shell([.3,1.3,2.6],[s*2.3,0,0]);}
 if(role==='gunner'){for(const s of [-1,1])cylinder(frame,.16,3.8,[s*.6,.8,-1.4],dark);}
 if(role==='support')ring(1,[0,1,0],'y');
 if(role==='flagship'){for(const s of [-1,1])shell([1,.5,3.2],[s*2.8,-.3,.5],dark);shell([.5,1.5,.6],[0,1,1]);}
 if(base){ring(3,[0,-.5,0],'y',armor);for(let i=0;i<4;i++){const a=i*TAU/4;shell([.5,2,.5],[Math.cos(a)*2.7,.3,Math.sin(a)*2.7]);}}
 }
 const size=boss?(e.campaignBoss==='warden'?3.2:4.5):base?2.2:role==='flagship'?2:role==='guard'?1.05:role==='striker'?.8:1;
 frame.scale.setScalar(size);
 if(!base)for(const s of [-1,1])engine(root,s*.8,-.15,2,.3,.6,true);
 // Prevent asynchronous generic modules from replacing these bespoke details.
 for(const nozzle of root.userData.engines)nozzle.userData.realAsset=true;
 hitShell(root,[2.7,1.7,3],theme.glow);
 if(cachedFallback){
  for(const item of cachedFallback){const hull=mesh(frame,item.geometry,item.material);hull.name='baked-armor';}
 }else{
  bakeArmor(root);
  if(cacheable)planetEnemyFallbackCache.set(root.userData.kind,frame.children.filter(o=>o.name==='baked-armor').map(o=>({geometry:o.geometry,material:o.material})));
 }
 root.userData.reusedPlanetFallback=!!cachedFallback;

 // Original PBR planetary hulls use the existing bounded asset pool and LOD.
 const hullRole=base?'fortress':boss||role==='flagship'?'capital':'fighter';
 const assetId='enemy-'+e.planetTheme+'-'+hullRole;
 root.userData.planetAssetId=assetId;
 const fallback=frame.children.filter(o=>o.name==='baked-armor');
 if(typeof window!=='undefined'){
  const readiness=beginPlanetAssetReadiness(root),resolve=value=>readiness.complete(value);
  {
   const ready=mount=>{if(!resolve(true))return;if(boss){frame.traverse(o=>{if(o.isMesh&&o.name==='meshy-boss-section')o.userData.planetHullEssential=true;});anchorPlanetBossWeapons(root);anchorPlanetBossCore(root);anchorPlanetBossEngines(root);}else{anchorPlanetHullCore(root,mount);anchorPlanetHullWeapons(root,mount,role);anchorPlanetHullEngines(root,mount);}installPlanetSignature(root,e.planetTheme,hullRole);root.userData.planetAssetReady=true;};
   if(boss){
    const ordered=[6,0,1,2,3,4,5];root.userData.parts=Array.from({length:7},()=>new THREE.Group());
    ordered.forEach((index,i)=>{const part=root.userData.parts[index];part.position.z=-3+i;frame.add(part);});
    mountBossHull(root,frame,'y',{assetId,size:6.6,hide:fallback,onReady:ready,onUnavailable:()=>resolve(false)});
   }else mountAsset(root,assetId,{parent:frame,size:base?7:role==='flagship'?6.6:5.4,hide:fallback,onReady:ready,onUnavailable:()=>resolve(false)});
  }
 }
 // Weapons and role equipment stay separate from the imported hull.
 if(role==='guard'&&!boss&&!base)for(const side of [-1,1]){const plate=shell([.22,.9,1.5],[side*1.65,.2,.15],armor);mountAsset(root,'module-shield',{parent:frame,size:1.3,position:[side*1.65,.2,.15],hide:[plate],onReady:mount=>installPlanetEquipmentLOD(mount,'shield')});}
 if(role==='support'&&!boss&&!base){const emitter=ring(.65,[0,1,0]);root.userData.rotors.push(emitter);mountAsset(root,'module-reactor',{parent:frame,size:1.2,position:[0,.85,.6],onReady:mount=>installPlanetEquipmentLOD(mount,'reactor')});}
 if(!base){
  const planetaryTurret=(position,scale,heavy=false)=>{const before=frame.children.length,pivot=turret(root,position,scale,true,heavy);pivot.userData.planetHullFootings=frame.children.slice(before).filter(o=>o!==pivot);if(boss)pivot.userData.planetBossFootings=pivot.userData.planetHullFootings;return pivot;};
  if(role==='gunner')for(const side of [-1,1])planetaryTurret([side*.75,1.05,-.6],.45,true);
  else if(role==='flagship'||boss)for(const side of [-1,1])planetaryTurret([side*1.25,.85,.2],.45,true);
  else if(role==='striker'||role==='guard'||role==='support')planetaryTurret([0,.65,role==='support'?-1.35:-1],.28);
 }
 // Hull materials and baked buffers belong to the shared planetary cache.
 return root;
}






