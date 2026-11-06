import * as T from './assets/cartography/engine/three.module.min.js';
import {makePerson,loadProp} from './assets/people/cast.js';
import {createScanLayer} from './assets/survey/scan-layer.js';
import {createNativeLayer} from './assets/scenes/native-layer.js';
import {createSurface} from './assets/survey/terrain-surface.js';
import {sampleTrailerShot} from './assets/scenes/trailer-rigs.js';
import {RoomEnvironment} from './assets/people/engine/RoomEnvironment.js';
import {createSound} from './scene-sound.js';

const shell=document.querySelector('.cinematic-ad');
const filmVideo=shell?.querySelector('video.advert-video');
if(shell&&filmVideo)playFilmVideo(shell,filmVideo);
else if(shell&&!shell.hasAttribute('data-controlled-review'))createAdvertScene(shell).catch(()=>{
 shell.classList.add('is-finished');shell.dataset.filmState='unavailable';shell.style.setProperty('--film-fade','0');
 const sound=shell.querySelector('.ad-sound');if(sound)sound.hidden=true;
});
const clamp=v=>Math.max(0,Math.min(1,v)),ease=v=>{v=clamp(v);return v*v*(3-2*v);};
// Who the traveler watches, and when: the Nun, each cultist as they walk in, then the Demon Father once he rises.
const TRAVELER_LOOK=[[0,'nun'],[2.4,'left'],[5.2,'right'],[7.8,'nun'],[10.6,'left'],[12.4,'demon'],[17.4,'nun'],[19.6,'demon']];
const lookPoint=new T.Vector3();
// Desktop camera corrections from the frame review (2026-11-03): shot 2 had no shoulder in frame (only a stray knife tip),
// shot 5 was blocked by a pillar with the cast tiny in the distance. Each entry is [start,end] eye/aim, eased over the shot.
const CAMERA_FIXES={
 '02-over-shoulder-threats':{eye:[[899.35,57.24,-242.6],[899.05,57.22,-242.58]],aim:[[892,56.95,-241.85],[892,56.95,-241.85]],fov:34,center:[.5,.5]},
 '05-low-shoulder':{eye:[[895.8,56.95,-251.4],[895.5,56.9,-250.9]],aim:[[892.2,57.05,-242],[892.2,57.05,-242]],fov:46,center:[.56,.5]}
};
export async function createAdvertScene(shell,{manual=false,pixelRatio=null}={}){
 const canvas=shell.querySelector('canvas'),soundButton=shell.querySelector('.ad-sound'),bar=shell.querySelector('.ad-progress i');
 const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(pixelRatio??Math.min(devicePixelRatio||1,1.7));
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 const world=new T.Scene();world.background=new T.Color(0x070e16);world.fog=new T.FogExp2(0x101b25,.034);
 const camera=new T.PerspectiveCamera(46,1,.06,1200),target=new T.Vector3(),clock={elapsed:0,started:0};
 const moon=new T.DirectionalLight(0xa6c8ec,1.18);moon.position.set(882,71,-249);moon.target.position.set(893,56.4,-242);moon.castShadow=true;
 moon.shadow.mapSize.set(2048,2048);Object.assign(moon.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:1,far:65});moon.shadow.normalBias=.012;moon.shadow.bias=-.00004;moon.shadow.radius=2;world.add(moon,moon.target);
 world.add(new T.HemisphereLight(0x8daac5,0x181510,.34));
 const room=new RoomEnvironment(),pm=new T.PMREMGenerator(renderer),environment=pm.fromScene(room,.025);world.environment=environment.texture;world.environmentIntensity=.13;pm.dispose();room.dispose();
 const warm=new T.PointLight(0xffcf92,52,27,2);warm.position.set(895,58.3,-246);world.add(warm);
 const fill=new T.PointLight(0xc2d9f5,24,16,2);fill.position.set(894.5,59,-239.3);world.add(fill);
 const demonRim=new T.PointLight(0x9cbfe7,0,13,2);demonRim.position.set(886,59.2,-244);world.add(demonRim);
 const ember=new T.PointLight(0xff5a1f,0,11,2);ember.position.set(887.1,55.9,-241.6);world.add(ember);
 const persons={traveler:makePerson(T,'villager',1),nun:makePerson(T,'nun'),left:makePerson(T,'cultist-1',1),right:makePerson(T,'cultist-2',2),demon:makePerson(T,'demon',3)};
 for(const person of Object.values(persons))world.add(person.group);
 const summon=createSummonFx(T,world);
 // Body language for the traveler: he watches the room, tenses up as the ritual builds, recoils with the knife raised when the
 // Demon Father rises, then plants himself. Everything is a pure function of the film time so scrubbing stays deterministic.
 function lookYaw(person,role){
  const target=persons[role].group.position;person.group.updateMatrixWorld(true);
  lookPoint.set(target.x,target.y+(role==='demon'?2.6:1.55),target.z);person.group.worldToLocal(lookPoint);
  return Math.max(-1.15,Math.min(1.15,Math.atan2(lookPoint.x,lookPoint.z)));
 }
 function travelerBody(time,person){
  let i=TRAVELER_LOOK.length-1;while(i>0&&time<TRAVELER_LOOK[i][0])i--;
  const prev=TRAVELER_LOOK[Math.max(0,i-1)][1],cur=TRAVELER_LOOK[i][1],k=i?ease((time-TRAVELER_LOOK[i][0])/.6):1;
  const yaw=(1-k)*lookYaw(person,prev)+k*lookYaw(person,cur),breathe=Math.sin(time*1.7);
  const recoil=ease((time-12.45)/.28),settle=ease((time-13.2)/2.8),tension=ease((time-4)/8.4)*(1-recoil);
  const lean=.03*breathe+.03+.08*tension-.4*recoil*(1-settle)-.02*recoil+.09*ease((time-17)/3);
  const raise=.08+.08*Math.sin(time*.9)*(1-recoil)+.9*recoil*(1-.45*ease((time-17.5)/2.2));
  return {step:.24*ease((time-12.45)/.4)*(1-.55*ease((time-14)/3)),extra:{lean,twist:yaw*.3+.05*Math.sin(time*.5),sway:.03*Math.sin(time*.9+1),headYaw:yaw*.75,headPitch:.04*breathe+.22*ease((time-12.5)/.6)*(time<17.4?1:1-ease((time-17.4)/.8)),raise}};
 }
 const sound=createSound(),reduced=matchMedia('(prefers-reduced-motion:reduce)'),noReplacements=[];
 let scan,surface,native,loaded=false,layersDone=false,forceStart=false,sceneryReady=false,progressShown=0,playing=false,frame=0,w=0,h=0,seen=true,lastTime=0,lastShot=null,weapon=null,frameMs=0;
 function request(){if(!frame&&seen&&!document.hidden)frame=requestAnimationFrame(draw);}
 function syncVisibility(){
  const run=!manual&&loaded&&sceneryReady&&seen&&!document.hidden&&!reduced.matches;
  if(playing&&!run)clock.elapsed+=performance.now()-clock.started;
  if(!playing&&run)clock.started=performance.now();playing=run;sound.visible(seen&&!document.hidden);request();
 }
 reduced.addEventListener('change',syncVisibility);document.addEventListener('visibilitychange',syncVisibility);
 soundButton.addEventListener('click',async()=>{const on=await sound.toggle();soundButton.textContent=on?'Sound on':'Sound off';soundButton.setAttribute('aria-pressed',String(on));request();});
 const observer=new IntersectionObserver(rows=>{seen=rows[0].isIntersecting;syncVisibility();},{threshold:.05});observer.observe(shell);
 const resize=new ResizeObserver(request);resize.observe(shell);
 canvas.addEventListener('webglcontextlost',()=>{loaded=false;syncVisibility();shell.classList.add('is-finished');shell.dataset.filmState='unavailable';shell.style.setProperty('--film-fade','0');},{once:true});
 // Loading feedback: the poster stays up while the scenery streams in, with a live percentage so it never looks stuck.
 const loadingBar=shell.querySelector('.ad-loading-bar i'),loadingText=shell.querySelector('.ad-loading-text'),loadStart=performance.now();
 function sceneryFraction(){
  const state=native?.stats(),arena=state?.sets.find(k=>k.key==='arena');
  if(!arena)return 0;if(!arena.ready)return .08;return arena.requested?Math.min(1,arena.loaded/arena.requested):.15;
 }
 function updateProgress(){
  const cast=Object.values(persons).filter(p=>p.group.userData.castReady).length/5,scenery=sceneryFraction();
  const value=Math.min(.99,.04+.2*(layersDone?1:0)+.16*cast+.6*scenery);progressShown=Math.max(progressShown,value);
  if(loadingBar)loadingBar.style.transform='scaleX('+progressShown.toFixed(3)+')';
  if(loadingText)loadingText.textContent='Loading the film… '+Math.round(progressShown*100)+'%';
  // Safety net on a slow connection: after 14s start with what has streamed in (the rest keeps arriving) rather than wait forever.
  if(!forceStart&&loaded&&performance.now()-loadStart>14000&&scenery>=.6)forceStart=true;
 }
 const loadTimer=setInterval(()=>{if(sceneryReady){clearInterval(loadTimer);return;}updateProgress();request();},250);
 function draw(now){
  frame=0;if(!seen||document.hidden)return;
  let elapsed=clock.elapsed+(playing?now-clock.started:0);
  if(playing&&elapsed>=23000){elapsed%=23000;clock.elapsed=elapsed;clock.started=now;}
  renderAt(manual?lastTime:reduced.matches?20:elapsed/1000);
  if(loaded&&!sceneryReady){
   const state=native?.stats();sceneryReady=manual||Boolean(native?.hasScene('arena')&&state.sets.some(s=>s.key==='arena'&&s.ready)&&state.visibleInstances>0&&(state.loading===0||forceStart)&&!state.errors.length);
   if(sceneryReady){shell.dataset.filmState='ready';clearInterval(loadTimer);syncVisibility();}
  }
  if(playing)request();
 }
 function renderAt(seconds){
  const begin=performance.now(),time=Math.max(0,Math.min(23,Number(seconds)||0));lastTime=time;
  const width=shell.clientWidth,height=shell.clientHeight;if(!width||!height)return;
  if(width!==w||height!==h){w=width;h=height;renderer.setSize(w,h,false);}
  const shot=sampleTrailerShot(time,w<780);lastShot=shot;
  const fix=w<780?null:CAMERA_FIXES[shot.id];
  if(fix){const k=ease(shot.phase),lerp=(a,b)=>a.map((n,j)=>n+(b[j]-n)*k);shot.eye=lerp(...fix.eye);shot.aim=lerp(...fix.aim);shot.fov=fix.fov;shot.projectionCenter=[...fix.center];}
  // The traveler goes last: he looks at where everyone else stands this frame.
  for(const [key,record]of Object.entries(shot.cast).sort(([a],[b])=>(a==='traveler')-(b==='traveler'))){
   const person=persons[key];person.group.position.fromArray(record.world);person.group.rotation.y=record.yaw;person.group.visible=record.visible;
   if(key==='traveler'){
    const body=travelerBody(time,person);person.group.rotation.y+=.035*Math.sin(time*1.1);person.group.position.y+=.006*Math.sin(time*2.3);
    // The recoil step: a short slide back along his own facing when the demon rises.
    const yaw=person.group.rotation.y;person.group.position.x-=Math.sin(yaw)*body.step;person.group.position.z-=Math.cos(yaw)*body.step;
    person.pose('knife',.3,time,null,body.extra);}
   else if(key==='nun')person.pose('pray',.3,time);
   else if(key==='left'||key==='right'){
    // Ritual staging: one real-speed walk cycle (3.3 m over the clip's 2.73 s, so feet don't slide), stop, turn to the
    // summoning ground behind the Nun, kneel through the summoning, rise when the demon stands.
    const endX=key==='left'?892.6:892.8,startX=endX-3.3,walk=clamp((time-3)/2.73),turnDir=key==='left'?1:-1;
    person.group.position.x=startX+3.3*walk;
    const turn=ease((time-6.0)/.8);person.group.rotation.y=record.yaw+turnDir*Math.PI*turn;
    if(time<3)person.pose('listen',0,time);
    else if(time<5.73)person.pose('walk',Math.min(.99999,walk),time,{from:'listen',amount:ease((time-3)/.4)});
    else if(time<6.8)person.pose('listen',0,time,{from:'walk',phase:.99999,amount:ease((time-5.73)/.4)});
    else if(time<12.3)person.pose('kneel',0,time,{from:'listen',amount:ease((time-6.8)/.6)});
    // The Demon Father is summoned: the cult bows to the floor and stays bowed until the loop ends.
    else person.pose('bow',ease((time-12.3)/1.3),time);
   }else{
    // Summoning: the demon rises out of the arena floor under an ember glow while roaring, then intimidates.
    const rise=ease((time-12.5)/1.9),ground=record.world[1];person.group.visible=time>=12.5;person.group.position.x=887.1;
    person.group.position.y=ground-3.9*(1-rise);
    if(time<12.5)person.pose('idle',0,time);
    else if(time<16)person.pose('roar',clamp((time-12.5)/3.5),time);
    else if(time<18)person.pose('idle',0,time,{from:'roar',phase:.99999,amount:ease((time-16)/.6)});
    else person.pose('intimidation',clamp((time-18)/4.6666665),time,{from:'idle',amount:ease((time-18)/.3)});
   }
  }
  camera.position.fromArray(shot.eye);target.fromArray(shot.aim);camera.aspect=w/h;camera.fov=shot.fov;camera.near=shot.near;camera.updateProjectionMatrix();
  camera.setViewOffset(w,h,w*(.5-shot.projectionCenter[0]),h*(.5-shot.projectionCenter[1]),w,h);camera.lookAt(target);camera.updateMatrixWorld();
  warm.intensity=52+.7*Math.sin(time*5);demonRim.intensity=3+75*ease((time-12.2)/2.5);
  ember.intensity=time<12.3?0:140*ease((time-12.3)/.5)*(1-.75*ease((time-14.6)/2))*(1+.12*Math.sin(time*23));
  {const d=shot.cast.demon.world;summon.update(time,d[1],887.1,d[2]);}
  if(time>12.6&&time<14.6){const a=.012*(1-Math.abs(time-13.6));camera.position.x+=a*Math.sin(time*61);camera.position.y+=a*Math.sin(time*47);camera.updateMatrixWorld();}
  surface?.update(target,14);native?.update(camera,target,'arena',14);scan?.setReplacements(native?.replacements()||noReplacements);scan?.update(camera,target);
  renderer.render(world,camera);
  shell.style.setProperty('--film-fade',String(reduced.matches&&!manual?0:Math.max(1-ease(time/.75),ease((time-22.1)/.9))));
  bar.style.transform='scaleX('+time/23+')';shell.classList.toggle('in-scene',(manual||playing)&&time>2.8&&time<20.2);
  if(playing)sound.scene('veilcross',time>12.5?1:0,false);
  frameMs=performance.now()-begin;
 }
 shell.dataset.filmState='loading';
 const base=new URL('./assets/survey/',import.meta.url);
 [surface,scan,native]=await Promise.all([
  createSurface(T,world,base),
  createScanLayer(T,world,{manifestURL:new URL('manifest.json',base).href,quality:'high',getViewportHeight:()=>shell.clientHeight,onChange:request}),
  createNativeLayer(T,world,{manifestURL:new URL('./assets/scenes/manifest.json',import.meta.url).href,getViewportHeight:()=>shell.clientHeight,onChange:request,preloadAll:true,concurrency:manual?2:6,textureBudgetMiB:manual?512:350})
 ]);
 layersDone=true;updateProgress();
 await Promise.all(Object.values(persons).map(p=>p.ready));
 if(Object.values(persons).some(p=>!p.group.userData.castReady))throw Error('The film cast is unavailable');
 const knife=await loadProp('knife');let hand;
 persons.traveler.group.traverse(o=>{if(o.isBone&&/^hand_r$/i.test(o.name.replace(/^.*[:|]/,'')))hand=o;});
 if(!knife||!hand)throw Error('The film prop is unavailable');
 const box=new T.Box3().setFromObject(knife),size=box.getSize(new T.Vector3()),scale=.32/Math.max(size.x,size.y,size.z),parentScale=hand.getWorldScale(new T.Vector3());
 const grip=new T.Group();hand.add(grip);grip.position.set(-.065,0,.015);grip.scale.set(1/Math.abs(parentScale.x),1/Math.abs(parentScale.y),1/Math.abs(parentScale.z));
 knife.scale.setScalar(scale);knife.rotation.set(Math.PI/2,0,0);knife.position.copy(new T.Vector3(-.024,.010,.045).multiplyScalar(-scale).applyEuler(knife.rotation));grip.add(knife);weapon=grip;
 loaded=true;syncVisibility();request();
 return {
  renderAt,canvas,
  inspect:()=>{
   world.updateMatrixWorld(true);
   return {time:lastTime,shot:lastShot?.id,ready:loaded,sceneryReady,frameMs,framebuffer:[canvas.width,canvas.height],camera:{eye:camera.position.toArray(),target:target.toArray()},weapon:weapon?{position:weapon.getWorldPosition(new T.Vector3()).toArray(),bounds:(()=>{const b=new T.Box3().setFromObject(weapon,true);return [...b.min.toArray(),...b.max.toArray()]})()}:null,
    cast:Object.fromEntries(Object.entries(persons).map(([key,p])=>{const b=new T.Box3().setFromObject(p.group,true);return [key,{ready:p.group.userData.castReady,visible:p.group.visible,position:p.group.position.toArray(),bounds:[...b.min.toArray(),...b.max.toArray()],pose:p.inspect?.()}]})),native:native?.stats(),survey:scan?.stats()};
  },
  dispose(){clearInterval(loadTimer);loaded=false;playing=false;observer.disconnect();resize.disconnect();cancelAnimationFrame(frame);native?.dispose();renderer.dispose();environment.dispose();}
 };
}

