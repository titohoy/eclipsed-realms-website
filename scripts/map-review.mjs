import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Private build-time guard. No writes. Source identity is based on contents, never timestamps alone.
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const json = filename => JSON.parse(fs.readFileSync(filename,'utf8').replace(/^\uFEFF/,''));
const requireValue = (condition, message) => { if (!condition) throw Error('Map review: '+message); };
const hex = value => typeof value==='string' && /^[0-9a-f]{64}$/.test(value);
const sorted = entries => [...entries].sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
const digestOf = pairs => hash(JSON.stringify(sorted(pairs)));
const manifestAt = root => json(path.join(root,'content','atlas','watched-inputs.json'));
const expectedMap = '/Game/Maps/L_EclipsedRealms_OpenWorldMap';
const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);
const slug = name => name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'');
const fixedBounds = {minX:-201600,minY:-201600,maxX:201600,maxY:201600};
const surfaceIDs = ['AbandonedVillage','CavePath','CaveWendigo','Changeling','City','Crossroads','CultArena','CultVillage','EndChurch','Forest.Church1','Forest.Church2','HiddenVillage','Ossuary','StartHouse','StartVillage','Templars','TheivesHub','WitchArea2','WitchChurch','WitchHut'];

function inputPath(project,relative){
 requireValue(typeof relative==='string' && relative.length>0 && !relative.includes('\\') && !relative.includes(':') && !relative.startsWith('/') && !relative.split('/').some(p=>!p||p==='.'||p==='..'),'invalid private source path');
 return path.join(project,...relative.split('/'));
}
function verifyManifest(m){
 requireValue(m.schema===1 && m.level===expectedMap && Array.isArray(m.inputs),'bad reviewed inventory');
 const byPath=new Map(), roles=new Map();
 for(const row of m.inputs){
   inputPath('.',row.path);
   requireValue(!byPath.has(row.path) && hex(row.sha256) && Number.isSafeInteger(row.size) && row.size>=0 && Number.isFinite(row.mtimeMs) && row.role,'invalid or duplicated source '+row.path);
   byPath.set(row.path,row); roles.set(row.role,(roles.get(row.role)||0)+1);
 }
 requireValue(roles.get('landscape-proxy')===256 && roles.get('terrain-overlay')===4 && roles.get('waypoint-actor')===26 && roles.get('doll-station')===21,'incomplete source coverage');
 requireValue(m.reviewedDigest===digestOf(m.inputs.map(r=>[r.path,r.sha256])),'reviewed inventory digest does not match contents');
 return byPath;
}

// digest represents CURRENT content. Missing/unreadable files contribute an explicit missing
// sentinel; the caller must preserve the live edition whenever mismatches is nonempty.
export function checkMap(project,root){
 const m=manifestAt(root); verifyManifest(m);
 const mismatches=[], actual=[];
 for(const row of m.inputs){
   let value=null;
   try {
     const file=inputPath(project,row.path), stat=fs.statSync(file);
     if(!stat.isFile()) throw Error('not a file');
     if(stat.size===row.size && stat.mtimeMs===row.mtimeMs) value=row.sha256;
     else {
       value=hash(fs.readFileSync(file));
       const after=fs.statSync(file);
       if(after.size!==stat.size || after.mtimeMs!==stat.mtimeMs)throw Error('changed while checked');
     }
     if(value!==row.sha256)mismatches.push(row.path);
   } catch {value=null; mismatches.push(row.path);}
   actual.push([row.path,value]);
 }
 return {mismatches,digest:digestOf(actual)};
}

