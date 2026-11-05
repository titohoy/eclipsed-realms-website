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
 const sound=createSound(),reduced=matchMedia('(prefers-reduced-motion:reduce)'),noReplacements=[];
 let scan,surface,native,loaded=false,sceneryReady=false,playing=false,frame=0,w=0,h=0,seen=true,lastTime=0,lastShot=null,weapon=null,frameMs=0;
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
 function draw(now){
  frame=0;if(!seen||document.hidden)return;
  let elapsed=clock.elapsed+(playing?now-clock.started:0);
  if(playing&&elapsed>=23000){elapsed%=23000;clock.elapsed=elapsed;clock.started=now;}
  renderAt(manual?lastTime:reduced.matches?20:elapsed/1000);
  if(loaded&&!sceneryReady){
   const state=native?.stats();sceneryReady=manual||Boolean(native?.hasScene('arena')&&state.sets.some(s=>s.key==='arena'&&s.ready)&&state.visibleInstances>0&&state.loading===0&&!state.errors.length);
   if(sceneryReady){shell.dataset.filmState='ready';syncVisibility();}
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
  for(const [key,record]of Object.entries(shot.cast)){
   const person=persons[key];person.group.position.fromArray(record.world);person.group.rotation.y=record.yaw;person.group.visible=record.visible;
   if(key==='traveler'){person.pose('knife',.3,time);person.group.rotation.y+=.035*Math.sin(time*1.1);person.group.position.y+=.006*Math.sin(time*2.3);}
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
    else if(time<19)person.pose('kneel',0,time,{from:'listen',amount:ease((time-6.8)/.6)});
    else person.pose('listen',0,time,{from:'kneel',amount:ease((time-19)/.9)});
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
  createNativeLayer(T,world,{manifestURL:new URL('./assets/scenes/manifest.json',import.meta.url).href,getViewportHeight:()=>shell.clientHeight,onChange:request,preloadAll:true,textureBudgetMiB:manual?512:350})
 ]);
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
  dispose(){loaded=false;playing=false;observer.disconnect();resize.disconnect();cancelAnimationFrame(frame);native?.dispose();renderer.dispose();environment.dispose();}
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