// Summoning effects for the Demon Father: a rune circle that wakes with the chant, a crack of light, a rising pillar, a shockwave
// ring, a burst of sparks and rising embers. Pure functions of the film time (no simulation state), so scrubbing is exact.
function createSummonFx(T,world){
 const group=new T.Group();group.visible=false;world.add(group);
 const hash=(i,n)=>{const v=Math.sin(i*127.1+n*311.7)*43758.5453;return v-Math.floor(v);};
 const canvas=(size,draw)=>{const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;};
 const soft=canvas(64,(g,n)=>{const r=g.createRadialGradient(n/2,n/2,0,n/2,n/2,n/2);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.3,'rgba(255,255,255,.6)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,n,n);});
 const runes=canvas(1024,(g,n)=>{
  g.translate(n/2,n/2);g.scale(n/512,n/512);g.lineCap='round';g.strokeStyle='#ffb070';g.shadowColor='#ff5a1f';g.shadowBlur=14;
  const ring=(r,w)=>{g.lineWidth=w;g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.stroke();};
  ring(248,4);ring(236,1.5);ring(178,2);ring(160,4);
  for(let i=0;i<54;i++){const a=i/54*Math.PI*2,r0=186+hash(i,1)*10,r1=r0+14+hash(i,2)*26;g.lineWidth=2+hash(i,3)*2;g.beginPath();g.moveTo(Math.cos(a)*r0,Math.sin(a)*r0);g.lineTo(Math.cos(a+.018)*r1,Math.sin(a+.018)*r1);if(hash(i,4)>.55)g.lineTo(Math.cos(a-.012)*(r1-9),Math.sin(a-.012)*(r1-9));g.stroke();}
  g.lineWidth=2.5;g.beginPath();for(let i=0;i<=9;i++){const a=i*4/9*Math.PI*2-Math.PI/2;g[i?'lineTo':'moveTo'](Math.cos(a)*158,Math.sin(a)*158);}g.stroke();
  g.lineWidth=2;g.beginPath();for(let i=0;i<=3;i++){const a=i/3*Math.PI*2+Math.PI/2;g[i?'lineTo':'moveTo'](Math.cos(a)*88,Math.sin(a)*88);}g.stroke();ring(40,3);ring(22,2);
 });
 const cracks=canvas(1024,(g,n)=>{
  g.translate(n/2,n/2);g.scale(n/512,n/512);g.lineCap='round';g.lineJoin='round';
  for(let k=0;k<16;k++){let a=k/16*Math.PI*2+hash(k,5)*.3,x=0,y=0;const pts=[[0,0]];for(let j=0;j<9;j++){a+=(hash(k*9+j,6)-.5)*.7;const l=22+hash(k*9+j,7)*20;x+=Math.cos(a)*l;y+=Math.sin(a)*l;pts.push([x,y]);if(Math.hypot(x,y)>240)break;}
   for(const [w,col,blur] of [[7,'rgba(255,90,20,.45)',18],[2.4,'#ffd9a0',8]]){g.strokeStyle=col;g.shadowColor='#ff4a10';g.shadowBlur=blur;g.lineWidth=w*(1-.0*k);g.beginPath();pts.forEach(([px,py],j)=>g[j?'lineTo':'moveTo'](px,py));g.stroke();}}
 });
 const beamTex=canvas(64,(g,n)=>{const v=g.createLinearGradient(0,0,0,n);v.addColorStop(0,'rgba(255,170,90,0)');v.addColorStop(.3,'rgba(255,140,60,.45)');v.addColorStop(1,'rgba(255,90,30,.95)');g.fillStyle=v;g.fillRect(0,0,n,n);});
 const glow={transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false};
 const circle=new T.Mesh(new T.PlaneGeometry(8.4,8.4),new T.MeshBasicMaterial({map:runes,...glow,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));circle.rotation.x=-Math.PI/2;circle.renderOrder=4;
 const crack=new T.Mesh(new T.PlaneGeometry(9.5,9.5),new T.MeshBasicMaterial({map:cracks,...glow,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}));crack.rotation.x=-Math.PI/2;crack.renderOrder=5;
 const wave=new T.Mesh(new T.RingGeometry(.86,1,96),new T.MeshBasicMaterial({color:0xff8a3a,side:T.DoubleSide,...glow}));wave.rotation.x=-Math.PI/2;wave.renderOrder=6;
 const beam=new T.Mesh(new T.CylinderGeometry(.85,1.5,11,36,1,true),new T.MeshBasicMaterial({map:beamTex,side:T.DoubleSide,...glow}));beam.position.y=5.4;beam.renderOrder=3;
 group.add(circle,crack,wave,beam);
 const make=(count,size)=>{const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(new Float32Array(count*3),3));geo.setAttribute('color',new T.BufferAttribute(new Float32Array(count*3),3));
  const points=new T.Points(geo,new T.PointsMaterial({map:soft,size,vertexColors:true,sizeAttenuation:true,...glow}));points.frustumCulled=false;points.renderOrder=7;group.add(points);return points;};
 const EMBERS=520,SPARKS=170,embers=make(EMBERS,.17),sparks=make(SPARKS,.1);
 const ez=Math.sqrt;
 function fillEmbers(time){
  const pos=embers.geometry.attributes.position.array,col=embers.geometry.attributes.color.array;
  for(let i=0;i<EMBERS;i++){
   const motes=i%6===0,birth=motes?9.8+hash(i,1)*5:12.15+7.5*Math.pow(hash(i,1),2.2),life=2.4+hash(i,2)*2.6,age=time-birth,u=age/life,live=age>0&&u<1;
   const r0=.15+hash(i,3)*(motes?3.4:2.1),a=hash(i,4)*Math.PI*2+age*(.5+hash(i,5)*.9);
   const rise=(motes?.55:1.1+2*hash(i,6))*age;
   pos[i*3]=Math.cos(a)*r0*(1-.25*Math.max(0,u));pos[i*3+1]=live?.05+rise*(1-.3*u):-50;pos[i*3+2]=Math.sin(a)*r0*(1-.25*Math.max(0,u));
   const f=live?Math.pow(Math.sin(Math.PI*u),.7)*(motes?.5:1)*(.7+.3*Math.sin(time*18+i)):0;
   col[i*3]=1.6*f;col[i*3+1]=(.5*(1-u)+.12)*1.5*f;col[i*3+2]=.1*(1-u)*f;
  }
  embers.geometry.attributes.position.needsUpdate=embers.geometry.attributes.color.needsUpdate=true;
 }
 function fillSparks(time){
  const pos=sparks.geometry.attributes.position.array,col=sparks.geometry.attributes.color.array,age0=time-12.45;
  for(let i=0;i<SPARKS;i++){
   const t=age0-hash(i,1)*.16,life=.9+hash(i,2)*.9,u=t/life,live=t>0&&u<1,a=hash(i,3)*Math.PI*2,speed=2.2+hash(i,4)*4.6,up=3.2+hash(i,5)*5;
   pos[i*3]=live?Math.cos(a)*speed*t:0;pos[i*3+1]=live?.1+up*t-4.2*t*t:-50;pos[i*3+2]=live?Math.sin(a)*speed*t:0;
   const f=live?1-u*u:0;col[i*3]=2.2*f;col[i*3+1]=1.35*f;col[i*3+2]=.5*f;
  }
  sparks.geometry.attributes.position.needsUpdate=sparks.geometry.attributes.color.needsUpdate=true;
 }
 return {
  group,
  update(time,ground,x,z){
   const active=time>9.6&&time<23.01;group.visible=active;if(!active)return;
   group.position.set(x,ground+.06,z);
   const wake=ease((time-9.8)/2.6),burst=ease((time-12.3)/.35),fade=1-ease((time-19.6)/2.6);
   const pulse=1+.12*Math.sin(time*5.2);
   circle.rotation.z=time*.18;circle.material.opacity=(.3*wake+.7*burst)*pulse*(.75+.25*fade)*Math.min(1,fade+.35);
   const crackIn=ease((time-12.4)/.25)*(1-ease((time-14.2)/2.4));crack.material.opacity=.95*crackIn*(.85+.15*Math.sin(time*31));crack.rotation.z=.4;
   const p=clamp((time-12.4)/1.5),out=1-(1-p)*(1-p);wave.visible=p>0&&p<1;wave.scale.setScalar(.8+9*out);wave.material.opacity=Math.pow(1-p,1.6)*.9;
   const column=ease((time-12.25)/.3)*(1-ease((time-13.6)/2.2));beam.visible=column>.002;beam.material.opacity=.12*column*(.9+.1*Math.sin(time*27));
   beam.scale.set(1+.25*Math.sin(time*9),1,1+.25*Math.cos(time*8));
   fillEmbers(time);fillSparks(time);
  }
 };
}


// Unreal-rendered film: muted autoplay + loop + inline playback (allowed by every major browser), poster as fallback.
function playFilmVideo(shell,video){
 const sound=shell.querySelector('.ad-sound'),bar=shell.querySelector('.ad-progress i');
 video.muted=true;video.defaultMuted=true;video.loop=true;video.playsInline=true;video.setAttribute('muted','');
 shell.dataset.filmState='loading';
 const start=()=>{const p=video.play();if(p&&p.catch)p.catch(()=>{});};
 video.addEventListener('playing',()=>{shell.dataset.filmState='ready';});
 video.addEventListener('error',()=>{shell.dataset.filmState='unavailable';shell.classList.add('is-finished');if(sound)sound.hidden=true;},true);
 video.addEventListener('timeupdate',()=>{const t=video.currentTime,d=video.duration||23;if(bar)bar.style.transform='scaleX('+t/d+')';shell.classList.toggle('in-scene',t>2.8&&t<d-2.8);});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)start();});
 new IntersectionObserver(e=>{if(e[0]?.isIntersecting)start();}).observe(shell);
 if(sound)sound.addEventListener('click',()=>{video.muted=!video.muted;sound.setAttribute('aria-pressed',String(!video.muted));sound.textContent=video.muted?'Sound off':'Sound on';if(!video.muted)start();});
 start();
}
