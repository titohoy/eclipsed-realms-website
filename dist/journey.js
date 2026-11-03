import {createSound} from './scene-sound.js';
function initAtlas(){
 const $=(s,r=document)=>r.querySelector(s), all=(s,r=document)=>Array.from(r.querySelectorAll(s)), clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v)),mix=(a,b,t)=>a+(b-a)*t;
 const journey=$('.journey');if(!journey)return;const viewport=$('.map-stage'),chapters=all('.chapter'),dock=all('.chapter-index a'),motion=$('.motion-toggle'),dialog=$('.world-dialog'),mapbox=$('.free-map'),chooser=$('#where-to');
 function surface(svg){return {svg,land:$('.land',svg),pins:all('[data-pin]',svg).map(g=>({g,x:Number(g.dataset.x),y:Number(g.dataset.y),id:g.dataset.pin,major:g.hasAttribute('data-major'),label:$('.pin-label',g),len:g.dataset.name.length*6.9+8})),tableaux:all('[data-tableau]',svg)}}
 const stage=surface($('[data-map=tour]')),free=surface($('[data-map=explore]'));const reduce=matchMedia('(prefers-reduced-motion: reduce)');let still=reduce.matches,modeOverride=false,frame=0,starts=[],last=-1,trigger=null;
 const cues={
 overview:['Across the realm','Follow the stranger','Down to the earth'],
 cage:['In the cellar','The bars slide aside','A step toward the light'],
 gallows:['Into the crowd','All eyes on the platform','A moment to speak'],
 thornhallow:['At the gate','A stranger on their knees','Choose whom to stand beside'],
 veilcross:['An enemy approaches','The distance closes','Your next move'],
 cairnhold:['Under the arch','Past the city guard','Into the capital']};
 let flight=null,flightState=null,raf=0,seen=true,lastTime=0,playing=null,previousY=scrollY;
 const sound=createSound(),soundButton=$('.sound-toggle');if(!(window.AudioContext||window.webkitAudioContext))soundButton.hidden=true;
 soundButton.addEventListener('click',async()=>{try{const on=await sound.toggle();soundButton.setAttribute('aria-pressed',String(on));$('b',soundButton).textContent=on?'Sound on':'Sound off';soundButton.title=on?'Mute scene sound':'Enable scene sound';wake();}catch{soundButton.hidden=true;}});
 const cueLine=$('.cue-text'),cueFill=$('.cue-track i');
 function tick(time){raf=0;if(!seen||document.hidden||dialog.open||!flightState)return;
  const s={...flightState};if(playing&&s.active===playing.idx&&!still){
    const phase=clamp((time-playing.start)/5600,0,1);s.i=s.j=s.active;s.travel=0;s.phase=phase;
    if(phase>=1){playing.done=true;$('.journey').classList.remove('performing');}
  }
  s.magic=journey.classList.contains('use-magic');s.still=still;
  const key=chapters[s.active].dataset.anchor,c=key==='overview'&&s.active===6?['Back above the hills','All roads remain open','The rest is yours']:cues[key];
  const step=Math.min(2,Math.floor(s.phase*3));sound.scene(key,step,s.magic);journey.style.setProperty('--scene-phase',String(s.phase));cueLine.textContent=s.travel>.13&&s.travel<.86?'Across the realm':c[step];
  cueFill.style.transform='scaleX('+clamp(s.phase,.025,1)+')';
  if(flight)try{flight.paint(s,time);}catch(error){console.warn('Returning to the illustrated map:',error.message);flight=null;viewport.classList.remove('in-flight');$('.flight-surface')?.remove();queue();}
  if(!still&&(flight||playing&&!playing.done))raf=requestAnimationFrame(scheduled);
 }
 function scheduled(t){raf=0;if(t-lastTime<31){raf=requestAnimationFrame(scheduled);return;}lastTime=t;tick(t)}
 function wake(){if(!raf&&seen&&!document.hidden&&!dialog.open)raf=requestAnimationFrame(tick)}
 function playScene(section){const idx=chapters.indexOf(section);if(idx<1||idx>5||still)return;sound.reset();playing={idx,start:performance.now()};journey.classList.add('performing');wake();}
 all('[data-replay]').forEach(b=>b.addEventListener('click',()=>playScene(b.closest('.chapter'))));
 new IntersectionObserver(rows=>{seen=rows[0].isIntersecting;sound.visible(seen&&!document.hidden&&!dialog.open);if(seen)wake();},{threshold:0}).observe(viewport);
 document.addEventListener('visibilitychange',()=>{sound.visible(seen&&!document.hidden&&!dialog.open);if(!document.hidden)wake()});
 window.addEventListener('flightfallback',()=>{flight=null;queue()});
 const freeCam={x:520,y:468,z:1},maxZoom=8;let selected='',drag=null;
 function project(map,w,h,cx,cy,k,tx,ty,explore,activeAnchor){
  map.svg.setAttribute('viewBox',`0 0 ${w} ${h}`);map.land.setAttribute('transform',`translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${k.toFixed(5)}) translate(${-cx} ${-cy})`);
  const boxes=[];for(const p of [...map.pins].sort((a,b)=>Number(b.id===selected)-Number(a.id===selected)||Number(b.major)-Number(a.major))){
   const x=tx+(p.x-cx)*k,y=ty+(p.y-cy)*k;
   p.g.setAttribute('transform',`translate(${x.toFixed(2)} ${y.toFixed(2)})`);const visible=x>=-10&&x<=w+10&&y>=-10&&y<=h+10;p.g.style.display=visible?'':'none';if(!visible)continue;
   const chosen=explore&&p.id===selected;const side=x+p.len+15>w-12?-1:1,xx=side===1?x+9:x-9-p.len;const by=y-13;const b=[xx-2,by,xx+p.len+2,by+18];
   const collision=boxes.some(a=>!(b[2]<a[0]||b[0]>a[2]||b[3]<a[1]||b[1]>a[3]));const detail=explore?freeCam.z>1.45:k>2.1;const storyOccludes=!explore&&activeAnchor!=='overview'&&Math.abs(x-tx)<105&&Math.abs(y-ty)<76;
   const readable=(chosen||((p.major||detail)&&!collision&&!storyOccludes))&&xx>=3&&xx+p.len<=w-3; p.label.style.display=readable?'':'none';p.label.setAttribute('x',String(9*side));p.label.setAttribute('text-anchor',side===1?'start':'end');if(readable)boxes.push(b);p.g.toggleAttribute('data-selected',chosen);
  }
 }
 function updateStill(){journey.classList.toggle('still',still);motion.textContent=still?'Motion off':'Motion on';motion.setAttribute('aria-pressed',String(!still));all('[data-replay]').forEach(b=>b.hidden=still);motion.title=still?'Enable animated movement':'Use still scenes';}
 function measure(){const mast=$('.masthead').getBoundingClientRect().height;starts=chapters.map(e=>e.getBoundingClientRect().top+scrollY-mast);queue();if(dialog.open)renderFree()}
 function draw(){
  frame=0;const w=viewport.clientWidth,h=viewport.clientHeight,y=scrollY;let i=0;while(i+1<starts.length&&y>=starts[i+1])i++;
  let f=i===starts.length-1?0:clamp((y-starts[i])/(starts[i+1]-starts[i]),0,1);if(i===chapters.length-1)f=clamp((y-starts[i])/(chapters[i].offsetHeight||1),0,1);
  let t=clamp((f-.38)/.62,0,1);t=t*t*(3-2*t);const j=Math.min(i+1,chapters.length-1),active=t<.5?i:j;
  if(i===j)t=0;
  if(playing&&(Math.abs(previousY-y)>2||playing.idx!==active)){playing=null;journey.classList.remove('performing');}previousY=y;
  const p=still?.57:(active===i?clamp(f/.38,0,1):0);flightState={i:still?active:i,j:still?active:j,travel:still?0:t,phase:p,active};
  if(still)t=active===i?0:1;wake();
  const a=chapters[i].dataset,b=chapters[j].dataset,c=chapters[active].dataset,cx=mix(+a.cx,+b.cx,t),cy=mix(+a.cy,+b.cy,t);
  const mobile=w<=780;const base=mobile?Math.max(w/590,h*.42/580):Math.max(w*.63/640,h*.9/700);
  const across=clamp(Math.hypot(+a.cx-+b.cx,+a.cy-+b.cy)/250,0,1);const dip=+a.zoom>2&&+b.zoom>2?1+1.5*across*Math.sin(Math.PI*t)**2:1;
  const k=base*Math.exp(mix(Math.log(+a.zoom),Math.log(+b.zoom),t))/dip;
  const tx=w*(mobile?.5:.704),ty=h*(mobile?.245:.47);if(!flight)project(stage,w,h,cx,cy,k,tx,ty,false,c.anchor);else stage.svg.setAttribute('viewBox','0 0 '+w+' '+h);
  const bar=$('.map-scale b');bar.style.width=`${100/4032*1000*k}px`;
  if(active!==last){last=active;dock.forEach((a,n)=>{if(n===active)a.setAttribute('aria-current','step');else a.removeAttribute('aria-current')});$('.folio-count b').textContent=String(active).padStart(2,'0');$('.location-name').textContent=$('.sr-tour',chapters[active]).textContent;
   for(const group of stage.tableaux){const focused=group.dataset.tableau===c.anchor;group.toggleAttribute('data-live',focused);group.style.visibility=focused||c.anchor==='overview'?'visible':'hidden';$('.miniature',group).setAttribute('transform',`scale(${focused?.33:.19})`);}
  }
 }
 function queue(){if(!frame)frame=requestAnimationFrame(draw)}
 motion.addEventListener('click',()=>{modeOverride=true;still=!still;updateStill();queue()});
 reduce.addEventListener('change',()=>{if(!modeOverride){still=reduce.matches;updateStill();queue()}});
 all('[data-stance]').forEach(b=>b.addEventListener('click',()=>{const magic=b.dataset.stance==='magic';playScene(b.closest('.chapter'));journey.classList.toggle('use-magic',magic);wake();all('[data-stance]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('.stance-note').textContent=magic?'Golden light holds the enemy in place. Binding Light stops movement, but the enemy can still fight.':'Catch the swing on your shield. Now there’s an opening to strike.';}));
 const freeScale=()=>Math.min(mapbox.clientWidth/665,mapbox.clientHeight/685)*freeCam.z;
 function renderFree(){if(!dialog.open)return;const w=mapbox.clientWidth,h=mapbox.clientHeight;project(free,w,h,freeCam.x,freeCam.y,freeScale(),w/2,h/2,true,'overview')}
 function choose(id){selected=id;chooser.value=id;const p=free.pins.find(p=>p.id===id);if(p){Object.assign(freeCam,{x:p.x,y:p.y,z:2.75});$('.free-caption').textContent=p.g.dataset.name+' · travel waypoint';}else{Object.assign(freeCam,{x:526,y:465,z:1});$('.free-caption').textContent='All regional waypoints';}renderFree()}
 function zoom(factor){freeCam.z=clamp(freeCam.z*factor,.68,maxZoom);renderFree()}
 all('[data-explore]').forEach(b=>b.addEventListener('click',()=>{trigger=b;dialog.showModal();sound.visible(false);document.body.classList.add('body-dialog');choose('');$('[data-close]').focus()}));
 $('[data-close]').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{document.body.classList.remove('body-dialog');trigger?.focus({preventScroll:true});sound.visible(seen&&!document.hidden);wake();});dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()});
 chooser.addEventListener('change',()=>choose(chooser.value));all('[data-zoomctl]').forEach(b=>b.addEventListener('click',()=>b.dataset.zoomctl==='reset'?choose(''):zoom(b.dataset.zoomctl==='in'?1.4:1/1.4)));
 mapbox.addEventListener('keydown',e=>{if(e.target!==mapbox)return;const s=45/freeScale();if(e.key==='ArrowLeft')freeCam.x-=s;else if(e.key==='ArrowRight')freeCam.x+=s;else if(e.key==='ArrowUp')freeCam.y-=s;else if(e.key==='ArrowDown')freeCam.y+=s;else if(['+','='].includes(e.key))zoom(1.4);else if(e.key==='-')zoom(1/1.4);else if(e.key==='Home')choose('');else return;e.preventDefault();freeCam.x=clamp(freeCam.x,0,1000);freeCam.y=clamp(freeCam.y,0,1000);renderFree()});
 mapbox.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button'))return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,cx:freeCam.x,cy:freeCam.y,pin:e.target.closest('[data-pin]')?.dataset.pin,moved:false};mapbox.setPointerCapture(e.pointerId)});
 mapbox.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>4)drag.moved=true;if(drag.moved){freeCam.x=clamp(drag.cx-dx/freeScale(),0,1000);freeCam.y=clamp(drag.cy-dy/freeScale(),0,1000);renderFree()}});
 mapbox.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;const d=drag;drag=null;if(!d.moved&&d.pin)choose(d.pin)});mapbox.addEventListener('pointercancel',()=>drag=null);
 mapbox.addEventListener('wheel',e=>{if(!dialog.open)return;e.preventDefault();zoom(Math.exp(-clamp(e.deltaY,-120,120)*.0017))},{passive:false});
 window.addEventListener('scroll',queue,{passive:true});new ResizeObserver(measure).observe(viewport);window.addEventListener('resize',measure,{passive:true});
 document.body.classList.add('chart-ready');updateStill();measure();draw();document.fonts?.ready.then(measure);
 import('./world-flight.js').then(m=>m.createFlight(viewport,chapters)).then(f=>{flight=f;queue();wake()}).catch(err=>{viewport.classList.add('ink-edition');console.info('Illustrated scenes active:',err.message)});
}
initAtlas();
