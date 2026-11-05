import fs from 'node:fs';
import path from 'node:path';
export function buildStaging(root){
 const rigs=JSON.parse(fs.readFileSync(path.join(root,'content/atlas/cinematic-rigs.json')));
 const copy={};
 for(const [key,r] of Object.entries(rigs)){
  const {anchor,fov,mobileFov,near,roles,yaw,poses,frames}=r;
  copy[key]={anchor,fov,mobileFov,near,roles,yaw,poses,frames:frames.map(({phase,eye,aim,castOffsets})=>({phase,eye,aim,castOffsets}))};
 }
 const code='export const cinematicRigs='+JSON.stringify(copy)+';\nexport function sampleCinematicRig(key,phase){const r=cinematicRigs[key];if(!r)return null;const p=Math.max(0,Math.min(1,Number(phase)||0)),v=p*(r.frames.length-1),i=Math.floor(v),a=r.frames[i],b=r.frames[Math.min(i+1,r.frames.length-1)],t=v-i,mix=(x,y)=>x.map((n,j)=>n+(y[j]-n)*t);return {anchor:[...r.anchor],eye:mix(a.eye,b.eye),aim:mix(a.aim,b.aim),fov:r.fov,mobileFov:r.mobileFov,near:r.near,cast:r.roles.map((role,j)=>({role,yaw:r.yaw[j],offset:mix(a.castOffsets[j],b.castOffsets[j]),poses:r.poses[j]}))};}\n';
 fs.writeFileSync(path.join(root,'dist/assets/scenes/camera-rigs.js'),code);
 const source=JSON.parse(fs.readFileSync(path.join(root,'content/atlas/trailer-rigs.json')));
 const shots=source.map(({id,time,desktop,mobile,frames})=>({id,time,desktop:{fov:desktop.fov,center:desktop.center},mobile:{fov:mobile.fov,center:mobile.center},frames:frames.map(({phase,time,cast,desktop,mobile})=>({phase,time,cast:Object.fromEntries(Object.entries(cast).map(([key,{world,yaw,visible}])=>[key,{world,yaw,visible}])),desktop:{eye:desktop.eye,aim:desktop.aim},mobile:{eye:mobile.eye,aim:mobile.aim}}))}));
 const sample=`export function sampleTrailerShot(time,mobile=false){const t=Math.max(0,Math.min(23,Number(time)||0)),shot=trailerShots.find(s=>t<s.time[1])||trailerShots.at(-1),p=Math.max(0,Math.min(1,(t-shot.time[0])/(shot.time[1]-shot.time[0]))),i=Math.max(0,shot.frames.findIndex((frame,n)=>n===shot.frames.length-1||t<shot.frames[n+1].time)),a=shot.frames[i],b=shot.frames[Math.min(i+1,shot.frames.length-1)],f=b.time>a.time?Math.max(0,Math.min(1,(t-a.time)/(b.time-a.time))):0,key=mobile?'mobile':'desktop',mix=(x,y)=>x.map((n,j)=>n+(y[j]-n)*f);return {id:shot.id,phase:p,time:t,eye:mix(a[key].eye,b[key].eye),aim:mix(a[key].aim,b[key].aim),fov:shot[key].fov,projectionCenter:[...shot[key].center],near:.06,cast:Object.fromEntries(Object.entries(a.cast).map(([role,c])=>[role,{world:mix(c.world,b.cast[role].world),yaw:c.yaw,visible:c.visible}]))};}\n`;
 fs.writeFileSync(path.join(root,'dist/assets/scenes/trailer-rigs.js'),'export const trailerShots='+JSON.stringify(shots)+';\n'+sample);
}
