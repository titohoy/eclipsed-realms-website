// The route is a flat survey in world space. The camera, terrain, cast and light are 3D.
import * as T from './assets/cartography/engine/three.module.min.js';
import {makePerson as makeActor,loadProp} from './assets/people/cast.js';
import {createScanLayer} from './assets/survey/scan-layer.js';
import {createNativeLayer} from './assets/scenes/native-layer.js';
import {createFlames} from './assets/scenes/flames.js';
import {createSurface} from './assets/survey/terrain-surface.js';
import {cinematicRigs,sampleCinematicRig} from './assets/scenes/camera-rigs.js';
import {RoomEnvironment} from './assets/people/engine/RoomEnvironment.js';
const makeSet=()=>({group:new T.Group(),animate(){}});
function held(actor,role,side='l'){const mount=new T.Group();actor.group.add(mount);Promise.all([actor.ready,loadProp(role)]).then(([,model])=>{if(!model)return;let hand;actor.group.traverse(o=>{if(o.isBone&&o.name.toLowerCase().replace(/^.*[:|]/,'')==='hand_'+side)hand=o;});if(!hand)return;const s=hand.getWorldScale(new T.Vector3());mount.parent.remove(mount);hand.add(mount);mount.scale.set(1/Math.abs(s.x),1/Math.abs(s.y),1/Math.abs(s.z));model.rotation.y=Math.PI;mount.add(model);window.dispatchEvent(new Event('castready'));});return mount;}

