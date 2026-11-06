import * as T from '../cartography/engine/three.module.min.js';
import {GLTFLoader} from './engine/GLTFLoader.js';
import {clone} from './engine/SkeletonUtils.js';

const loader=new GLTFLoader(),files=new Map();
let catalog;
export async function loadProp(role){const m=await names();const e=m.props?.[role];if(!e)return null;return clone((await getModel(e.file)).scene);}
const names=()=>catalog??=fetch(new URL('./cast.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Cast unavailable');return r.json();});
function getModel(file){
 if(!files.has(file))files.set(file,loader.loadAsync(new URL(file,import.meta.url).href));
 return files.get(file);
}
const unit=new T.Vector3(),end=new T.Vector3(),from=new T.Vector3(),tempQ=new T.Quaternion(),parentQ=new T.Quaternion(),worldQ=new T.Quaternion();
const period=Math.PI*2;
const AXIS_X=new T.Vector3(1,0,0),AXIS_Y=new T.Vector3(0,1,0),AXIS_Z=new T.Vector3(0,0,1),turnA=new T.Vector3(),turnQ=new T.Quaternion(),turnB=new T.Quaternion(),turnP=new T.Quaternion(),turnG=new T.Quaternion();
// Rotate a bone about an axis given in the actor's frame (independent of each skeleton's bind axes), then refresh its children.
function rotateBone(group,bone,axis,angle){
 if(!bone||!bone.parent||!angle)return;
 group.getWorldQuaternion(turnG);turnA.copy(axis).applyQuaternion(turnG);turnQ.setFromAxisAngle(turnA,angle);
 bone.getWorldQuaternion(turnB);bone.parent.getWorldQuaternion(turnP).invert();
 bone.quaternion.copy(turnP.multiply(turnQ.multiply(turnB)));bone.updateMatrixWorld(true);
}
export function makePerson(three,role,seed=0){
 const group=new T.Group(),turn=(bone,axis,angle)=>rotateBone(group,bone,axis,angle);
 let live=null,last={'act':'idle','phase':0,'time':0,blend:null,extra:null},extraNow=null;
 function plant(){
   const {root,rig,b,soleY}=live;root.updateMatrixWorld(true);
   let bottom=Infinity;for(const foot of [b.foot_l,b.foot_r].filter(Boolean)){foot.getWorldPosition(end);group.worldToLocal(end);bottom=Math.min(bottom,end.y);}
   if(Number.isFinite(bottom)){rig.position.y+=soleY-bottom;root.updateMatrixWorld(true);}
 }
 function draw(act='idle',phase=0,time=0,blend=null,extra=null){
   last={act,phase,time,blend,extra};extraNow=extra;if(!live)return;
   if(!blend||blend.from===act||blend.amount>=1){sample(act,phase,time);return;}
   sample(blend.from,blend.phase??phase,time);
   const previous=[...live.rest].map(([bone])=>[bone,bone.quaternion.clone(),bone.position.clone(),bone.scale.clone()]);
   const y=live.rig.position.y;sample(act,phase,time);const amount=Math.max(0,Math.min(1,blend.amount));
   for(const [bone,q,p,s]of previous){bone.quaternion.slerpQuaternions(q,bone.quaternion,amount);bone.position.lerpVectors(p,bone.position,amount);bone.scale.lerpVectors(s,bone.scale,amount);}
   live.rig.position.y=y+(live.rig.position.y-y)*amount;plant();
 }
 function sample(act='idle',phase=0,time=0){
   const {root,b,rest,restPositions,restScales,mixer,actions,rig,restHeight,model,soleY}=live;
   const walking=act==='walk',bow=act==='bow'?Math.max(0,Math.min(1,phase)):0,kneel=act==='kneel'||act==='bow',swing=Math.sin(phase*period),bob=Math.sin(time*1.44+seed*.8);
   const chosen=actions[act]||(walking?(actions.walk||actions.idle||actions.pray):(act==='pray'?actions.pray:actions.idle)||actions.pray);
   for(const [bone,q]of chosen?(live.nativePose||rest):rest){bone.quaternion.copy(q);bone.position.copy((chosen?live.nativePositions:null)?.get(bone)||restPositions.get(bone));bone.scale.copy((chosen?live.nativeScales:null)?.get(bone)||restScales.get(bone));}
   if(chosen){if(live.action!==chosen){if(live.action)live.action.stop();chosen.reset().play();live.action=chosen;}
     const duration=chosen.getClip().duration,oneShot=Boolean(actions[act])&&!['idle','walk','pray'].includes(act);
     chosen.time=oneShot?Math.max(0,Math.min(1,phase))*(duration-.00001):walking&&actions.walk?(phase%1)*duration:(time+seed*.6)%duration;mixer.update(0);
     if(!live.nativePose){live.nativePose=new Map();live.nativePositions=new Map();live.nativeScales=new Map();}
     for(const [bone]of rest){if(!live.nativePose.has(bone)){live.nativePose.set(bone,new T.Quaternion());live.nativePositions.set(bone,new T.Vector3());live.nativeScales.set(bone,new T.Vector3());}live.nativePose.get(bone).copy(bone.quaternion);live.nativePositions.get(bone).copy(bone.position);live.nativeScales.get(bone).copy(bone.scale);}
   }
   rig.position.y=restHeight-(kneel?.38:0);root.updateMatrixWorld(true);
   // Body language on top of any pose: lean (forward +) / twist (left +) / sway through the spine, and a bow that folds the
   // kneeling figure forward. Angles are radians about the actor's own axes (x right-to-left, y up, z forward).
   const lean=bow*.95+(extraNow?.lean||0),twist=extraNow?.twist||0,sway=extraNow?.sway||0;
   if(lean||twist||sway)for(const c of live.chains){const spine=c.spine||[];if(!spine.length)continue;
     for(const bone of spine){if(lean)turn(bone,AXIS_X,lean/spine.length);if(twist)turn(bone,AXIS_Y,twist/spine.length);if(sway)turn(bone,AXIS_Z,sway/spine.length);}}
   // Pose directions are anatomical directions in the actor's own upright frame. This is
   // independent of the assorted bind axes used by the project's character skeletons.
   function aim(bone,tip,x,y,z,amount=1){
     if(!bone||!tip)return;bone.getWorldPosition(from);tip.getWorldPosition(end);from.subVectors(end,from).normalize();
     unit.set(x,y,z).normalize().applyQuaternion(group.getWorldQuaternion(worldQ));
     tempQ.setFromUnitVectors(from,unit).multiply(bone.getWorldQuaternion(worldQ));
     parentQ.copy(bone.parent.getWorldQuaternion(worldQ)).invert().multiply(tempQ);bone.quaternion.slerp(parentQ,amount);bone.updateMatrixWorld(true);
   }
   if(!chosen||act==='cast'||act==='point'||act==='block'||act==='guard'||act==='knife'||act==='strike'||kneel){
    for(const b of live.chains)for(const [sgn,side] of [[1,'l'],[-1,'r']]){
       const l=sgn===1,arm=b['arm_'+side],fore=b['fore_'+side],hand=b['hand_'+side];
       let ax=sgn*.18,ay=-.94,az=.07,fx=sgn*.02,fy=-.88,fz=.28;
       if(walking){az=sgn*.38*swing;fz=.32+sgn*.35*swing;}
       if(act==='cast'){ax=sgn*.46;ay=-.36;az=.8;fx=-sgn*.15;fy=.35+.08*bob;fz=.94;}
       if(act==='pray'){ax=sgn*.29;ay=-.68;az=.52;fx=-sgn*.71;fy=.68;fz=.22;}
       if(act==='point'&&l){ax=.39;ay=.09;az=.9;fx=.22;fy=.13;fz=.95;}
       if(act==='block'||act==='guard'){ax=sgn*.36;ay=-.58;az=.57;fx=-sgn*.22;fy=l?.65:.23;fz=.75;}
       if(act==='knife'){ax=sgn*(l?.18:.28);ay=l?-.83:-.80;az=l?.53:.45;fx=l?-.08:.08;fy=l?-.15:.02;fz=l?.98:.99;}
       if(act==='strike'&&!l){ax=-.43;ay=.59-Math.sin(phase*Math.PI)*.72;az=.8;fx=.17;fy=.55-Math.sin(phase*Math.PI)*.68;fz=.88;}
       if(kneel){az=.5;fy=-.35;fz=.83;}
       if(bow){ax=sgn*.2;ay=-.46*bow-.94*(1-bow);az=.8*bow+.07*(1-bow);fx=sgn*.04;fy=-.9*bow-.35*(1-bow);fz=.45*bow+.83*(1-bow);}
       if(act==='knife'&&!l&&extraNow?.raise){const r=extraNow.raise;ay+=r*.62;az+=r*.28;ax-=r*.16;fy+=r*.72;fz-=r*.05;}
       aim(arm,fore,ax,ay,az,.96);aim(fore,hand,fx,fy,fz,.96);
     }
   }
   if(kneel||(!actions.walk&&walking)){for(const b of live.chains)for(const [sgn,side] of [[1,'l'],[-1,'r']]){
      const forward=kneel?(sgn>0?.99:-.08):sgn*.53*swing;
      aim(b['leg_'+side],b['shin_'+side],sgn*.05,kneel?(sgn>0?-.12:-.99):-.92,forward);
      aim(b['shin_'+side],b['foot_'+side],0,kneel?(sgn>0?-.99:.03):-.93,kneel?(sgn>0?-.1:-.999):-.24+forward*.55);
   }}
   if(act==='knife')for(const chain of live.chains)for(const side of ['l','r']){
    const hand=chain['hand_'+side];if(!hand)continue;
    const basis=side==='r'?new T.Matrix4().makeBasis(new T.Vector3(0,.9165,-.4).normalize(),new T.Vector3(0,.4,.9165).normalize(),new T.Vector3(1,0,0)):new T.Matrix4().makeBasis(new T.Vector3(0,1,0),new T.Vector3(1,0,0),new T.Vector3(0,0,-1));
    tempQ.setFromRotationMatrix(basis).premultiply(group.getWorldQuaternion(worldQ));
    parentQ.copy(hand.parent.getWorldQuaternion(worldQ)).invert().multiply(tempQ);hand.quaternion.copy(parentQ);hand.updateMatrixWorld(true);
   }
   if(act==='knife')for(const [bone,q]of rest){const key=bone.name.toLowerCase();if(/^(index|middle|ring|pinky)_0[123]_l$/.test(key)){bone.quaternion.copy(q);bone.rotateY(.08);}else if(/^thumb_0[123]_l$/.test(key)){bone.quaternion.copy(q);}else if(/^(index|middle|ring|pinky)_0[123]_r$/.test(key)){const joint=+key.match(/_0([123])_/)[1];bone.rotateY([0,.95,1.22,.72][joint]);}else if(/^thumb_0[123]_r$/.test(key)){bone.rotateY(.24);bone.rotateZ(-.18);}}
   for(const b of live.chains)if(b.head){const q=rest.get(b.head);if(!chosen)b.head.quaternion.copy(q);b.head.rotateZ((act==='listen'?.08:.025)*Math.sin(time*.64+seed));
     if(bow)turn(b.head,AXIS_X,.35*bow);
     if(extraNow?.headYaw)turn(b.head,AXIS_Y,extraNow.headYaw);if(extraNow?.headPitch)turn(b.head,AXIS_X,extraNow.headPitch);}
   root.updateMatrixWorld(true);
   // Keep the original soles on the stage when native clips translate their root.
   plant();
 }
 const ready=names().then(async manifest=>{
   const family=manifest.roles[role]||manifest.roles.villager,entry=Array.isArray(family)?family[seed%family.length]:family;if(!entry)return;
   const gltf=await getModel(entry.file);const model=clone(gltf.scene);const rig=new T.Group(),root=new T.Group();root.add(rig);rig.add(model);
   let b;const rest=new Map(),restPositions=new Map(),restScales=new Map(),all={},parts=new Map();
   model.traverse(o=>{if(o.isMesh){if(o.isSkinnedMesh){const w=o.geometry.getAttribute('skinWeight');if(w&&(!(w.array instanceof Float32Array)||w.normalized)){const values=new Float32Array(w.count*4);for(let i=0;i<w.count;i++)values.set([w.getX(i),w.getY(i),w.getZ(i),w.getW(i)],i*4);o.geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(values,4));}o.normalizeSkinWeights();}o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;for(const m of Array.isArray(o.material)?o.material:[o.material]){if(m.map)m.map.anisotropy=4;}}
    if(o.isBone){const raw=o.name.toLowerCase().replace(/^.*[:|]/,''),prefix=raw.match(/^part\d+_/)?.[0]||'',k=raw.replace(/^part\d+_/,'').replace(/^mixamorig/,'');if(!all[k])all[k]=o;if(!parts.has(prefix))parts.set(prefix,{});parts.get(prefix)[k]=o;rest.set(o,o.quaternion.clone());restPositions.set(o,o.position.clone());restScales.set(o,o.scale.clone());}});
   if(entry.tint)tintCloth(gltf,entry.tint);
   if(entry.eyes)recolorEyes(gltf,entry.eyes);
   function named(...n){return n.map(k=>all[k]).find(Boolean);}
   function chain(source){const b={},named=(...n)=>n.map(k=>source[k]).find(Boolean);
   for(const side of ['l','r']){const s=side==='l'?'left':'right';
     b['arm_'+side]=named('upperarm_'+side,s+'arm','upper_arm_'+side);b['fore_'+side]=named('lowerarm_'+side,s+'forearm','forearm_'+side);
     b['hand_'+side]=named('hand_'+side,s+'hand');b['leg_'+side]=named('thigh_'+side,s+'upleg');b['shin_'+side]=named('calf_'+side,s+'leg','shin_'+side);b['foot_'+side]=named('foot_'+side,s+'foot');}
   b.head=named('head','head_01','b_head');
   b.spine=[['spine_01','spine01','spine','pelvis_spine'],['spine_02','spine02','spine1'],['spine_03','spine03','spine2'],['spine_04','spine04'],['spine_05','spine05']].map(k=>named(...k)).filter(Boolean);return b;}const chains=[...parts.values()].map(chain);b=chains[0]||chain(all);
   model.updateMatrixWorld(true);const box=new T.Box3().setFromObject(model,true),size=box.getSize(new T.Vector3());
   if(!(size.y>0&&Number.isFinite(size.y)))return;
   const scale=(entry.height||1.72)/size.y;model.scale.multiplyScalar(scale);
   let facing=entry.yaw??0;
   if(entry.yaw==null){const toe=named('ball_l','lefttoebase','toe_l');const foot=b.foot_l;
     if(toe&&foot){const a=new T.Vector3(),c=new T.Vector3();toe.getWorldPosition(a);foot.getWorldPosition(c);a.sub(c);if(Math.hypot(a.x,a.z)>.0001)facing=-Math.atan2(a.x,a.z);}}
   model.rotation.y+=facing;model.updateMatrixWorld(true);box.setFromObject(model,true);const mid=box.getCenter(new T.Vector3());
   model.position.x-=mid.x;model.position.z-=mid.z;const restHeight=-box.min.y;rig.position.y=restHeight;
   const mixer=new T.AnimationMixer(model),actions={};for(const clip of gltf.animations){const key=clip.name.toLowerCase().includes('walk')?'walk':clip.name.toLowerCase().includes('idle')?'idle':clip.name.toLowerCase().includes('pray')?'pray':'';if(key)actions[key]=mixer.clipAction(clip);}
   for(const [label,motion]of Object.entries(entry.motions||{})){
    const animation=await getModel(motion.file),clip=animation.animations.find(c=>c.name===motion.clip);if(!clip)throw Error('Character motion unavailable');
    for(const track of clip.tracks){const target=track.name.slice(0,track.name.lastIndexOf('.'));if(!model.getObjectByName(target))throw Error('Character motion rig mismatch');}
    actions[label]=mixer.clipAction(clip);
   }
   group.add(root);root.updateMatrixWorld(true);let soleY=Infinity;for(const foot of [b.foot_l,b.foot_r].filter(Boolean)){foot.getWorldPosition(end);group.worldToLocal(end);soleY=Math.min(soleY,end.y);}if(!Number.isFinite(soleY))soleY=0;
   live={root,rig,model,b,chains,rest,restPositions,restScales,mixer,actions,restHeight,soleY};group.userData.castReady=true;
   draw(last.act,last.phase,last.time,last.blend,last.extra);box.setFromObject(model,true);end.set(0,box.min.y,0);group.worldToLocal(end);live.soleY-=end.y;draw(last.act,last.phase,last.time,last.blend,last.extra);const stage=document.querySelector('.map-stage');if(stage){stage.dataset.cast='project';window.dispatchEvent(new Event('castready'));}
 }).catch(error=>{group.userData.castReady=false;group.userData.castError=error.message;});
 return {group,pose:draw,ready,inspect:()=>live?{action:live.action?.getClip().name,mapped:Object.fromEntries(Object.entries(live.b).map(([k,b])=>[k,b?.name])),soleY:live.soleY,rigY:live.rig.position.y,restHeight:live.restHeight,bones:[...live.rest].slice(0,5).map(([b,q])=>[b.name,b.quaternion.toArray(),q.toArray()])}:null};
}