const finiteXYZ = p => Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
const eq = (a,b,tolerance=1e-7) => Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance;
function checkRegistration(point){
 requireValue(finiteXYZ(point.worldCm)&&Array.isArray(point.terrainUV)&&point.terrainUV.length===2,'invalid coordinates: '+point.name);
 for(let i=0;i<2;i++){
   const uv=(point.worldCm[i]+201600)/403200;
   requireValue(uv>=0&&uv<=1&&eq(uv,point.terrainUV[i],1e-9),'world-to-terrain registration mismatch: '+point.name);
 }
}
function attrs(tag){return Object.fromEntries([...tag.matchAll(/\s([\w-]+)="([^"]*)"/g)].map(x=>[x[1],x[2]]));}

// Validate private geometry/evidence against the reviewed inputs and against what is delivered
// to the player. No game project required for this step (also suitable for artifact packaging).
export function validateMap(root){
 const m=manifestAt(root), inventory=verifyManifest(m);
 const atlas=path.join(root,'content','atlas'), terrain=json(path.join(atlas,'terrain.json')), places=json(path.join(atlas,'places.json'));
 requireValue(places.map===expectedMap && terrain.projectMap===expectedMap,'unexpected world/level');
 requireValue(Object.keys(fixedBounds).every(k=>terrain.worldBoundsCm?.[k]===fixedBounds[k]) && terrain.orientation?.imageRight==='+X' && terrain.orientation?.imageDown==='+Y' && terrain.orientation?.sampleSpacingCm===100,'terrain bounds, axes or spacing changed');
 requireValue(terrain.sampleCountPerSide===4033 && terrain.landscapeComponents===1024 && terrain.landscapeProxyPackages===256 && terrain.sourcePackages?.length===256 && terrain.coverage===1 && terrain.sharedEdgeDiscrepancies?.maxRawHeightDelta===0,'incomplete or discontinuous source terrain');
 requireValue(same(places.coordinateSystem?.surfaceRegistration?.worldMin,[-201600,-201600]) && same(places.coordinateSystem?.surfaceRegistration?.worldMax,[201600,201600]),'landmark and terrain bounds disagree');
 requireValue(terrain.outputSha256===m.publicMap.sha256 && terrain.width===m.publicMap.width && terrain.height===m.publicMap.height && terrain.width===terrain.height && hex(terrain.sha256AssembledRowMajorUint16),'invalid or unreviewed terrain output');
 const webp=fs.readFileSync(path.join(root,'dist','assets','cartography','terrain-map.webp'));
 requireValue(webp.subarray(0,4).toString()==='RIFF'&&webp.subarray(8,12).toString()==='WEBP'&&hash(webp)===m.publicMap.sha256,'published WebP differs from reviewed terrain');
 const proxyBase='Content/__ExternalActors__/Maps/L_EclipsedRealms_OpenWorldMap/';
 const proxies=new Set();
 for(const p of terrain.sourcePackages){
   const f=proxyBase+p.file.replaceAll('\\','/'),r=inventory.get(f);
   requireValue(!proxies.has(f)&&r?.role==='landscape-proxy'&&r.sha256===p.sha256,'unreviewed terrain package: '+p.file);
   proxies.add(f);
 }
 const overlayInputs=m.inputs.filter(r=>r.role==='terrain-overlay');
 requireValue(terrain.overlays?.length===4 && overlayInputs.every(r=>terrain.overlays.some(o=>o.file.replaceAll('\\','/').endsWith('/'+r.path)&&o.sha256===r.sha256)),'unreviewed terrain overlays');
 const marks=places.surfaceWaypoints, excluded=places.specialOrExcluded, landmarks=places.openingAndOtherLandmarks;
 requireValue(Array.isArray(marks)&&marks.length===20&&same(marks.map(p=>p.id).sort(),[...surfaceIDs].sort())&&new Set(marks.map(p=>p.name)).size===20,'regional waypoint membership differs from the reviewed 20');
 requireValue(Array.isArray(excluded)&&excluded.length===6&&excluded.every(p=>!p.includeSurfaceMap)&&excluded.filter(p=>p.id.startsWith('Dev.')).length===5&&excluded.some(p=>p.id==='TrainingArena'),'special or development marker classification changed');
 for(const p of [...marks,...excluded]){
   checkRegistration(p);
   const e=inventory.get(p.poiPackage),reviewed=m.placements?.[p.id];
   requireValue(e?.role==='waypoint-actor'&&e.sha256===p.packageSHA256&&p.poiTag==='Narrative.POIs.Eclipsed.'+p.id,'missing POI input: '+p.name);
   requireValue(reviewed?.name===p.name && finiteXYZ(reviewed.worldCm) && p.worldCm.every((v,i)=>eq(v,reviewed.worldCm[i])),'unreviewed map name or position: '+p.name);
   if(!p.id.startsWith('Dev.')){const s=inventory.get(p.station?.package);requireValue(s?.role==='doll-station'&&s.sha256===p.station.packageSHA256,'missing Doll origin for '+p.name);}
   if(surfaceIDs.includes(p.id))requireValue(p.includeSurfaceMap&&p.kind==='regional Doll waypoint','regional marker was misclassified: '+p.name);
 }
 requireValue(Array.isArray(landmarks)&&landmarks.length===Object.keys(m.landmarks).length,'story landmark inventory changed');
 for(const p of landmarks){
   checkRegistration(p);
   requireValue(p.travel===false && finiteXYZ(m.landmarks[p.name]) && p.worldCm.every((v,i)=>eq(v,m.landmarks[p.name][i])),'unreviewed story anchor: '+p.name);
 }
 const html=fs.readFileSync(path.join(root,'dist','story.html'),'utf8');
 requireValue(html.includes('assets/cartography/terrain-map.webp'),'homepage does not render reviewed terrain');
 const renderedPins=[...html.matchAll(/<[^<>]*\sdata-pin="[^"]+"[^<>]*>/g)].map(x=>attrs(x[0]));
 const bySlug=new Map(marks.map(p=>[slug(p.name),p]));
 requireValue(new Set(renderedPins.map(a=>a['data-pin'])).size===20,'homepage does not contain the 20 regional waypoints');
 for(const a of renderedPins){
   const p=bySlug.get(a['data-pin']);
   requireValue(p && a['data-name']===p.name && eq(Number(a['data-x']),1000*p.terrainUV[0],.0001) && eq(Number(a['data-y']),1000*p.terrainUV[1],.0001),'rendered waypoint differs: '+a['data-pin']);
 }
 const camera=new Map([...html.matchAll(/<section\b[^<>]*\sdata-anchor="[^"]+"[^<>]*>/g)].map(x=>{const a=attrs(x[0]);return[a['data-anchor'],a];}));
 const expected={cage:landmarks.find(p=>p.name==='Opening cage — player start'),gallows:landmarks.find(p=>p.name==='Harrowwick gallows — platform'),thornhallow:bySlug.get('thornhallow'),cairnhold:bySlug.get('cairnhold'),veilcross:bySlug.get('veilcross')};
 for(const [id,p] of Object.entries(expected)){
   const a=camera.get(id);
   requireValue(a && p && eq(Number(a['data-cx']),1000*p.terrainUV[0],.0001) && eq(Number(a['data-cy']),1000*p.terrainUV[1],.0001),'rendered story location differs: '+id);
 }
 return {waypoints:marks.length,landmarks:landmarks.length,terrainPackages:proxies.size,digest:m.reviewedDigest};
}