const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x)), lerp=(a,b,t)=>a+(b-a)*t;
const ease=x=>{x=clamp(x);return x*x*(3-2*x);}, range=(x,a,b)=>ease((x-a)/(b-a));
const toM=n=>(n/1000-.5)*4032;
function stagePose(poses,p){
 if(p<.13)return {act:poses[0]};
 if(p<.25)return {act:poses[1],blend:{from:poses[0],amount:range(p,.13,.25)}};
 if(p<.67)return {act:poses[1]};
 if(p<.79)return {act:poses[2],blend:{from:poses[1],amount:range(p,.67,.79)}};
 return {act:poses[2]};
}
const choreography={
 cage: [['traveler',-1.57,-1.57,.56, -.46,1.18,'kneel','walk','listen'],['doll',.88,.14,-.3,.84,.18,'idle','point','idle']],
 gallows:[['traveler',-2.15,3.3,3.03,-1.23,1.24,'walk','walk','listen'],['guard',1.70,-.72,.12,1.78,-.69,'guard','point','guard'],['villager',-1.15,-1.7,.2,-1.15,-1.7,'listen','kneel','listen'],['villager',-.34,-1.68,-.2,-.35,-1.69,'listen','listen','listen'],['villager',1.42,1.46,3.1,1.63,1.12,'walk','listen','listen'],['companion',.03,2.05,2.7,.45,1.6,'listen','walk','listen']],
 thornhallow:[['villager',-.23,.61,.2,-.37,.58,'kneel','kneel','listen'],['traveler',-2.12,2.8,2.45,-1.24,.95,'walk','walk','kneel'],['guard',1.54,-1,-.65,1.06,-.35,'guard','walk','point'],['companion',-1.82,-1.12,.8,-1.82,-1.12,'listen','point','listen']],
 veilcross:[['traveler',-1.3,.68,1.71,-.9,.65,'guard','block','guard'],['fighter',2.13,.15,-1.19,1.06,.17,'walk','strike','guard']],
 cairnhold:[['traveler',-2.55,2.85,2.7,-.59,-.12,'walk','walk','listen'],['guard',1.66,-1.55,-.36,1.66,-1.54,'guard','point','guard'],['villager',2.37,.63,-1.6,.47,.38,'walk','walk','idle'],['companion',-2.24,2.05,2.54,-1.45,.58,'walk','walk','listen']]
};
// [start azimuth, end azimuth; distance, height, aim height]. A new composition for every chapter.
const lens={cage:[-.28,.31,5.8,1.92,.96],gallows:[.46,-.31,8.4,3.2,1.15],thornhallow:[-.49,.22,7.15,2.48,1.04],veilcross:[.33,-.35,6.3,1.95,1.04],cairnhold:[-.43,.28,8.85,2.55,1.65]};
const colors={cage:[0x0a151c,0x1c2022,0xe9ad65],gallows:[0x738083,0xb1a489,0xffdfac],thornhallow:[0x506d68,0xb0b49a,0xffe3a5],veilcross:[0x465b64,0x9aada2,0xf1d7a0],cairnhold:[0x56687c,0xd3ac86,0xffcc88],overview:[0x455b62,0xadaf8d,0xffe4af]};
export async function createFlight(viewport,chapters){
 const canvas=document.createElement('canvas');canvas.className='flight-surface';canvas.setAttribute('aria-hidden','true');
 const gl=canvas.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'high-performance'});if(!gl)throw Error('No 3D context');
 const renderer=new T.WebGLRenderer({canvas,context:gl,alpha:false,antialias:true});
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
 let stopped=false;
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();stopped=true;viewport.classList.remove('in-flight');canvas.remove();window.dispatchEvent(new Event('flightfallback'))},{once:true});
 const texUrl='assets/cartography/';
 const bytes=async url=>{const r=await fetch(texUrl+url);if(!r.ok)throw Error('Missing landscape');return r.arrayBuffer()};
 // Rendered-map mode: when the build found assets/map/realm-map.json, the Unreal top-down render is the ground (draped on the measured relief) instead of the survey and terrain meshes.
 let rendered=null;if(viewport.hasAttribute('data-rendered-map')){try{const r=await fetch('assets/map/realm-map.json');if(r.ok){const j=await r.json();if(j?.bounds&&(j.flightImage||j.preview||j.image))rendered=j;}}catch{}}
 const [raw,map]=await Promise.all([bytes('relief.bin'),new T.TextureLoader().loadAsync(rendered?String(rendered.flightImage||rendered.preview||rendered.image):'assets/survey/soil.webp')]);
 const grid=new Uint16Array(raw),N=505; if(grid.length!==N*N)throw Error('Incomplete landscape');
 let sample=(x,z)=>{const a=clamp(x/4032+.5)*(N-1),b=clamp(z/4032+.5)*(N-1),i=Math.floor(a),j=Math.floor(b),u=a-i,v=b-j;
  return (lerp(lerp(grid[j*N+i],grid[j*N+Math.min(i+1,N-1)],u),lerp(grid[Math.min(j+1,N-1)*N+i],grid[Math.min(j+1,N-1)*N+Math.min(i+1,N-1)],u),v)-32768)*.0078125};
 map.colorSpace=T.SRGBColorSpace;map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(43,1,.06,19500);
 const fog=scene.fog=new T.FogExp2(0xadb19a,.00019);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
 let survey=null,native=null,flames=null,surveyQuality='';
 createFlames(T,scene).then(f=>{flames=f;window.dispatchEvent(new Event('castready'))}).catch(()=>{});const noReplacements=[];const sampleBase=new URL('./assets/survey/',import.meta.url);
 (rendered?Promise.reject():createScanLayer(T,scene,{manifestURL:new URL('manifest.json',sampleBase).href,onChange:()=>window.dispatchEvent(new Event('castready'))}).then(s=>{survey=s;s.setQuality('balanced')})).catch(()=>{});
 createNativeLayer(T,scene,{manifestURL:new URL('./assets/scenes/manifest.json',import.meta.url).href,onChange:()=>window.dispatchEvent(new Event('castready')),getViewportHeight:()=>viewport.clientHeight}).then(layer=>{native=layer;window.dispatchEvent(new Event('castready'))}).catch(()=>{});
 const studio=new RoomEnvironment(),reflections=new T.PMREMGenerator(renderer);
 const reflected=reflections.fromScene(studio,.023);scene.environment=reflected.texture;scene.environmentIntensity=.20;
 studio.dispose();reflections.dispose();
 const sun=new T.DirectionalLight(0xffe3aa,2.05);sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);Object.assign(sun.shadow.camera,{near:1,far:100,left:-11,right:11,top:11,bottom:-11});sun.shadow.normalBias=.025;sun.shadow.bias=-.0005;scene.add(sun,sun.target);
 const skyLight=new T.HemisphereLight(0xe2eee9,0x7a6855,1.45);scene.add(skyLight);
 const rb=rendered?.bounds,geometry=rb?new T.PlaneGeometry((rb.maxX-rb.minX)/100,(rb.maxY-rb.minY)/100,252,252):new T.PlaneGeometry(4032,4032,252,252);geometry.rotateX(-Math.PI/2);if(rb)geometry.translate((rb.minX+rb.maxX)/200,0,(rb.minY+rb.maxY)/200);
 const pos=geometry.attributes.position;for(let j=0;j<pos.count;j++)pos.setY(j,sample(pos.getX(j),pos.getZ(j)));geometry.computeVertexNormals();
 const earth=new T.Mesh(geometry,new T.MeshStandardMaterial({map,roughness:1,metalness:0}));earth.receiveShadow=true;scene.add(earth);let fullSurface=null;
 if(!rendered)try{fullSurface=await createSurface(T,scene,sampleBase);sample=fullSurface.height;earth.visible=false;}catch{}
 const skyU={top:{value:new T.Color()},low:{value:new T.Color()},warm:{value:new T.Color()}};
 const sky=new T.Mesh(new T.SphereGeometry(11500,24,12),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:skyU,
 vertexShader:'varying vec3 ray;void main(){ray=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:'varying vec3 ray;uniform vec3 top,low,warm;void main(){vec3 d=normalize(ray);float h=clamp(d.y,0.,1.);vec3 col=mix(low,top,pow(h,.46));float s=max(0.,dot(d,normalize(vec3(-.59,.22,-.8))));col+=warm*(.17*pow(s,14.)+.55*pow(s,400.)+.65*smoothstep(.9992,.9997,s));float haze=sin(d.x*21.+d.z*16.+h*45.)*sin(h*79.+d.x*14.);col+=vec3(.013)*haze*(1.-smoothstep(.04,.48,h));gl_FragColor=vec4(col,1.);\n#include <colorspace_fragment>\n}'}));sky.renderOrder=-2;sky.frustumCulled=false;scene.add(sky);

 const atlas=chapters.map(el=>{const x=toM(+el.dataset.cx),z=toM(+el.dataset.cy);let y=el.dataset.anchor==='cage'?-32.55:(+el.dataset.cz||sample(x,z));if(!['overview','cage'].includes(el.dataset.anchor)){for(const dx of [-4,0,4])for(const dz of [-3,0,3])y=Math.max(y,sample(x+dx,z+dz));}const rig=cinematicRigs[el.dataset.anchor];return {key:el.dataset.anchor,x:rig?.anchor[0]??x,y:rig?.anchor[1]??(y+.07),z:rig?.anchor[2]??z,rig:Boolean(rig),floorReady:Boolean(rig)}});
 const lamp=new T.PointLight(0xffb151,0,11,2),rim=new T.DirectionalLight(0xc0e1ff,1.2);scene.add(lamp,rim,rim.target);
 const pinRows=Array.from(viewport.querySelectorAll('[data-pin]'),g=>({g,x:toM(+g.dataset.x),z:toM(+g.dataset.y),label:g.querySelector('text'),major:g.hasAttribute('data-major')})).sort((a,b)=>b.major-a.major);
 for(const p of pinRows)p.y=sample(p.x,p.z)+5;
 const pointer={x:0,y:0,dx:0,dy:0};const hover=matchMedia('(hover:hover) and (pointer:fine)');
 viewport.parentElement.addEventListener('pointermove',e=>{if(!hover.matches||e.pointerType==='touch')return;const r=viewport.getBoundingClientRect();pointer.x=clamp((e.clientX-r.left)/r.width*2-1,-1,1);pointer.y=clamp((e.clientY-r.top)/r.height*2-1,-1,1)},{passive:true});
 viewport.parentElement.addEventListener('pointerleave',()=>{pointer.x=pointer.y=0});
 const built=new Map(),tmp=new T.Vector3(),aim=new T.Vector3(),eye=new T.Vector3();
 const environment=(a)=>{if(built.has(a.key))return built.get(a.key);const set=makeSet(T,a.key);const group=set.group;group.position.set(a.x,a.y,a.z);scene.add(group);const plans=sampleCinematicRig(a.key,0)?.cast.map(c=>[c.role])||choreography[a.key];const cast=plans.map(([role,...plan],i)=>{const actor=makeActor(T,role,i);group.add(actor.group);return {...actor,role,plan};});
 let caster=null;if(a.key==='veilcross'){caster=makeActor(T,'mage',34);group.add(caster.group);}
 group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 let fx=null;if(a.key==='veilcross'){
  const layer=new T.Group();group.add(layer);const beamMat=new T.MeshBasicMaterial({color:0xffdd8b,transparent:true,opacity:.8,depthWrite:false,blending:T.AdditiveBlending});
  const curve=new T.CatmullRomCurve3([new T.Vector3(-.81,1.16,.66),new T.Vector3(-.28,1.4,.53),new T.Vector3(.36,1.18,.48),new T.Vector3(1.02,.91,.20)]);
  const strand=new T.Mesh(new T.TubeGeometry(curve,26,.026,5,false),beamMat);strand.frustumCulled=false;layer.add(strand);
  const curls=[];for(let q=0;q<3;q++){const loop=new T.Mesh(new T.TorusGeometry(.44,.016,5,40),beamMat);loop.rotation.x=1.33;layer.add(loop);curls.push(loop);}
  const shield=held(cast[0],'shield'),relief=new T.Group();relief.position.set(-1.02,.025,.67);relief.scale.setScalar(1.5);group.add(relief);loadProp('holy-relief').then(model=>{if(model){relief.add(model);window.dispatchEvent(new Event('castready'));}});
  fx={layer,shield,relief,curls,strand,beamMat};}
 const item={set,group,cast,caster,fx};built.set(a.key,item);return item;};
 let w=0,h=0,previousTime=0,elapsed=0,nextFloor=0;const floorRay=new T.Raycaster();
 const motif=new T.Group();scene.add(motif);const dustGeometry=new T.BufferGeometry(),dustPos=new Float32Array(64*3);
 for(let i=0;i<64;i++){dustPos[3*i]=(Math.sin(i*711.7)*.5+.5)*15-7.5;dustPos[3*i+1]=.32+(Math.cos(i*47.73)*.5+.5)*3.5;dustPos[3*i+2]=Math.sin(i*131.77)*6;}
 dustGeometry.setAttribute('position',new T.BufferAttribute(dustPos,3));
 const sparks=new T.Points(dustGeometry,new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{now:{value:0},tint:{value:new T.Color(0xfde2a0)}},vertexShader:'uniform float now;varying float pulse;void main(){vec3 p=position;p.x+=.33*sin(now*.32+p.z);p.y+=.20*sin(now*.55+p.x+p.y);pulse=.28+.57*pow(.5+.5*sin(now*.8+p.x+p.z),2.);vec4 eye=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*eye;gl_PointSize=clamp(9./max(1.,-eye.z),.8,3.);}',fragmentShader:'uniform vec3 tint;varying float pulse;void main(){float r=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(tint,(1.-smoothstep(.1,1.,r))*pulse); \n#include <colorspace_fragment>\n}'}));motif.add(sparks);
 // An actual look-at shot: altitude and lens travel exponentially from metres to kilometres.
 function shot(a,p,overviewIndex){const rig=sampleCinematicRig(a.key,p);if(rig){const dx=rig.eye[0]-rig.aim[0],dy=rig.eye[1]-rig.aim[1],dz=rig.eye[2]-rig.aim[2];return {x:rig.aim[0],z:rig.aim[2],y:a.y,angle:Math.atan2(dx,dz),d:Math.hypot(dx,dy,dz),el:Math.atan2(dy,Math.hypot(dx,dz)),head:rig.aim[1]-a.y,rig};}if(a.key==='overview'||!lens[a.key]){const t=overviewIndex===0?p:1-p;const broad=a.key==='overview';return {x:a.x,z:a.z,y:a.y+(broad?21:4),angle:-.17+.13*t,d:broad?1750-170*t:115,el:broad?1.02-.12*t:.55,head:0};}
  const [az,bz,dist,height,target]=lens[a.key];const q=ease(p),close=range(p,.45,1);
  // Move from an establishing composition to the person whose choice carries this beat.
  const closeup={cage:[.84,.18,.57,2.65],gallows:[-.63,-1.55,2.07,5.7],thornhallow:[-.34,.55,1.02,4.25],veilcross:[.08,.48,1.08,5.6],cairnhold:[.74,-.84,1.35,6.0]}[a.key];
  return {x:a.x+lerp((q-.5)*(a.key==='cage'?.85:1.38),closeup[0],close),z:a.z+lerp(.15,closeup[1],close),y:a.y,angle:lerp(az,bz,q),d:lerp(dist*1.15,closeup[3],close),el:Math.atan2(height-target,dist)+.045*(1-q),head:lerp(target,closeup[2],close)};}
 function paint(s,now){
  if(stopped)return;const width=viewport.clientWidth,height=viewport.clientHeight;if(!width||!height)return;
  if(width!==w||height!==h){w=width;h=height;renderer.setPixelRatio(Math.min(devicePixelRatio||1,w<780?1.4:1.55));renderer.setSize(w,h,false);}
  const dt=previousTime?Math.min(.07,(now-previousTime)/1000):0;previousTime=now;if(Number.isFinite(s.time))elapsed=s.time;else if(!s.still)elapsed+=dt;
  const input=s.still?0:1;pointer.dx=lerp(pointer.dx,pointer.x*input,.12);pointer.dy=lerp(pointer.dy,pointer.y*input,.12);
  const A=atlas[s.i],B=atlas[s.j],travel=s.travel,active=travel<.5?A:B,localPhase=s.phase;
  if(survey&&!active.rig&&!active.floorReady&&active.key!=='overview'&&now>nextFloor){nextFloor=now+600;floorRay.set(new T.Vector3(active.x,active.y+2,active.z),new T.Vector3(0,-1,0));floorRay.far=8;const hit=survey.pick(floorRay,{y:active.y,tolerance:.65,floor:true});if(hit&&Math.abs(hit.point.y-active.y)<4){active.y=hit.point.y+.035;active.floorReady=true;const item=built.get(active.key);if(item)item.group.position.y=active.y;}}
  const sa=shot(A,travel===0?localPhase:1,s.i),sb=shot(B,0,s.j);
  const dGround=Math.hypot(A.x-B.x,A.z-B.z);
  // Rise over the starting scene first; only travel laterally once the horizon opens.
  const sweep=range(travel,.14,.84),lift=Math.sin(Math.PI*travel)**1.38;
  const peak=A.key==='overview'||B.key==='overview'?0:Math.log(1+Math.max(120,dGround*.73)/7.5);
  const mobileScale=s=>w<=780&&!s.rig?lerp(1.88,1,range(s.d,30,800)):1;
  const distance=Math.exp(lerp(Math.log(sa.d*mobileScale(sa)),Math.log(sb.d*mobileScale(sb)),travel)+peak*lift);
  const freeCamera=!active.rig||travel>.12;
  const a=lerp(sa.angle,sb.angle,sweep)+lift*.20+(freeCamera?pointer.dx*.061*input+(active.key==='overview'?.022:.011)*Math.sin(elapsed*.16)*input:0);
  const elev=lerp(sa.el,sb.el,travel)+lift*.84*(A.key==='overview'||B.key==='overview'?.38:1)+ (freeCamera?pointer.dy*.014*input:0);
  const x=lerp(sa.x,sb.x,sweep)+(active.rig?0:(active.key==='veilcross'?.67:.14)*(1-range(distance,18,65))),z=lerp(sa.z,sb.z,sweep);
  const inside=active.key==='cage'&&distance<70;const ground=inside?lerp(sa.y+sa.head,sb.y+sb.head,sweep):Math.max(lerp(sa.y+sa.head,sb.y+sb.head,sweep),sample(x,z)+.55);earth.visible=!fullSurface&&!inside&&!s.castOnly;if(fullSurface){fullSurface.group.visible=!inside&&!s.castOnly;fullSurface.update(new T.Vector3(x,ground,z),distance);}
  aim.set(x,ground+lift*4,z);eye.set(x+Math.sin(a)*Math.cos(elev)*distance,ground+Math.sin(elev)*distance,z+Math.cos(a)*Math.cos(elev)*distance);
  if(!inside&&!active.rig)eye.y=Math.max(eye.y,sample(eye.x,eye.z)+1.65);
  camera.near=clamp(distance/350,.08,2);camera.aspect=w/h;camera.fov=lerp(sa.rig?(w<=780?sa.rig.mobileFov:sa.rig.fov):(w<=780?51:43),sb.rig?(w<=780?sb.rig.mobileFov:sb.rig.fov):(w<=780?51:43),sweep);
  const ox=w<=780?.50:.702,oy=w<=780?.275:.483;
  // Projection shift keeps the composition beside the text; it does not move map coordinates.
  camera.setViewOffset(w,h,w*(.5-ox),h*(.5-oy),w,h);camera.position.copy(eye);camera.lookAt(aim);camera.updateMatrixWorld();sky.position.copy(eye);
  const palA=colors[A.key]||colors.overview,palB=colors[B.key]||colors.overview;for(const [ix,n] of ['top','low','warm'].entries())skyU[n].value.setHex(palA[ix]).lerp(new T.Color(palB[ix]),sweep);
  fog.color.copy(skyU.low.value);fog.density=lerp(.0027,.00017,range(distance,8,230));sun.color.copy(skyU.warm.value);
  skyLight.intensity=inside?.40:1.48;sun.intensity=inside?.58:2.05;rim.intensity=inside?.65:1.2;
  sun.position.set(x-13,ground+19,z+13);sun.target.position.set(x,ground,z);
  let actorSet=null;lamp.intensity=0;rim.position.set(x-8,ground+6,z-5);rim.target.position.set(x,ground+1,z);
  for(const a of atlas){if(!choreography[a.key])continue;const near=Math.hypot(x-a.x,z-a.z)<82&&distance<200;
   if(near&&!built.has(a.key))environment(a);const item=built.get(a.key);if(!item)continue;item.group.visible=near;if(!near)continue;
   const p=a===A?(travel===0?localPhase:1):0,rig=sampleCinematicRig(a.key,p);const tc=s.still?1.7:elapsed;
   item.set.animate(p,tc,s.magic);
   item.cast.forEach((actor,i)=>{const rs=rig?.cast[i];const [sx,sz,yaw,ex,ez,first,middle,end]=rs?[rs.offset[0],rs.offset[2],rs.yaw,rs.offset[0],rs.offset[2],...rs.poses]:actor.plan;const leaving=!rig&&a.key==='cage'&&i===0,path=leaving?range(p,.47,.93):range(p,.13,.77);const beat=stagePose([first,middle,end],p),pose=leaving?(p<.47?'kneel':p<.93?'walk':'listen'):beat.act;const feet=rs?rs.offset[1]:(a.key==='gallows'&&(i===2||i===3)?.85:.035);actor.group.position.set(lerp(sx,ex,path),feet,lerp(sz,ez,path));actor.group.rotation.y=yaw+(rig?0:Math.sin(Math.PI*path)*.11);
    const mage=a.key==='veilcross'&&i===0&&s.magic;actor.group.visible=!mage;const act= a.key==='veilcross'&&i===1&&s.magic&&p>.45?'guard':pose;
    if(!mage)actor.pose(act,act==='walk'?(p*3.8+i*.21)%1:p,tc,beat.blend?{...beat.blend,phase:beat.blend.from==='walk'?(p*3.8+i*.21)%1:p}:null);if(i===0&&item.caster){const alt=item.caster;alt.group.visible=mage;if(mage){alt.group.position.copy(actor.group.position);alt.group.rotation.copy(actor.group.rotation);alt.pose('cast',p,tc);}}});
   if(item.fx){const {layer,shield,relief,curls,strand,beamMat}=item.fx;layer.visible=s.magic;relief.visible=s.magic;shield.visible=!s.magic;beamMat.opacity=.61+.24*Math.sin(tc*3.5)**2;strand.visible=p>.18;const friend=item.cast[0].group.position,foe=item.cast[1].group.position;relief.position.set(friend.x,.025,friend.z+.48);
    const start=new T.Vector3(friend.x+.32,friend.y+1.16,friend.z),finish=new T.Vector3(foe.x,foe.y+1.05,foe.z);
    if(item.caster?.group.visible){let hand;item.caster.group.traverse(o=>{if(o.isBone&&/^hand_r$/i.test(o.name.replace(/^.*[:|]/,'')))hand=o;});if(hand){item.group.updateMatrixWorld(true);hand.getWorldPosition(start);item.group.worldToLocal(start);}}
    const positions=strand.geometry.attributes.position,direction=finish.clone().sub(start).normalize(),u=new T.Vector3().crossVectors(direction,new T.Vector3(0,1,0)).normalize(),v=new T.Vector3().crossVectors(direction,u).normalize();
    for(let k=0;k<=26;k++){const f=k/26,center=start.clone().lerp(finish,f);center.y+=Math.sin(f*Math.PI)*(.15+.05*Math.sin(tc*4+f*9));for(let q=0;q<=5;q++){const angle=q/5*Math.PI*2,point=center.clone().addScaledVector(u,Math.cos(angle)*.026).addScaledVector(v,Math.sin(angle)*.026);positions.setXYZ(k*6+q,point.x,point.y,point.z);}}positions.needsUpdate=true;
    for(let j=0;j<curls.length;j++){const ring=curls[j];ring.position.set(foe.x,.21+j*.38+.06*Math.sin(tc*2+j),foe.z);ring.rotation.z=tc*.27+j;ring.rotation.y=.17*Math.sin(tc+j);}}
   if(a===active){actorSet=item;const fire=a.key==='cage',spell=a.key==='veilcross'&&s.magic;lamp.position.set(a.x+(fire?.82:spell?-.6:-2.1),a.y+(fire?.75:2.1),a.z+(fire?.25:1.4));lamp.color.setHex(fire?0xff9d3d:spell?0xffce68:0xffe0ab);lamp.intensity=fire?18+.7*Math.sin(tc*7):spell?17+3*Math.sin(tc*3):5;}
  }
  renderer.shadowMap.enabled=Boolean(actorSet&&distance<38);motif.visible=Boolean(actorSet&&distance<36);if(motif.visible){motif.position.set(active.x,active.y,active.z);sparks.material.uniforms.now.value=s.still?0:elapsed;}
  flames?.update(camera,s.castOnly?'':active.key,elapsed);native?.update(camera,aim,s.castOnly?'':active.key,s.castOnly?1000:distance);if(survey)survey.setReplacements(native?.replacements()||noReplacements);
  // The establishing shot uses measured world placements. The close story scene is a staged performance.
  if(survey){survey.group.visible=!s.castOnly;const quality=distance<100?'high':'balanced';if(quality!==surveyQuality){survey.setQuality(quality);surveyQuality=quality;}survey.update(camera,aim);}
  renderer.render(scene,camera);
  const boxes=[];const screenPts=viewport.querySelector('.pins');if(screenPts)screenPts.style.opacity=String(range(distance,22,145));
  for(const p of pinRows){tmp.set(p.x,p.y,p.z).project(camera);const sx=(tmp.x*.5+.5)*w,sy=(.5-tmp.y*.5)*h;const visible=tmp.z>0&&tmp.z<1&&sx>8&&sy>8&&sx<w-7&&sy<h-8&&distance>24;p.g.style.display=visible?'':'none';if(!visible)continue;p.g.setAttribute('transform','translate('+sx.toFixed(1)+' '+sy.toFixed(1)+')');const len=p.g.dataset.name.length*7+7,side=sx+len+12>w?-1:1;const left=side>0?sx+9:sx-9-len;const box=[left,sy-12,left+len,sy+9];const collide=boxes.some(b=>box[0]<b[2]+4&&box[2]>b[0]-4&&box[1]<b[3]+2&&box[3]>b[1]-2);const read=!collide&&(p.major||distance<600)&&left>0;
   p.label.style.display=read?'':'none';p.label.setAttribute('x',9*side);p.label.setAttribute('text-anchor',side<0?'end':'start');if(read)boxes.push(box);
  }
  viewport.classList.add('in-flight');viewport.dataset.shot=active.key;
 }
 viewport.prepend(canvas);return {paint,inspect:()=>{scene.updateMatrixWorld(true);return {shot:viewport.dataset.shot,anchors:atlas,cast:[...built].map(([key,item])=>({key,origin:item.group.position.toArray(),people:item.cast.map(a=>{const bounds=new T.Box3().setFromObject(a.group,true);return {role:a.role,rig:a.inspect?.(),ready:a.group.userData.castReady,error:a.group.userData.castError,bounds:[...bounds.min.toArray(),...bounds.max.toArray()],feet:a.group.position.toArray()};})})),survey:survey?.stats(),native:native?.stats()};}};
}
