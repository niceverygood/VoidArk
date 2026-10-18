import { defineConfig } from 'vite';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export default defineConfig({
  plugins:[{name:'generated-asset-files',configureServer(server){server.middlewares.use(async(req,res,next)=>{const name=req.url?.split('?')[0].match(/^\/assets\/meshy\/([a-zA-Z0-9-]+\.(glb|png|json))$/);if(!name)return next();try{const bytes=await readFile(fileURLToPath(new URL(`./public/assets/meshy/${name[1]}`,import.meta.url)));res.setHeader('Content-Type',name[2]==='glb'?'model/gltf-binary':name[2]==='png'?'image/png':'application/json');res.setHeader('Cache-Control','no-cache');res.end(req.method==='HEAD'?undefined:bytes);}catch{res.statusCode=404;res.end('Asset not generated yet');}});}}],
  server:{host:'127.0.0.1',port:4190,strictPort:true,watch:{ignored:['**/asset-sources/**','**/public/assets/meshy/**','**/release/**']},proxy:{'/galaxy':{target:'ws://127.0.0.1:4200',ws:true}}},
  preview:{host:'127.0.0.1',port:4191,strictPort:true},
  build:{target:'es2022',rollupOptions:{input:{ending:fileURLToPath(new URL('./boss-ending-preview.html',import.meta.url)),game:fileURLToPath(new URL('./index.html',import.meta.url)),combat:fileURLToPath(new URL('./combat-preview.html',import.meta.url)),enemies:fileURLToPath(new URL('./planet-enemies-preview.html',import.meta.url))},output:{manualChunks(id){if(id.includes('node_modules/three/'))return 'engine-3d';}}}},
});

