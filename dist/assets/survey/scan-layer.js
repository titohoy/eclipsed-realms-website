// Browser streamer for genuine affine instances and sectioned Unreal render meshes.
// No Three.js import: share the caller's renderer, coordinate system and lighting.
const P = {
  low:{tiles:12,draws:52,tris:240000,instances:1200,px:2.9,detail:210,mid:30,mb:34,delay:205},
  balanced:{tiles:26,draws:94,tris:650000,instances:2700,px:1.9,detail:148,mid:21,mb:70,delay:150},
  high:{tiles:44,draws:155,tris:1450000,instances:6000,px:1.15,detail:99,mid:15,mb:130,delay:105}
};
const TIME=()=>performance.now(),clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export const unrealToFlight=([x,y,z])=>[x*.01,z*.01,y*.01];
const magic=(d)=>String.fromCharCode(d.getUint8(0),d.getUint8(1),d.getUint8(2),d.getUint8(3));
function f16(x){const sign=x&32768?-1:1,e=(x>>10)&31,m=x&1023;return sign*(e===0?m*2**-24:e===31?(m?NaN:Infinity):(1+m/1024)*2**(e-15));}
export function decodeModel(T,buffer){
  const d=new DataView(buffer);if(buffer.byteLength<44||magic(d)!=='ERM2')throw Error('Invalid scan geometry');
  const n=d.getUint32(4,true),ni=d.getUint32(8,true),ng=d.getUint32(12,true),flags=d.getUint32(16,true),iw=flags&255,uv=!!(flags&256),colored=!!(flags&512);
  if(!n||!ni||ni%3||!ng||ng>65535||n>4000000||ni>15000000||![2,4].includes(iw))throw Error('Invalid scan geometry dimensions');
  const size=44+ng*12+n*((uv?12:8)+(colored?4:0))+ni*iw;if(size!==buffer.byteLength)throw Error('Incomplete scan geometry');
  const lo=[0,1,2].map(i=>d.getFloat32(20+i*4,true)),hi=[0,1,2].map(i=>d.getFloat32(32+i*4,true));
  const span=lo.map((v,i)=>(hi[i]-v)/65535);let off=44;const geometry=new T.BufferGeometry();
  for(let k=0;k<ng;k++){const slot=d.getUint32(off,true),start=d.getUint32(off+4,true),count=d.getUint32(off+8,true);if(slot>65535||start+count>ni)throw Error('Invalid geometry section');geometry.addGroup(start,count,slot);off+=12;}
  const quant=new Uint16Array(buffer,off,3*n);off+=6*n;
  const oct=new Int8Array(buffer,off,2*n);off+=2*n;const pos=new Float32Array(n*3),norm=new Int16Array(n*3);
  for(let j=0;j<n;j++){
    for(let a=0;a<3;a++)pos[j*3+a]=lo[a]+quant[j*3+a]*span[a];
    let x=oct[j*2]/127,y=oct[j*2+1]/127,z=1-Math.abs(x)-Math.abs(y);
    if(z<0){const px=x;x=(1-Math.abs(y))*(px<0?-1:1);y=(1-Math.abs(px))*(y<0?-1:1);}
    const k=32767/(Math.hypot(x,y,z)||1);norm[j*3]=Math.round(x*k);norm[j*3+1]=Math.round(y*k);norm[j*3+2]=Math.round(z*k);
  }
  geometry.setAttribute('position',new T.BufferAttribute(pos,3));geometry.setAttribute('normal',new T.BufferAttribute(norm,3,true));
  if(uv){const q=new Uint16Array(buffer,off,n*2);const v=new Float32Array(n*2);for(let i=0;i<v.length;i++)v[i]=f16(q[i]);geometry.setAttribute('uv',new T.BufferAttribute(v,2));off+=n*4;}
  if(colored){geometry.setAttribute('color',new T.BufferAttribute(new Uint8Array(buffer,off,n*4).slice(),4,true));off+=n*4;}
  const indices=iw===2?new Uint16Array(buffer,off,ni):new Uint32Array(buffer,off,ni);geometry.setIndex(new T.BufferAttribute(indices.slice(),1));geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData.byteSize=pos.byteLength+norm.byteLength+indices.byteLength+(uv?n*8:0)+(colored?n*4:0);return geometry;
}
function mirror(T,original){
  const g=original.clone(),p=g.attributes.position,n=g.attributes.normal,ix=g.index.array;
  for(let j=0;j<p.count;j++){p.setX(j,-p.getX(j));n.setX(j,-n.getX(j));}
  for(let j=0;j<ix.length;j+=3){const q=ix[j+1];ix[j+1]=ix[j+2];ix[j+2]=q;}
  g.computeBoundingBox();g.computeBoundingSphere();return g;
}
export function decodePlacements(T,buffer,manifest){
  let d=new DataView(buffer);if(buffer.byteLength<8||magic(d)!=='ERI2')throw Error('Invalid placement chunk');
  const count=d.getUint32(4,true);if(8+count*44!==buffer.byteLength)throw Error('Incomplete placement chunk');const raw=new Float32Array(buffer,8),ids=new Uint32Array(buffer,8),centers=new Float32Array(count*4);
  const tmp=new T.Vector3(),q=new T.Quaternion();
  for(let j=0;j<count;j++){const i=j*11,v=manifest.variants[ids[i]];if(!v)throw Error('Invalid mesh instance');const b=manifest.models[v[0]].bounds;
    tmp.set((b[0]+b[3])*.5*(v[2]?-1:1)*raw[i+8],(b[1]+b[4])*.5*raw[i+9],(b[2]+b[5])*.5*raw[i+10]);q.set(raw[i+4],raw[i+5],raw[i+6],raw[i+7]);tmp.applyQuaternion(q);centers.set([tmp.x+raw[i+1],tmp.y+raw[i+2],tmp.z+raw[i+3],Math.hypot((b[3]-b[0])*raw[i+8],(b[4]-b[1])*raw[i+9],(b[5]-b[2])*raw[i+10])*.5],j*4);}
  const order=Uint32Array.from({length:count},(_,i)=>i);order.sort((a,b)=>centers[b*4+3]-centers[a*4+3]);return {raw,ids,centers,count,order,byteSize:buffer.byteLength+centers.byteLength+order.byteLength};
}
async function unzip(b){
  const v=new Uint8Array(b);
  if(v[0]===31&&v[1]===139){
    if(typeof DecompressionStream!=='function')throw Error('Compressed scene data is unsupported in this browser');
    return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  }return b; // Some hosts decompress in HTTP transport.
}
export async function createScanLayer(T,scene,options={}){
  const manifestURL=new URL(options.manifestURL||'assets/scan/manifest.json',options.baseURL||document.baseURI);
  const r=await fetch(manifestURL);if(!r.ok)throw Error('Scan manifest unavailable');const manifest=await r.json();
  if(manifest.format!==2||(!manifest.complete&&!options.allowDraft)||!manifest.models?.length||!manifest.tiles?.length||!manifest.palette?.length||!manifest.variants?.length)throw Error('No verified scan layer');
  const quality=P[options.quality]?options.quality:'balanced';let opt={...P[quality]},disposed=false,last=-Infinity,lastWork=-Infinity,dirty=true,jobs=0,qualityMode=quality,rebuilds=0,errors=0,textureBytes=0;
  const group=new T.Group();group.name='Surveyed world';scene.add(group);
  const packCache=new Map();let packFetches=0;const resources=new Map(),draws=new Map(),wanted=new Map(),mats=new Map(),textures=new Map();
  const sphere=new T.Sphere(),frustum=new T.Frustum(),pv=new T.Matrix4(),eye=new T.Vector3(),v3=new T.Vector3(),qs=new T.Quaternion(),sc=new T.Vector3(),trs=new T.Matrix4(),lastEye=new T.Vector3(Infinity,0,0),lastAim=new T.Vector3(),lastQ=new T.Quaternion();
  const tmeta=manifest.tiles.map((t,i)=>({url:t[0],count:t[7],index:i,key:t.length>10?t[9]+','+t[10]:null,box:new T.Box3(new T.Vector3(t[1],t[2],t[3]),new T.Vector3(t[4],t[5],t[6]))}));
  const panorama=(manifest.panorama||[]).map(row=>({url:row[0],box:new T.Box3(new T.Vector3(row[1],row[2],row[3]),new T.Vector3(row[4],row[5],row[6])),tris:row[7],count:row[8]}));const panoramaDraws=new Map(),panoramaMat=new T.MeshStandardMaterial({vertexColors:true,roughness:.91,metalness:.04,side:T.DoubleSide});
  let totals={visible:0,triangles:0,drawCalls:0,tiles:0,overview:false};let replacementRows=null;const replacements=new Map();
  function setReplacements(rows){if(rows===replacementRows)return;replacementRows=rows;replacements.clear();for(const r of rows){const key=r[0]+'/'+Math.round(r[1]*10)+'/'+Math.round(r[2]*10)+'/'+Math.round(r[3]*10);if(!replacements.has(key))replacements.set(key,[]);replacements.get(key).push(r);}wake();}
  function replaced(model,x,y,z){if(!replacements.size)return false;const a=Math.round(x*10),b=Math.round(y*10),c=Math.round(z*10);for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){const rows=replacements.get(model+'/'+(a+i)+'/'+(b+j)+'/'+(c+k));if(rows?.some(r=>Math.abs(x-r[1])<.015&&Math.abs(y-r[2])<.015&&Math.abs(z-r[3])<.015))return true;}return false;}
  const fetchers=clamp(options.concurrency||4,1,8);
  function wake(){dirty=true;if(!disposed&&options.onChange)options.onChange();}
  function publicURL(s){
    if(!/^(?:b\/[0-9a-f]+\.pack|g\/[0-9a-f]+-[0-2]\.bin\.gz|p\/(?:[0-9a-f]+|overview)\.bin\.gz|tx\/[0-9a-f]{20}\.webp)$/.test(s))throw Error('Unexpected scan asset path');return new URL(s,manifestURL);
  }
  async function bytes(ref,signal){
    if(typeof ref==='string'){const r=await fetch(publicURL(ref),{signal});if(!r.ok)throw Error('Scan asset unavailable');return unzip(await r.arrayBuffer());}
    const m=manifest.members?.[ref];if(!Array.isArray(m)||m.length!==3)throw Error('Invalid scan member');const [pi,off,len]=m,p=manifest.packs[pi];if(!p||off<8||len<1||off+len>p[1])throw Error('Invalid scan pack index');
    let e=packCache.get(pi);if(!e){const controller=new AbortController();e={controller,used:TIME(),size:p[1],resolved:false};packCache.set(pi,e);packFetches++;
      e.promise=fetch(publicURL(p[0]),{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('World detail pack unavailable');return r.arrayBuffer()}).then(b=>{if(b.byteLength!==p[1]||magic(new DataView(b))!=='ERPK')throw Error('Damaged world detail pack');e.resolved=true;return b;}).catch(err=>{packCache.delete(pi);throw err;});}
    e.used=TIME();const data=await e.promise;return unzip(data.slice(off,off+len));
  }
  function want(url,kind,score){
    const e=resources.get(url);if(e?.value){e.used=TIME();return e.value;}if(e?.active||e?.until>TIME())return null;
    if(!wanted.has(url)||wanted.get(url).score<score)wanted.set(url,{url,kind,score});return null;
  }
  function pump(){
    if(disposed)return;
    const queue=Array.from(wanted.values()).sort((a,b)=>b.score-a.score);let i=0;
    while(jobs<fetchers&&i<queue.length){
      const {url,kind}=queue[i++];wanted.delete(url);let e=resources.get(url);if(e?.active||e?.value||e?.until>TIME())continue;
      e=e||{failure:0};resources.set(url,e);e.kind=kind;e.active=true;e.aborter=new AbortController();jobs++;
      bytes(url,e.aborter.signal).then(b=>{if(disposed)return;const value=kind==='g'?decodeModel(T,b):decodePlacements(T,b,manifest);e.value=value;e.used=TIME();e.size=kind==='g'?value.userData.byteSize:value.byteSize;}).catch(err=>{if(disposed)return;e.failure++;errors++;e.until=TIME()+Math.min(60000,2000*2**e.failure);if(options.onError)options.onError(err);}).finally(()=>{e.active=false;e.aborter=null;jobs--;wake();pump();});
    }
  }
  function getMat(pi,canTexture){
    const m=manifest.palette[pi],hasThumb=canTexture&&m[6],key=pi+(hasThumb?':uv':':surface');let mat=mats.get(key);if(mat)return mat;
    mat=new T.MeshStandardMaterial({roughness:m[3],metalness:m[4],side:m[5]?T.DoubleSide:T.FrontSide});mat.color.setRGB(m[0],m[1],m[2]);mats.set(key,mat);
    if(hasThumb){
      if(!textures.has(m[6])){
        const txPath=publicURL(m[6]),task=new T.TextureLoader().loadAsync(txPath.href).then(tex=>{if(disposed){tex.dispose();return null;}tex.colorSpace=T.SRGBColorSpace;tex.flipY=false;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.anisotropy=2;tex.needsUpdate=true;textureBytes+=(tex.image?.width||64)*(tex.image?.height||64)*5;return tex;}).catch(err=>{if(!disposed){errors++;options.onError?.(err);}return null;});textures.set(m[6],task);
      }
      textures.get(m[6]).then(tex=>{if(!tex||disposed)return;mat.color.setRGB(1,1,1);mat.map=tex;mat.alphaTest=m[7]||0;mat.needsUpdate=true;wake();});
    }return mat;
  }
  function evict(protectedURLs,now){
    let memory=0;const removable=[];for(const [url,e] of resources){if(!e.value)continue;memory+=e.size;if(!protectedURLs.has(url)&&!e.active)removable.push([url,e]);}
    let packBytes=Array.from(packCache.values()).reduce((n,e)=>n+e.size,0);for(const [id,e] of [...packCache].sort((a,b)=>a[1].used-b[1].used)){if(packBytes<=Math.min(24,opt.mb*.23)*1048576)break;if(e.resolved){packCache.delete(id);packBytes-=e.size;}}
    const limit=opt.mb*1048576;removable.sort((a,b)=>a[1].used-b[1].used);
    for(const [url,e] of removable){if(memory<=limit&&now-e.used<90000)break;memory-=e.size;if(e.kind==='g'){e.value.dispose();e.mirrored?.dispose();}resources.delete(url);}
  }
  function refresh(camera,aim,now){
    rebuilds++;wanted.clear();const protectedURLs=new Set();let near=[],selected=[],viewH=Math.max(160,options.getViewportHeight?.()||globalThis.innerHeight||800);
    camera.getWorldPosition(eye);pv.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(pv);
    const dist=eye.distanceTo(aim),persp=!camera.isOrthographicCamera,focus=persp?viewH/(2*Math.tan((camera.fov||45)*Math.PI/360))*camera.zoom:viewH*camera.zoom/(camera.top-camera.bottom);
    const overview=!!manifest.overview&&dist>(options.overviewDistance||820),loadedKeys=new Set();
    if(overview&&panorama.length){
      // Satellite altitude: one batched, source-derived mesh per visible large cell.
      // The first frame does not need scores of individual building or tree resources.
      const visible=panorama.filter(t=>frustum.intersectsBox(t.box)).sort((a,b)=>a.box.distanceToPoint(aim)-b.box.distanceToPoint(aim));const active=new Set();let count=0,tris=0;
      for(const t of visible){const mesh=want(t.url,'g',2e8/(1+t.box.distanceToPoint(aim)*.001));if(!mesh)continue;protectedURLs.add(t.url);active.add(t.url);count+=t.count;tris+=t.tris;
        if(!panoramaDraws.has(t.url)){const m=new T.Mesh(mesh,panoramaMat);m.receiveShadow=false;m.name='Distant survey';group.add(m);panoramaDraws.set(t.url,m);}}
      for(const [k,m] of panoramaDraws)if(!active.has(k)){group.remove(m);panoramaDraws.delete(k);}
      for(const [k,i] of draws){group.remove(i.mesh);i.mesh.dispose();draws.delete(k);}
      totals={visible:count,triangles:tris,drawCalls:active.size,tiles:active.size,overview:true};evict(protectedURLs,now);pump();return;
    }
    for(const m of panoramaDraws.values())group.remove(m);panoramaDraws.clear();
    if(!overview){
      for(const t of tmeta){
        if(!frustum.intersectsBox(t.box))continue;
        const d=t.box.distanceToPoint(eye),f=t.box.distanceToPoint(aim);near.push([d+.43*f,t]);
      }
      near.sort((a,b)=>a[0]-b[0]);for(const [d,t] of near.slice(0,opt.tiles)){
        const v=want(t.url,'p',1e8/(1+d*.002));if(v){protectedURLs.add(t.url);selected.push(v);if(t.key)loadedKeys.add(t.key);}
      }
    }
    if(manifest.overview&&(overview||selected.length<Math.min(near.length,opt.tiles))){
      const u=manifest.overview[0],v=want(u,'p',2e8);if(v){protectedURLs.add(u);selected.push(Object.assign(Object.create(v),{overview:true}));}
    }
    const bins=new Map();
    for(const tile of selected){
      const {raw,ids,centers,count}=tile;
      const limit=Math.min(count,Math.max(800,Math.floor((qualityMode==='high'?120000:qualityMode==='low'?28000:65000)/Math.max(1,selected.length))));
      for(let checked=0;checked<limit;checked++){const j=tile.order[checked];
        const a=j*4,i=j*11,r=centers[a+3];if(!(r>0))continue;
        sphere.center.set(centers[a],centers[a+1],centers[a+2]);sphere.radius=r;
        if(!frustum.intersectsSphere(sphere))continue;
        if(tile.overview&&!overview&&loadedKeys.has(Math.floor(sphere.center.x/manifest.tileSize)+','+Math.floor(sphere.center.z/manifest.tileSize)))continue;
        const d=Math.max(.3,eye.distanceTo(sphere.center)-r*.6),px=clamp(r*2*focus/(persp?d:1),0,5000);
        if(px<opt.px)continue;const variant=ids[i],v=manifest.variants[variant],geo=manifest.models[v[0]];if(replaced(v[0],raw[i+1],raw[i+2],raw[i+3]))continue;
        const level=px>=opt.detail?0:px>=opt.mid?1:2,entry=geo.levels[level],key=variant+'@'+entry[0];
        let b=bins.get(key);if(!b){b={variant,geo,key,level,entry,score:0,items:[]};bins.set(key,b);}b.score=Math.max(b.score,px);b.items.push([px,raw,i]);
      }
    }
    const chosen=Array.from(bins.values()).sort((a,b)=>b.score-a.score);let dc=0,tri=0,visible=0;const binsToDraw=new Map();
    for(const b of chosen){
      if(dc>=opt.draws||visible>=opt.instances||tri>=opt.tris)break;
      const v=manifest.variants[b.variant];let level=b.level;let entry=b.entry;
      // In dense views lower the actual source LOD to preserve scene breadth.
      while(level<2&&entry[1]*Math.min(b.items.length,12)>Math.max(2000,(opt.tris-tri)*.28)){level++;entry=b.geo.levels[level];}
      let geom=want(entry[0],'g',1e7+Math.min(b.score,4500)*10000);
      if(!geom){for(let l=level+1;l<3;l++){const alt=b.geo.levels[l],e=resources.get(alt[0]);if(e?.value){entry=alt;geom=e.value;e.used=now;break;}}}
      if(!geom)continue;const dcs=geom.groups.length||1;if(dc+dcs>opt.draws)continue;
      const n=Math.min(b.items.length,opt.instances-visible,Math.floor((opt.tris-tri)/entry[1]));
      if(n<=0)continue;const drawKey=b.variant+'@'+entry[0];let pack=binsToDraw.get(drawKey);
      if(!pack){pack={v,geo:b.geo,geom,entry,variant:b.variant,items:[]};binsToDraw.set(drawKey,pack);dc+=dcs;}
      b.items.sort((a,b)=>b[0]-a[0]);for(let i=0;i<n;i++)pack.items.push(b.items[i]);visible+=n;tri+=n*entry[1];
    }
    for(const [key,pack] of binsToDraw){
      const {v,geo,entry,items}=pack;let geom=pack.geom,e=resources.get(entry[0]);protectedURLs.add(entry[0]);
      if(v[2]){if(!e.mirrored){e.mirrored=mirror(T,geom);e.size+=geom.userData.byteSize;}geom=e.mirrored;}
      let item=draws.get(key);
      if(!item||item.capacity<items.length){
        if(item){group.remove(item.mesh);item.mesh.dispose();}const capacity=Math.min(opt.instances,2**Math.ceil(Math.log2(Math.max(1,items.length))));
        const palette=v[1].map((pi,slot)=>getMat(pi,geo.uvSlots?.includes(slot))),mesh=new T.InstancedMesh(geom,palette,capacity);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.name='Survey detail';
        item={mesh,capacity,url:entry[0]};draws.set(key,item);group.add(mesh);
      }
      item.mesh.visible=true;item.mesh.castShadow=!!options.castShadow&&dist<100;item.mesh.count=items.length;
      for(let j=0;j<items.length;j++){const [,raw,i]=items[j];v3.set(raw[i+1],raw[i+2],raw[i+3]);qs.set(raw[i+4],raw[i+5],raw[i+6],raw[i+7]);sc.set(raw[i+8],raw[i+9],raw[i+10]);trs.compose(v3,qs,sc);item.mesh.setMatrixAt(j,trs);}
      item.mesh.instanceMatrix.needsUpdate=true;item.mesh.boundingSphere=null;item.mesh.boundingBox=null;
    }
    for(const [key,item] of draws)if(!binsToDraw.has(key)){group.remove(item.mesh);item.mesh.dispose();draws.delete(key);}
    totals={visible,triangles:tri,drawCalls:dc,tiles:selected.length,overview};evict(protectedURLs,now);pump();
  }
  function update(camera,target,force=false){
    if(disposed||!camera||!target)return;let now=TIME();if(!force&&now-lastWork<opt.delay&&!dirty)return;
    const aim=Array.isArray(target)?new T.Vector3(...target):target;camera.getWorldPosition(eye);const q=camera.getWorldQuaternion(qs);
    if(!force&&!dirty&&eye.distanceToSquared(lastEye)<.18&&aim.distanceToSquared(lastAim)<.18&&1-Math.abs(q.dot(lastQ))<.00006&&now-last<2000)return;
    dirty=false;lastWork=now;last=now;lastAim.copy(aim);lastEye.copy(eye);lastQ.copy(q);refresh(camera,aim,now);
  }
  function setQuality(q){if(!P[q])throw Error('Unknown scene quality');qualityMode=q;opt={...P[q]};wake();}
  function stats(){return {...totals,quality:qualityMode,packRequests:packFetches,packCacheBytes:Array.from(packCache.values()).reduce((n,e)=>n+e.size,0),requests:jobs,errors,rebuilds,surfaceMemoryBytes:textureBytes,geometryAndPlacementBytes:Array.from(resources.values()).reduce((n,e)=>n+(e.size||0),0),source:manifest.summary};}
  function dispose(){if(disposed)return;disposed=true;scene.remove(group);wanted.clear();for(const e of packCache.values())e.controller.abort();packCache.clear();for(const e of resources.values()){e.aborter?.abort();if(e.kind==='g'){e.value?.dispose();e.mirrored?.dispose();}}for(const i of draws.values())i.mesh.dispose();panoramaMat.dispose();panoramaDraws.clear();for(const m of mats.values())m.dispose();for(const t of textures.values())t.then(tex=>tex?.dispose());group.clear();resources.clear();draws.clear();mats.clear();textures.clear();}
  const pick=(raycaster,options={})=>{if(disposed)return null;group.updateWorldMatrix(true,true);let hits=raycaster.intersectObjects(group.children,false);if(Number.isFinite(options.y))hits=hits.filter(hit=>Math.abs(hit.point.y-options.y)<(options.tolerance??.65));if(options.floor)hits.sort((a,b)=>a.point.y-b.point.y);const hit=hits[0];return hit?{point:hit.point.clone(),distance:hit.distance}:null;};
  return {group,manifest,update,setQuality,setReplacements,stats,dispose,pick};
}
