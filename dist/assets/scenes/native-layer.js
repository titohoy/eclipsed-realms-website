import {GLTFLoader} from '../people/engine/GLTFLoader.js';
import {applyWorldProjection} from './world-material.js';

export async function createNativeLayer(T,scene,options={}){
 const manifestURL=new URL(options.manifestURL||'./manifest.json',import.meta.url),root=new URL('./',manifestURL);
 const catalog=await fetch(manifestURL).then(r=>{if(!r.ok)throw Error('Detailed scenery unavailable');return r.json()});
 if(catalog.schema!==1||!catalog.scenes)throw Error('Invalid scenery catalog');
 const loader=new GLTFLoader(),states=new Map(),files=new Map(),images=new Map(),errors=[],emptyRows=[];
 let active=null,stamp=0,disposed=false,lastWork=0,replacementRows=emptyRows,replacementStamp='',inFlight=0;
 const maxInFlight=Math.max(1,options.concurrency||2);
 const frustum=new T.Frustum(),projection=new T.Matrix4(),eye=new T.Vector3(),corner=new T.Vector3();
 const wake=()=>{stamp++;options.onChange?.()};
 const keyOf=(model,x,y,z)=>[model,Math.round(x*100),Math.round(y*100),Math.round(z*100)].join(':');
 function url(file){
  if(typeof file!=='string'||file.includes('..')||! /^\w+\/[a-f0-9]+\.(?:json|glb(?:\.gz)?)$/.test(file))throw Error('Invalid scenery path');
  const u=new URL(file,root);if(u.origin!==root.origin)throw Error('Invalid scenery origin');return u;
 }
 async function acquire(file){
  let item=files.get(file);
  if(!item){
   item={refs:0,promise:null};files.set(file,item);
   item.promise=(async()=>{
    const r=await fetch(url(file));if(!r.ok)throw Error('Scenery model unavailable');let b=await r.arrayBuffer();
    const signature=new Uint8Array(b,0,Math.min(2,b.byteLength));
    if(signature[0]===31&&signature[1]===139)b=await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    if(b.byteLength>180*1048576)throw Error('Scenery model exceeds safe memory size');
    const gltf=await loader.parseAsync(b,root.href);if(gltf.animations?.length)throw Error('Unexpected animated scenery');gltf.scene.updateMatrixWorld(true);
    const parts=[],geometries=new Set(),materials=new Set(),textures=new Set(),imageKeys=[],duplicateImages=new Set();
    gltf.scene.traverse(o=>{
     if(!o.isMesh)return;if(o.isSkinnedMesh)throw Error('Unexpected scenery rig');
     for(const m of Array.isArray(o.material)?o.material:[o.material]){
      if(!materials.has(m))applyWorldProjection(T,m);materials.add(m);for(const value of Object.values(m)){
       if(!value?.isTexture||textures.has(value))continue;textures.add(value);const key=value.name;
       if(/^[a-f0-9]{64}$/.test(key)){
        const saved=images.get(key);
        if(saved){if(value.source!==saved.source)duplicateImages.add(value.source.data);value.source=saved.source;saved.refs++;}
        else images.set(key,{source:value.source,refs:1});imageKeys.push(key);
       }value.anisotropy=4;
      }
     }
     o.geometry.computeBoundingBox();geometries.add(o.geometry);
     parts.push({geometry:o.geometry,material:o.material,matrix:o.matrixWorld.clone(),box:o.geometry.boundingBox.clone(),triangles:(o.geometry.index?.count||o.geometry.attributes.position.count)/3,mirrored:null});
    });
    for(const bitmap of duplicateImages)if(![...images.values()].some(v=>v.source.data===bitmap))bitmap?.close?.();
    if(!parts.length)throw Error('Empty scenery model');return {parts,geometries,materials,textures,imageKeys};
   })();
  }
  item.refs++;return item.promise;
 }
 function release(data){
  if(!data)return;for(const p of data.parts)p.mirrored?.dispose();for(const g of data.geometries)g.dispose();for(const m of data.materials)m.dispose();for(const t of data.textures)t.dispose();
  for(const key of data.imageKeys){const image=images.get(key);if(image&&--image.refs===0){image.source.data?.close?.();images.delete(key);}}
 }
 function drop(file){
  const item=files.get(file);if(!item||--item.refs>0)return;files.delete(file);item.promise.then(release).catch(()=>{});
 }
 function mirror(original){
  const g=original.clone(),p=g.getAttribute('position'),n=g.getAttribute('normal'),t=g.getAttribute('tangent');
  for(let i=0;i<p.count;i++){p.setX(i,-p.getX(i));if(n)n.setX(i,-n.getX(i));if(t){t.setX(i,-t.getX(i));t.setW(i,-t.getW(i));}}
  if(!g.index)g.setIndex(new T.BufferAttribute(Uint32Array.from({length:p.count},(_,i)=>i),1));
  const ix=g.index.array;for(let i=0;i<ix.length;i+=3){const a=ix[i+1];ix[i+1]=ix[i+2];ix[i+2]=a;}g.computeBoundingBox();return g;
 }
 function batches(state,index,data,level){
  const out=[];
  for(const part of data.parts){
   const groups=[[],[]];
   for(const row of state.rows[index]){
    const matrix=row.matrix.clone().multiply(part.matrix),box=part.box.clone().applyMatrix4(matrix);
    const p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();matrix.decompose(p,q,s);
    const reflected=s.x<0;if(reflected){s.x=-s.x;matrix.compose(p,q,s);}
    groups[reflected?1:0].push({matrix,box,rid:row.rid});
   }
   for(let side=0;side<2;side++){
    const rows=groups[side];if(!rows.length)continue;const geometry=side?(part.mirrored??=mirror(part.geometry)):part.geometry;
    const mesh=new T.InstancedMesh(geometry,part.material,rows.length);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.castShadow=true;mesh.visible=false;state.group.add(mesh);
    out.push({mesh,rows,triangles:part.triangles,level,index});
   }
  }return out;
 }
 async function ensure(key){
  if(states.has(key))return states.get(key).promise;const entry=catalog.scenes[key];if(!entry)return null;
  const state={key,group:new T.Group(),ready:false,disposed:false,used:performance.now(),set:null,error:null,slots:new Map(),wanted:new Set(),rows:[],exclusions:[],revision:0};states.set(key,state);scene.add(state.group);
  state.promise=(async()=>{
   const set=await fetch(url(entry.file)).then(r=>{if(!r.ok)throw Error('Scenery set unavailable');return r.json()});
   if(set.schema!==1||!Array.isArray(set.models)||!Array.isArray(set.instances)||!Array.isArray(set.replacements))throw Error('Invalid scenery set');
   for(const m of set.models)if(!Array.isArray(m.bounds)||m.bounds.length!==6||!Array.isArray(m.textures)||!Number.isInteger(m.coarseModel))throw Error('Missing scenery admission metadata');
   state.set=set;state.rows=set.models.map(()=>[]);const exactKeys=new Set();
   set.instances.forEach((row,rid)=>{
    if(row.length!==11||!row.every(Number.isFinite)||!set.models[row[0]])throw Error('Invalid scenery placement');
    const index=row[0],m=set.models[index],matrix=new T.Matrix4().compose(new T.Vector3(...row.slice(1,4)),new T.Quaternion(...row.slice(4,8)),new T.Vector3(...row.slice(8,11)));
    const box=new T.Box3(new T.Vector3(...m.bounds.slice(0,3)),new T.Vector3(...m.bounds.slice(3,6))).applyMatrix4(matrix);
    const replacementKey=keyOf(m.coarseModel,...row.slice(1,4));exactKeys.add(replacementKey);
    state.rows[index].push({rid,matrix,box,replacementKey});
   });
   state.byReplacement=new Map(set.replacements.map(row=>[keyOf(...row),row]));
   state.exclusions=set.replacements.filter(row=>!exactKeys.has(keyOf(...row)));
   if(disposed||state.disposed)return state;state.ready=true;wake();return state;
  })().catch(error=>{state.error=error.message;errors.push({key,error:error.message});wake();return state;});return state.promise;
 }
 function evict(state,index){
  const slot=state.slots.get(index);if(!slot)return;state.slots.delete(index);slot.cancelled=true;
  for(const batch of slot.batches){state.group.remove(batch.mesh);batch.mesh.dispose();}
  for(const file of slot.files)drop(file);state.revision++;
 }
 function load(state,index,high=false){
  const metadata=state.set.models[index];let slot=state.slots.get(index);
  if(!slot){slot={files:new Set(),completed:new Set(),batches:[],ready:false,high:false,pending:new Set(),cancelled:false};state.slots.set(index,slot);}
  const sourceFiles=metadata.files||[metadata.file],baseFiles=metadata.farFile?[metadata.farFile]:sourceFiles,requested=high?sourceFiles:baseFiles;
  for(const file of requested){
   if(slot.files.has(file))continue;if(inFlight>=maxInFlight)break;
   slot.files.add(file);slot.pending.add(file);inFlight++;
   acquire(file).then(data=>{
    if(disposed||state.disposed||slot.cancelled)return;
    slot.batches.push(...batches(state,index,data,high||!metadata.farFile?'source':'far'));slot.completed.add(file);
    slot.ready=baseFiles.every(f=>slot.completed.has(f));slot.high=sourceFiles.every(f=>slot.completed.has(f));state.revision++;
   }).catch(error=>{errors.push({key:state.key,error:error.message});slot.error=error.message;}).finally(()=>{slot.pending.delete(file);inFlight--;wake();});
  }
 }
 function projectedArea(box){
  if(box.containsPoint(eye))return 4;let minX=1,minY=1,maxX=-1,maxY=-1;
  for(let i=0;i<8;i++){
   corner.set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).applyMatrix4(projection);
   if(corner.z< -1||corner.z>1)continue;
   minX=Math.min(minX,corner.x);maxX=Math.max(maxX,corner.x);minY=Math.min(minY,corner.y);maxY=Math.max(maxY,corner.y);
  }
  return Math.max(0,Math.min(1,maxX)-Math.max(-1,minX))*Math.max(0,Math.min(1,maxY)-Math.max(-1,minY));
 }
 let visibleTriangles=0,visibleInstances=0,plannedMiB=0,lastSourceChoices=new Set();
 function update(camera,target,key,distance){
  if(disposed)return;active=key;const now=performance.now();
  if(catalog.scenes[key]&&distance<450)ensure(key);
  const state=states.get(key),show=state?.ready&&distance<170;
  for(const [id,s]of states){s.group.visible=Boolean(show&&id===key);if(id!==key&&s.slots.size){for(const index of [...s.slots.keys()])evict(s,index);}}
  if(states.size>2){const oldest=[...states.values()].filter(s=>s.key!==key).sort((a,b)=>a.used-b.used)[0];if(oldest)retire(oldest.key);}
  if(!show){replacementRows=emptyRows;replacementStamp='';visibleTriangles=visibleInstances=0;return;}
  state.used=now;if(now-lastWork<130&&stamp===state.stamp)return;lastWork=now;state.stamp=stamp;
  camera.getWorldPosition(eye);projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);
  const height=options.getViewportHeight?.()||innerHeight,width=height*camera.aspect,limit=(options.textureBudgetMiB??(width<780?190:350))*1048576;
  const candidates=[];
  for(let index=0;index<state.set.models.length;index++){
   let score=0,minDistance=Infinity;
   for(const row of state.rows[index]){
    const d=row.box.distanceToPoint(eye);minDistance=Math.min(minDistance,d);
    if(frustum.intersectsBox(row.box))score+=Math.max(.002,projectedArea(row.box))/(1+d*.035);
   }
   if(score>0||options.preloadAll)candidates.push({index,score:score||.00001,minDistance});
  }
  candidates.sort((a,b)=>b.score-a.score);
  const chosenImages=new Map(),wanted=new Set();let planned=0;
  for(const item of candidates){
   const m=state.set.models[item.index];let extra=0;
   for(const [hash,w,h]of m.textures)if(!chosenImages.has(hash))extra+=w*h*16/3;
   if(planned+extra>limit)continue;wanted.add(item.index);planned+=extra;
   for(const texture of m.textures)chosenImages.set(texture[0],texture);
  }plannedMiB=planned/1048576;state.wanted=wanted;
  for(const index of [...state.slots.keys()])if(!wanted.has(index))evict(state,index);
  for(const item of candidates)if(wanted.has(item.index))load(state,item.index);
  const eligible=[];let committed=0;
  for(const {index}of candidates){
   const slot=state.slots.get(index),m=state.set.models[index];if(!slot?.ready)continue;
   for(const row of state.rows[index]){
    if(!frustum.intersectsBox(row.box))continue;
    if(!m.farFile)committed+=m.triangles;
    else eligible.push({rid:row.rid,index,area:projectedArea(row.box)*width*height/4,cost:m.triangles});
   }
  }
  eligible.sort((a,b)=>b.area/b.cost-a.area/a.cost);
  const budget=Math.max(0,(width<780?2200000:5500000)-committed),choices=new Set();let used=0;
  for(const c of eligible){
   if(c.area<(lastSourceChoices.has(c.rid)?6500:12500)||used+c.cost>budget)continue;choices.add(c.rid);used+=c.cost;
  }
  for(const c of eligible)if(choices.has(c.rid)&&inFlight<maxInFlight)load(state,c.index,true);
  lastSourceChoices=choices;visibleTriangles=visibleInstances=0;
  for(const [index,slot]of state.slots){
   if(!slot.ready)continue;
   for(const b of slot.batches){
    let n=0;for(const row of b.rows){
     if(!frustum.intersectsBox(row.box))continue;const useSource=!state.set.models[index].farFile||slot.high&&choices.has(row.rid);
     if((b.level==='source')!==useSource)continue;b.mesh.setMatrixAt(n++,row.matrix);
    }
    b.mesh.visible=n>0;b.mesh.count=n;b.mesh.castShadow=distance<38;b.mesh.instanceMatrix.needsUpdate=n>0;
    visibleInstances+=n;visibleTriangles+=n*b.triangles;
   }
  }
  const revision=key+':'+state.revision;
  if(replacementStamp!==revision){
   const rows=[...state.exclusions];
   for(const [index,slot]of state.slots)if(slot.ready)for(const placement of state.rows[index]){const row=state.byReplacement.get(placement.replacementKey);if(row)rows.push(row);}
   replacementRows=rows;replacementStamp=revision;
  }
 }
 function retire(key){
  const state=states.get(key);if(!state)return;state.disposed=true;states.delete(key);
  for(const index of [...state.slots.keys()])evict(state,index);scene.remove(state.group);state.group.clear();
 }
 async function dispose(){disposed=true;for(const key of [...states.keys()])retire(key);await Promise.allSettled([...files.values()].map(v=>v.promise));}
 return {hasScene:key=>Boolean(catalog.scenes[key]),update,replacements:()=>replacementRows,dispose,stats:()=>({active,sets:[...states].map(([key,s])=>({key,ready:s.ready,requested:s.wanted.size,loaded:[...s.slots.values()].filter(v=>v.ready).length,allReady:s.wanted.size>0&&[...s.wanted].every(i=>s.slots.get(i)?.ready&&!s.slots.get(i)?.error),error:s.error})),visibleTriangles,visibleInstances,plannedMiB,sharedImages:images.size,textureMiB:[...images.values()].reduce((n,v)=>n+(v.source.data?.width||0)*(v.source.data?.height||0)*16/3,0)/1048576,loading:inFlight,errors})};
}
