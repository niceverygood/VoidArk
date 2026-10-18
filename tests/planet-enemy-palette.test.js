import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createFactionHullMaterial} from '../src/faction-identity.js';
test('planetary enemies retain authored PBR colors while generic hostile identity and ownership stay intact',()=>{
 const gold=new THREE.MeshStandardMaterial({color:0xba9459}),blue=new THREE.MeshStandardMaterial({color:0x3269a8});
 const first=createFactionHullMaterial(gold,'enemy',{preservePalette:true}),second=createFactionHullMaterial(blue,'enemy',{preservePalette:true}),generic=createFactionHullMaterial(blue,'enemy');
 assert.notEqual(first.color.getHex(),second.color.getHex());assert.equal(first.color.getHex(),gold.color.getHex());assert.equal(second.color.getHex(),blue.color.getHex());assert.notEqual(generic.color.getHex(),blue.color.getHex());assert.notEqual(first,gold);
 first.dispose();second.dispose();generic.dispose();assert.equal(gold.color.getHex(),0xba9459);gold.dispose();blue.dispose();
});
