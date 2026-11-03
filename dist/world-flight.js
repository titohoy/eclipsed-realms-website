// The route is a flat survey in world space. The camera, terrain, cast and light are 3D.
import * as T from './assets/cartography/engine/three.module.min.js';
import {makeActor} from './assets/cartography/players.js';
import {makeSet} from './assets/cartography/stages.js';

const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x)), lerp=(a,b,t)=>a+(b-a)*t;
const ease=x=>{x=clamp(x);return x*x*(3-2*x);}, range=(x,a,b)=>ease((x-a)/(b-a));
const toM=n=>(n/1000-.5)*4032;
const choreography={
 cage: [['traveler',-1.57,-1.57,.56, -.46,1.18,'kneel','walk','listen'],['doll',.88,.14,-.3,.84,.18,'idle','point','idle']],
 gallows:[['traveler',-2.15,3.3,3.03,-1.23,1.24,'walk','walk','listen'],['guard',1.70,-.72,.12,1.78,-.69,'guard','point','guard'],['villager',-1.15,-1.7,.2,-1.15,-1.7,'listen','kneel','listen'],['villager',-.34,-1.68,-.2,-.35,-1.69,'listen','listen','listen'],['villager',1.42,1.46,3.1,1.63,1.12,'walk','listen','listen'],['companion',.03,2.05,2.7,.45,1.6,'listen','walk','listen']],
 thornhallow:[['villager',-.23,.61,.2,-.37,.58,'kneel','kneel','listen'],['traveler',-2.12,2.8,2.45,-1.24,.95,'walk','walk','kneel'],['guard',1.54,-1,-.65,1.06,-.35,'guard','walk','point'],['companion',-1.82,-1.12,.8,-1.82,-1.12,'listen','point','listen']],
 veilcross:[['traveler',-1.3,.68,1.71,-.9,.65,'guard','block','guard'],['fighter',2.13,.15,-1.19,1.06,.17,'walk','strike','guard']],
 cairnhold:[['traveler',-2.55,2.85,2.7,-.59,-.12,'walk','walk','listen'],['guard',1.66,-1.55,-.36,1.66,-1.54,'guard','point','guard'],['villager',2.37,.63,-1.6,.47,.38,'walk','walk','idle'],['companion',-2.24,2.05,2.54,-1.45,.58,'walk','walk','listen']]
};
// [start azimuth, end azimuth; distance, height, aim height]. A new composition for every chapter.
const lens={cage:[-.28,.31,5.8,1.92,.96],gallows:[.46,-.31,8.4,3.2,1.15],thornhallow:[-.49,.22,7.15,2.48,1.04],veilcross:[.33,-.35,6.3,1.95,1.04],cairnhold:[-.43,.28,8.85,2.55,1.65]};
const colors={cage:[0x302e32,0x4c4740,0xe5ad62],gallows:[0x738083,0xb1a489,0xffdfac],thornhallow:[0x506d68,0xb0b49a,0xffe3a5],veilcross:[0x465b64,0x9aada2,0xf1d7a0],cairnhold:[0x56687c,0xd3ac86,0xffcc88],overview:[0x455b62,0xadaf8d,0xffe4af]};
export async function createFlight(viewport,chapters){
 const canvas=document.createElement('canvas');canvas.className='flight-surface';canvas.setAttribute('aria-hidden','true');
 const gl=canvas.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'high-performance'});if(!gl)throw Error('No 3D context');
 const renderer=new T.WebGLRenderer({canvas,context:gl,alpha:false,antialias:true});
 let stopped=false;
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();stopped=true;viewport.classList.remove('in-flight');canvas.remove();window.dispatchEvent(new Event('flightfallback'))},{once:true});
 const texUrl='assets/cartography/';
 const bytes=async url=>{const r=await fetch(texUrl+url);if(!r.ok)throw Error('Missing landscape');return r.arrayBuffer()};
 const [raw,grove,map]=await Promise.all([bytes('relief.bin'),bytes('groves.bin'),new T.TextureLoader().loadAsync(texUrl+'terrain-map.webp')]);
 const grid=new Uint16Array(raw),N=505; if(grid.length!==N*N)throw Error('Incomplete landscape');
 const sample=(x,z)=>{const a=clamp(x/4032+.5)*(N-1),b=clamp(z/4032+.5)*(N-1),i=Math.floor(a),j=Math.floor(b),u=a-i,v=b-j;
  return (lerp(lerp(grid[j*N+i],grid[j*N+Math.min(i+1,N-1)],u),lerp(grid[Math.min(j+1,N-1)*N+i],grid[Math.min(j+1,N-1)*N+Math.min(i+1,N-1)],u),v)-32768)*.0078125};
 map.colorSpace=T.SRGBColorSpace;map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(43,1,.06,19500);
 const fog=scene.fog=new T.FogExp2(0xadb19a,.00019);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
 const sun=new T.DirectionalLight(0xffe3aa,2.05);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{near:1,far:100,left:-11,right:11,top:11,bottom:-11});sun.shadow.normalBias=.025;sun.shadow.bias=-.0005;scene.add(sun,sun.target);
 const skyLight=new T.HemisphereLight(0xe2eee9,0x7a6855,1.45);scene.add(skyLight);
 const geometry=new T.PlaneGeometry(4032,4032,252,252);geometry.rotateX(-Math.PI/2);
 const pos=geometry.attributes.position;for(let j=0;j<pos.count;j++)pos.setY(j,sample(pos.getX(j),pos.getZ(j)));geometry.computeVertexNormals();
 const earth=new T.Mesh(geometry,new T.MeshStandardMaterial({map,roughness:1,metalness:0}));earth.receiveShadow=true;scene.add(earth);
 const skyU={top:{value:new T.Color()},low:{value:new T.Color()},warm:{value:new T.Color()}};
 const sky=new T.Mesh(new T.SphereGeometry(11500,24,12),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:skyU,
 vertexShader:'varying vec3 ray;void main(){ray=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:'varying vec3 ray;uniform vec3 top,low,warm;void main(){vec3 d=normalize(ray);float h=clamp(d.y,0.,1.);vec3 col=mix(low,top,pow(h,.46));float s=max(0.,dot(d,normalize(vec3(-.59,.22,-.8))));col+=warm*(.17*pow(s,14.)+.55*pow(s,400.)+.65*smoothstep(.9992,.9997,s));float haze=sin(d.x*21.+d.z*16.+h*45.)*sin(h*79.+d.x*14.);col+=vec3(.013)*haze*(1.-smoothstep(.04,.48,h));gl_FragColor=vec4(col,1.);\n#include <colorspace_fragment>\n}'}));sky.renderOrder=-2;sky.frustumCulled=false;scene.add(sky);

 const atlas=chapters.map(el=>{const x=toM(+el.dataset.cx),z=toM(+el.dataset.cy);let y=sample(x,z);if(el.dataset.anchor!=='overview'){for(const dx of [-4,0,4])for(const dz of [-3,0,3])y=Math.max(y,sample(x+dx,z+dz));}return {key:el.dataset.anchor,x,y:y+.07,z}});
 // Tree glyphs lift off the plate into a single batched forest, using surveyed tree positions.
 const trees=new Int16Array(grove),treeGeom=new T.ConeGeometry(1,1,7),n=trees.length/2,obj=new T.Object3D();const forest=new T.InstancedMesh(treeGeom,new T.MeshStandardMaterial({color:0xffffff,roughness:.92,flatShading:true}),n*2);
 let k=0;for(let i=0;i<n;i++){const x=trees[i*2]/10,z=trees[i*2+1]/10;if(atlas.some(a=>a.key!=='overview'&&Math.hypot(x-a.x,z-a.z)<13))continue;
  const seed=Math.abs(Math.sin(i*74.53)*472.48)%1,h=4.7+seed*6.3,y=sample(x,z);for(let layer=0;layer<2;layer++){obj.position.set(x,y+h*(layer?.75:.48),z);obj.rotation.y=i*1.15;obj.scale.set(h*(layer?.19:.28),h*(layer?.5:.73),h*(layer?.2:.26));obj.updateMatrix();forest.setMatrixAt(k,obj.matrix);forest.setColorAt(k++,new T.Color().setHSL(.36+seed*.026,.20+seed*.12,.14+seed*.08+layer*.035));}}
 forest.count=k;scene.add(forest);
 const trunks=new T.InstancedMesh(new T.CylinderGeometry(.1,.19,1,5),new T.MeshStandardMaterial({color:0x635343,roughness:1}),n);
 let nt=0;for(let i=0;i<n;i++){const x=trees[i*2]/10,z=trees[i*2+1]/10;if(atlas.some(a=>a.key!=='overview'&&Math.hypot(x-a.x,z-a.z)<13))continue;obj.position.set(x,sample(x,z)+.8,z);obj.scale.set(1,1.7,1);obj.updateMatrix();trunks.setMatrixAt(nt++,obj.matrix)}trunks.count=nt;scene.add(trunks);
 const lamp=new T.PointLight(0xffb151,0,11,2),rim=new T.DirectionalLight(0xc0e1ff,1.2);scene.add(lamp,rim,rim.target);
 const pinRows=Array.from(viewport.querySelectorAll('[data-pin]'),g=>({g,x:toM(+g.dataset.x),z:toM(+g.dataset.y),label:g.querySelector('text'),major:g.hasAttribute('data-major')})).sort((a,b)=>b.major-a.major);
 for(const p of pinRows)p.y=sample(p.x,p.z)+5;
 const pointer={x:0,y:0,dx:0,dy:0};const hover=matchMedia('(hover:hover) and (pointer:fine)');
 viewport.parentElement.addEventListener('pointermove',e=>{if(!hover.matches||e.pointerType==='touch')return;const r=viewport.getBoundingClientRect();pointer.x=clamp((e.clientX-r.left)/r.width*2-1,-1,1);pointer.y=clamp((e.clientY-r.top)/r.height*2-1,-1,1)},{passive:true});
 viewport.parentElement.addEventListener('pointerleave',()=>{pointer.x=pointer.y=0});
 const built=new Map(),tmp=new T.Vector3(),aim=new T.Vector3(),eye=new T.Vector3();
 const environment=(a)=>{if(built.has(a.key))return built.get(a.key);const set=makeSet(T,a.key);const group=set.group;group.position.set(a.x,a.y,a.z);scene.add(group);const cast=choreography[a.key].map(([role,...plan],i)=>{const actor=makeActor(T,role,i);group.add(actor.group);return {...actor,role,plan};});
 let caster=null;if(a.key==='veilcross'){caster=makeActor(T,'mage',34);group.add(caster.group);}
 group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 let fx=null;if(a.key==='veilcross'){
  const layer=new T.Group();group.add(layer);const beamMat=new T.MeshBasicMaterial({color:0xffdd8b,transparent:true,opacity:.8,depthWrite:false,blending:T.AdditiveBlending});
  const curve=new T.CatmullRomCurve3([new T.Vector3(-.81,1.16,.66),new T.Vector3(-.28,1.4,.53),new T.Vector3(.36,1.18,.48),new T.Vector3(1.02,.91,.20)]);
  const strand=new T.Mesh(new T.TubeGeometry(curve,26,.026,5,false),beamMat);layer.add(strand);
  const curls=[];for(let q=0;q<3;q++){const loop=new T.Mesh(new T.TorusGeometry(.44,.016,5,40),beamMat);loop.rotation.x=1.33;layer.add(loop);curls.push(loop);}
  const shield=new T.Mesh(new T.CylinderGeometry(.43,.36,.09,7),new T.MeshStandardMaterial({color:0x506765,roughness:.55,metalness:.45}));
  shield.rotation.x=Math.PI/2;cast[0].group.add(shield);const boss=new T.Mesh(new T.SphereGeometry(.105,8,5),new T.MeshStandardMaterial({color:0xc6aa70,metalness:.6,roughness:.45}));shield.add(boss);boss.position.y=.075;
  fx={layer,shield,curls,strand,beamMat};}
 const item={set,group,cast,caster,fx};built.set(a.key,item);return item;};
 let w=0,h=0,previousTime=0,elapsed=0;
 const motif=new T.Group();scene.add(motif);const dustGeometry=new T.BufferGeometry(),dustPos=new Float32Array(64*3);
 for(let i=0;i<64;i++){dustPos[3*i]=(Math.sin(i*711.7)*.5+.5)*15-7.5;dustPos[3*i+1]=.32+(Math.cos(i*47.73)*.5+.5)*3.5;dustPos[3*i+2]=Math.sin(i*131.77)*6;}
 dustGeometry.setAttribute('position',new T.BufferAttribute(dustPos,3));
 const sparks=new T.Points(dustGeometry,new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{now:{value:0},tint:{value:new T.Color(0xfde2a0)}},vertexShader:'uniform float now;varying float pulse;void main(){vec3 p=position;p.x+=.33*sin(now*.32+p.z);p.y+=.20*sin(now*.55+p.x+p.y);pulse=.28+.57*pow(.5+.5*sin(now*.8+p.x+p.z),2.);vec4 eye=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*eye;gl_PointSize=clamp(9./max(1.,-eye.z),.8,3.);}',fragmentShader:'uniform vec3 tint;varying float pulse;void main(){float r=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(tint,(1.-smoothstep(.1,1.,r))*pulse); \n#include <colorspace_fragment>\n}'}));motif.add(sparks);
 // An actual look-at shot: altitude and lens travel exponentially from metres to kilometres.
 function shot(a,p,overviewIndex){if(a.key==='overview'){const t=overviewIndex===0?p:1-p;return {x:a.x,z:a.z,y:a.y+21,angle:-.17+.13*t,d:1750-170*t,el:1.02-.12*t,head:0};}
  const [az,bz,dist,height,target]=lens[a.key];const q=ease(p);return {x:a.x+(q-.5)*(a.key==='cage'?.85:1.38),z:a.z+.15,y:a.y,angle:lerp(az,bz,q),d:dist*(1.15-.23*q),el:Math.atan2(height-target,dist)+.045*(1-q),head:target};}
 function paint(s,now){
  if(stopped)return;const width=viewport.clientWidth,height=viewport.clientHeight;if(!width||!height)return;
  if(width!==w||height!==h){w=width;h=height;renderer.setPixelRatio(Math.min(devicePixelRatio||1,w<780?1.4:1.55));renderer.setSize(w,h,false);}
  const dt=previousTime?Math.min(.07,(now-previousTime)/1000):0;previousTime=now;if(!s.still)elapsed+=dt;
  const input=s.still?0:1;pointer.dx=lerp(pointer.dx,pointer.x*input,.12);pointer.dy=lerp(pointer.dy,pointer.y*input,.12);
  const A=atlas[s.i],B=atlas[s.j],travel=s.travel,active=travel<.5?A:B,localPhase=s.phase;
  const sa=shot(A,travel===0?localPhase:1,s.i),sb=shot(B,0,s.j);
  const dGround=Math.hypot(A.x-B.x,A.z-B.z);
  // Rise over the starting scene first; only travel laterally once the horizon opens.
  const sweep=range(travel,.14,.84),lift=Math.sin(Math.PI*travel)**1.38;
  const peak=A.key==='overview'||B.key==='overview'?0:Math.log(1+Math.max(120,dGround*.73)/7.5);
  const distance=(w<=780?lerp(1.88,1,range(Math.min(sa.d,sb.d),30,800)):1)*Math.exp(lerp(Math.log(sa.d),Math.log(sb.d),travel)+peak*lift);
  const a=lerp(sa.angle,sb.angle,sweep)+lift*.20+pointer.dx*.061*input+(active.key==='overview'?.022:.011)*Math.sin(elapsed*.16)*input;
  const elev=lerp(sa.el,sb.el,travel)+lift*.84*(A.key==='overview'||B.key==='overview'?.38:1)+pointer.dy*.014*input;
  const x=lerp(sa.x,sb.x,sweep)+(active.key==='veilcross'?.67:.14)*(1-range(distance,18,65)),z=lerp(sa.z,sb.z,sweep);
  const ground=Math.max(lerp(sa.y+sa.head,sb.y+sb.head,sweep),sample(x,z)+.55);
  aim.set(x,ground+lift*4,z);eye.set(x+Math.sin(a)*Math.cos(elev)*distance,ground+Math.sin(elev)*distance,z+Math.cos(a)*Math.cos(elev)*distance);
  eye.y=Math.max(eye.y,sample(eye.x,eye.z)+1.65);
  camera.near=clamp(distance/350,.08,2);camera.aspect=w/h;camera.fov=(w<=780?51:43);
  const ox=w<=780?.50:.702,oy=w<=780?.275:.483;
  // Projection shift keeps the composition beside the text; it does not move map coordinates.
  camera.setViewOffset(w,h,w*(.5-ox),h*(.5-oy),w,h);camera.position.copy(eye);camera.lookAt(aim);camera.updateMatrixWorld();sky.position.copy(eye);
  const palA=colors[A.key],palB=colors[B.key];for(const [ix,n] of ['top','low','warm'].entries())skyU[n].value.setHex(palA[ix]).lerp(new T.Color(palB[ix]),sweep);
  fog.color.copy(skyU.low.value);fog.density=lerp(.0027,.00017,range(distance,8,230));sun.color.copy(skyU.warm.value);
  skyLight.intensity=active.key==='cage'&&distance<17?.97:1.48;
  sun.position.set(x-13,ground+19,z+13);sun.target.position.set(x,ground,z);
  let actorSet=null;lamp.intensity=0;rim.position.set(x-8,ground+6,z-5);rim.target.position.set(x,ground+1,z);
  for(const a of atlas){if(a.key==='overview')continue;const near=Math.hypot(x-a.x,z-a.z)<82&&distance<200;
   if(near&&!built.has(a.key))environment(a);const item=built.get(a.key);if(!item)continue;item.group.visible=near;if(!near)continue;
   const p=a===A?(travel===0?localPhase:1):0;const tc=s.still?1.7:elapsed;
   item.set.animate(p,tc,s.magic);
   item.cast.forEach((actor,i)=>{const [sx,sz,yaw,ex,ez,first,middle,end]=actor.plan;const leaving=a.key==='cage'&&i===0,path=leaving?range(p,.47,.93):range(p,.13,.77);const pose=leaving?(p<.47?'kneel':p<.93?'walk':'listen'):p<.19?first:p<.73?middle:end;const feet=a.key==='gallows'&&(i===2||i===3)?.85:.035;actor.group.position.set(lerp(sx,ex,path),feet,lerp(sz,ez,path));actor.group.rotation.y=yaw+Math.sin(Math.PI*path)*.11;
    const mage=a.key==='veilcross'&&i===0&&s.magic;actor.group.visible=!mage;const act= a.key==='veilcross'&&i===1&&s.magic&&p>.45?'guard':pose;
    if(!mage)actor.pose(act,act==='walk'?(p*3.8+i*.21)%1:p,tc);if(i===0&&item.caster){const alt=item.caster;alt.group.visible=mage;if(mage){alt.group.position.copy(actor.group.position);alt.group.rotation.copy(actor.group.rotation);alt.pose('cast',p,tc);}}});
   if(item.fx){const {layer,shield,curls,strand,beamMat}=item.fx;layer.visible=s.magic;shield.visible=!s.magic;shield.position.set(-.28,.85+.19*Math.sin(Math.PI*p),.31+.08*p);beamMat.opacity=.61+.24*Math.sin(tc*3.5)**2;strand.visible=p>.18;const foe=item.cast[1].group.position;for(let j=0;j<curls.length;j++){const ring=curls[j];ring.position.set(foe.x,.21+j*.38+.06*Math.sin(tc*2+j),foe.z);ring.rotation.z=tc*.27+j;ring.rotation.y=.17*Math.sin(tc+j);}}
   if(a===active){actorSet=item;const fire=a.key==='cage',spell=a.key==='veilcross'&&s.magic;lamp.position.set(a.x+(fire?.82:spell?-.6:-2.1),a.y+(fire?.75:2.1),a.z+(fire?.25:1.4));lamp.color.setHex(fire?0xff9d3d:spell?0xffce68:0xffe0ab);lamp.intensity=fire?15+.85*Math.sin(tc*7):spell?17+3*Math.sin(tc*3):5;}
  }
  renderer.shadowMap.enabled=Boolean(actorSet&&distance<38);motif.visible=Boolean(actorSet&&distance<36);if(motif.visible){motif.position.set(active.x,active.y,active.z);sparks.material.uniforms.now.value=s.still?0:elapsed;}
  renderer.render(scene,camera);
  const boxes=[];const screenPts=viewport.querySelector('.pins');if(screenPts)screenPts.style.opacity=String(range(distance,22,145));
  for(const p of pinRows){tmp.set(p.x,p.y,p.z).project(camera);const sx=(tmp.x*.5+.5)*w,sy=(.5-tmp.y*.5)*h;const visible=tmp.z>0&&tmp.z<1&&sx>8&&sy>8&&sx<w-7&&sy<h-8&&distance>24;p.g.style.display=visible?'':'none';if(!visible)continue;p.g.setAttribute('transform','translate('+sx.toFixed(1)+' '+sy.toFixed(1)+')');const len=p.g.dataset.name.length*7+7,side=sx+len+12>w?-1:1;const left=side>0?sx+9:sx-9-len;const box=[left,sy-12,left+len,sy+9];const collide=boxes.some(b=>box[0]<b[2]+4&&box[2]>b[0]-4&&box[1]<b[3]+2&&box[3]>b[1]-2);const read=!collide&&(p.major||distance<600)&&left>0;
   p.label.style.display=read?'':'none';p.label.setAttribute('x',9*side);p.label.setAttribute('text-anchor',side<0?'end':'start');if(read)boxes.push(box);
  }
  viewport.classList.add('in-flight');viewport.dataset.shot=active.key;
 }
 viewport.prepend(canvas);return {paint};
}
