import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),base=path.join(root,'dist/assets/scenes');
const read=file=>JSON.parse(fs.readFileSync(path.join(base,file),'utf8'));
const exact=(object,allowed,label)=>{for(const key of Object.keys(object))assert(allowed.includes(key),label+': unexpected field '+key);};
const catalog=read('manifest.json'),checked=new Set();exact(catalog,['schema','scenes'],'catalog');assert.equal(catalog.schema,1);
let models=0,instances=0,totalBytes=0;
for(const required of ['cage','arena','gallows','thornhallow','veilcross','cairnhold'])assert(catalog.scenes[required],'Missing detailed scenery: '+required);
for(const [scene,entry]of Object.entries(catalog.scenes)){
 exact(entry,['file'],'scene entry');const set=read(entry.file);exact(set,['schema','models','instances','replacements'],'scene');
 assert.equal(set.schema,1);models+=set.models.length;instances+=set.instances.length;
 for(const m of set.models){
  exact(m,['id','file','files','farFile','triangles','bounds','textures','coarseModel'],'model');assert(m.bounds.length===6&&m.bounds.every(Number.isFinite));assert(Number.isInteger(m.coarseModel));assert(m.triangles>0);
  for(const [id,w,h]of m.textures){assert(/^[a-f0-9]{64}$/.test(id));assert(w>0&&h>0&&w<=4096&&h<=4096);}
  for(const file of new Set([...(m.files||[m.file]),m.farFile].filter(Boolean))){
   assert(/^models\/[a-f0-9]+\.glb\.gz$/.test(file),'Invalid model path');
   if(checked.has(file))continue;checked.add(file);
   const packed=fs.readFileSync(path.join(base,file));totalBytes+=packed.length;assert(packed.length<25*1024*1024,'Model exceeds hosting file size: '+file);
   assert(path.basename(file).startsWith(crypto.createHash('sha256').update(packed).digest('hex').slice(0,32)),'Scenery identity mismatch');
   const bytes=zlib.gunzipSync(packed);assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);
   const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));assert(!doc.animations&&!doc.skins,'Unexpected scenery animation');
   assert(!/\/Game\/|\/Engine\/|\.uasset|[A-Z]:\\|WorldGridMaterial|T_Flat_Grey|T_Flat_White/i.test(JSON.stringify(doc)),'Private or placeholder content in scenery');
   assert((doc.images||[]).every(image=>!image.uri&&Number.isInteger(image.bufferView)),'Scenery image must be embedded');
   for(const mesh of doc.meshes)for(const primitive of mesh.primitives){
    const material=doc.materials[primitive.material];assert(primitive.attributes.POSITION!=null&&primitive.attributes.NORMAL!=null);
    function inspect(value){if(!value||typeof value!=='object')return;for(const [key,item]of Object.entries(value)){
     if(/Texture$/.test(key)&&item&&Number.isInteger(item.index)){const channel=item.extensions?.KHR_texture_transform?.texCoord??item.texCoord??0;assert(primitive.attributes['TEXCOORD_'+channel]!=null,'Material references absent UV channel in '+file);}
     else inspect(item);
    }}inspect(material);
   }
  }
 }
 for(const row of set.instances){assert(row.length===11&&row.every(Number.isFinite));assert(Number.isInteger(row[0])&&set.models[row[0]]);assert(Math.abs(Math.hypot(...row.slice(4,8))-1)<.001);}
 for(const row of set.replacements)assert(row.length===4&&row.every(Number.isFinite));
}
console.log(JSON.stringify({ok:true,scenes:Object.keys(catalog.scenes),models,instances,geometryFiles:checked.size,compressedBytes:totalBytes,uvBindingsVerified:true,hostingFileSizesVerified:true}));