// The game tints some cloth in its Unreal material (e.g. the Nun's black habit) that the web export carries as a grey
// texture. Re-apply that tint on low-saturation texels only, so gold trim and crosses keep their colour.
function tintCloth(gltf,tint){
 if(tint.flat)tintCloth(gltf,{materials:tint.flat.materials,factor:tint.flat.factor,satLow:1,satHigh:2});
 const want=new Set(tint.materials||[]);
 for(const [object,assoc] of gltf.parser.associations){
  if(!object||!object.isMaterial||!want.has(assoc?.materials)||object.userData.erTint)continue;
  object.userData.erTint=true;const f=(tint.factor??.13).toFixed(3),s0=(tint.satLow??.12).toFixed(3),s1=(tint.satHigh??.32).toFixed(3);
  object.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n{vec3 c=diffuseColor.rgb;float mx=max(max(c.r,c.g),c.b),mn=min(min(c.r,c.g),c.b);float sat=mx>.001?(mx-mn)/mx:0.;float k=1.-smoothstep('+s0+','+s1+',sat);diffuseColor.rgb=mix(c,c*'+f+',k);}');};
  object.customProgramCacheKey=()=>'erTint'+f+s0+s1;object.needsUpdate=true;
 }
}
// The Nun's eyes ship with a pale grey eye texture; the film wants them as dark as her habit.
function recolorEyes(gltf,eyes){
 const want=new Set(eyes.materials||[]);
 for(const [object,assoc] of gltf.parser.associations){
  if(!object||!object.isMaterial||!want.has(assoc?.materials)||object.userData.erEyes)continue;
  object.userData.erEyes=true;object.map=null;object.color.set(eyes.color||'#050505');object.emissive?.set(0x000000);object.roughness=.25;object.needsUpdate=true;
 }
}
