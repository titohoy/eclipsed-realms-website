// Full-screen orbit viewer for the registered, streamed open world.
import * as T from './assets/cartography/engine/three.module.min.js';
import {createScanLayer} from './assets/survey/scan-layer.js';
import {createSurface} from './assets/survey/terrain-surface.js';

export async function openExplorer(dialog){
 const view=dialog.querySelector('.survey-view'),frame=dialog.querySelector('.survey-canvas'),status=dialog.querySelector('.survey-caption');
 const dest=dialog.querySelector('.survey-select'),home=dialog.querySelector('[data-survey=fit]');
 let renderer;
 try{renderer=new T.WebGLRenderer({canvas:frame,antialias:true,alpha:false,powerPreference:'high-performance'});}
 catch{throw Error('This browser could not open the 3D view. The illustrated travel map is available.');}
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
 const scene=new T.Scene();scene.background=new T.Color(0xa6b8b9);scene.fog=new T.FogExp2(0xb8c2bc,.00029);
 const ambient=new T.HemisphereLight(0xdde9f0,0x9e896e,1.81);scene.add(ambient);
 const sun=new T.DirectionalLight(0xffe3ba,2.15);sun.position.set(-300,560,270);scene.add(sun);
 const camera=new T.PerspectiveCamera(46,1,.3,14500);
 const root=new URL('./assets/survey/',import.meta.url),target=new T.Vector3(0,0,0);
 let open=true,frameId=0,animated=0,ground,scan;
 let yaw=-.42,pitch=.79,radius=3900,lastName='';
 const limit=(n,l,h)=>Math.min(h,Math.max(l,n));
 function draw(){
  if(!open||document.hidden)return;
  const w=view.clientWidth,h=view.clientHeight;if(!w||!h)return;
  if(!frame.width||Math.abs(frame.width/renderer.getPixelRatio()-w)>1||Math.abs(frame.height/renderer.getPixelRatio()-h)>1)renderer.setSize(w,h,false);
  camera.aspect=w/h;camera.near=Math.max(.16,radius/1400);camera.updateProjectionMatrix();
  ground?.update(target,radius);
  const cs=Math.cos(pitch);
  camera.position.set(target.x+radius*cs*Math.sin(yaw), target.y+radius*Math.sin(pitch),target.z+radius*cs*Math.cos(yaw));
  if(ground){camera.position.y=Math.max(camera.position.y,ground.height(camera.position.x,camera.position.z)+1.8);}
  camera.lookAt(target);camera.updateMatrixWorld();scan?.update(camera,target);renderer.render(scene,camera);
 }
 function requestDraw(){if(!frameId&&open)frameId=requestAnimationFrame(()=>{frameId=0;draw();});}
 function setTarget(x,z,dist){target.set(x,(ground?.height(x,z)||0)+1.8,z);radius=dist;requestDraw();}
 function fit(){dest.value='';lastName='';yaw=-.42;pitch=.89;setTarget(0,0,Math.max(3200,3700/Math.min(1,view.clientWidth/view.clientHeight)));status.textContent='The open world';}
 function destination(){const opt=dest.selectedOptions[0];if(!opt?.value){fit();return;}lastName=opt.textContent;pitch=.52;setTarget((+opt.dataset.x/1000-.5)*4032,(+opt.dataset.y/1000-.5)*4032,100);status.textContent=lastName;}
 const pointers=new Map();let gesture=null;
 function state(){const a=[...pointers.values()];if(!a.length)return null;const b=a[1]||a[0];return {cx:(a[0].x+b.x)/2,cy:(a[0].y+b.y)/2,dist:Math.hypot(a[0].x-b.x,a[0].y-b.y),two:a.length>1,pan:a[0].pan};}
 function pan(dx,dy){const s=radius/Math.max(120,view.clientHeight);target.x=limit(target.x+(-dx*Math.cos(yaw)-dy*Math.sin(yaw))*s,-2016,2016);target.z=limit(target.z+(dx*Math.sin(yaw)-dy*Math.cos(yaw))*s,-2016,2016);target.y=(ground?.height(target.x,target.z)||0)+1.8;}
 const events=new AbortController(),opts={signal:events.signal};
 frame.addEventListener('pointerdown',e=>{if(e.button>2)return;frame.focus({preventScroll:true});frame.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,pan:e.shiftKey||e.button===2});gesture=state();},opts);
 frame.addEventListener('pointermove',e=>{const p=pointers.get(e.pointerId);if(!p)return;p.x=e.clientX;p.y=e.clientY;const now=state();if(gesture){const dx=now.cx-gesture.cx,dy=now.cy-gesture.cy;
  if(now.two&&gesture.two){if(now.dist>3&&gesture.dist>3)radius=limit(radius*gesture.dist/now.dist,6,7500);pan(dx,dy);}
  else if(now.pan)pan(dx,dy);else{yaw-=dx*.006;pitch=limit(pitch+dy*.005,.05,1.54);}}
  gesture=now;requestDraw();},opts);
 const release=e=>{pointers.delete(e.pointerId);gesture=state();};frame.addEventListener('pointerup',release,opts);frame.addEventListener('pointercancel',release,opts);
 frame.addEventListener('contextmenu',e=>e.preventDefault(),opts);
 function zoom(f){radius=limit(radius*f,6,7500);requestDraw();}
 frame.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(limit(e.deltaY,-160,160)*.0025));},{...opts,passive:false});
 frame.addEventListener('keydown',e=>{const ops={ArrowLeft:()=>{yaw-=.15},ArrowRight:()=>{yaw+=.15},ArrowUp:()=>{pitch=limit(pitch+.10,.05,1.54)},ArrowDown:()=>{pitch=limit(pitch-.10,.05,1.54)},w:()=>pan(0,40),s:()=>pan(0,-40),a:()=>pan(40,0),d:()=>pan(-40,0),'+':()=>zoom(.75),'=':()=>zoom(.75),'-':()=>zoom(1.33),Home:fit};if(ops[e.key]){e.preventDefault();ops[e.key]();requestDraw();}},opts);
 dialog.querySelector('[data-survey=in]').addEventListener('click',()=>zoom(.68),opts);dialog.querySelector('[data-survey=out]').addEventListener('click',()=>zoom(1.45),opts);home.addEventListener('click',fit,opts);dest.addEventListener('change',destination,opts);
 function close(){open=false;cancelAnimationFrame(frameId);cancelAnimationFrame(animated);events.abort();resize.disconnect();scan?.dispose();ground?.dispose();renderer.dispose();}
 const resize=new ResizeObserver(requestDraw);resize.observe(view);
 window.addEventListener('pagehide',close,{once:true});
 try{
   status.textContent='Opening the realm…';
   ground=await createSurface(T,scene,root);
   if(!open){ground.dispose();return;}
   scan=await createScanLayer(T,scene,{manifestURL:new URL('manifest.json',root).href,onChange:requestDraw});
   if(!open){scan.dispose();return;}
   scan.setQuality('high');const requested=new URL(location.href).searchParams.get('place')||'cairnhold';const preferred=[...dest.options].find(o=>o.value===requested);if(preferred){dest.value=preferred.value;destination();}else fit();
   // Service the streaming scheduler even after the visitor stops moving.
   let last=0;function pump(t){if(!open)return;if(t-last>160&&!document.hidden){draw();last=t;}animated=requestAnimationFrame(pump);}
   animated=requestAnimationFrame(pump);frame.focus({preventScroll:true});requestDraw();
 }catch(err){close();throw err;}
}
