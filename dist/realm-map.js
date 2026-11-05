// Pan/zoom viewer for the Unreal-rendered top-down map (assets/map/realm-map.json). Game coordinates are Unreal centimetres.
const $=(s,r=document)=>r.querySelector(s),clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const view=$('.map-view'),canvas=$('.map-canvas'),markers=$('.map-markers'),caption=$('.survey-caption'),select=$('.survey-select'),ctx=canvas.getContext('2d');
const pts=JSON.parse($('#waypoints').textContent);
const img=src=>new Promise((ok,no)=>{const i=new Image();i.decoding='async';i.onload=()=>ok(i);i.onerror=()=>no(Error('Missing map image'));i.src=src;});
async function main(){
 const r=await fetch('assets/map/realm-map.json');if(!r.ok)throw Error('The map could not be loaded.');const m=await r.json();
 const [W,H]=m.size||[0,0],b=m.bounds,tiles=m.tiles,base=m.preview||m.image;
 const baseImg=await img(base);const full=m.size?{W,H}:{W:baseImg.naturalWidth,H:baseImg.naturalHeight};
 const toPx=(X,Y)=>[(X-b.minX)/(b.maxX-b.minX)*full.W,(Y-b.minY)/(b.maxY-b.minY)*full.H];
 const pins=pts.map(p=>{const [x,y]=toPx(p.x,p.y),el=document.createElement('button');el.type='button';el.className='map-pin';el.innerHTML='<i></i><b></b>';el.lastChild.textContent=p.name;el.setAttribute('aria-label',p.name);el.addEventListener('click',()=>choose(p.id));markers.append(el);return {...p,px:x,py:y,el};});
 let highImg=null;if(!tiles&&m.image&&m.image!==base)img(m.image).then(i=>{highImg=i;draw()}).catch(()=>{});
 const cache=new Map();
 function tile(z,x,y){const k=z+'/'+x+'/'+y;let t=cache.get(k);if(!t){t={img:new Image(),ok:false};t.img.onload=()=>{t.ok=true;draw()};t.img.src=tiles.url.replace('{z}',z).replace('{x}',x).replace('{y}',y);cache.set(k,t);if(cache.size>260)cache.delete(cache.keys().next().value);}return t;}
 let w=0,h=0,dpr=1,cx=full.W/2,cy=full.H/2,k=1,selected='',raf=0;
 const minK=()=>Math.min(w/full.W,h/full.H),maxK=()=>Math.max(minK()*2,1.5/dpr);
 const fit=()=>{k=minK();cx=full.W/2;cy=full.H/2;};
 function size(){const nw=view.clientWidth,nh=view.clientHeight;if(!nw||!nh)return false;dpr=Math.min(devicePixelRatio||1,2);if(nw!==w||nh!==h||canvas.width!==Math.round(nw*dpr)){const first=!w;w=nw;h=nh;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);if(first)fit();}return true;}
 function limit(){k=clamp(k,minK(),maxK());const hw=w/2/k,hh=h/2/k;cx=full.W*k<=w?full.W/2:clamp(cx,hw,full.W-hw);cy=full.H*k<=h?full.H/2:clamp(cy,hh,full.H-hh);}
 const sx=px=>(px-cx)*k+w/2,sy=py=>(py-cy)*k+h/2;
 function draw(){raf=0;if(!size())return;limit();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#0d1816';ctx.fillRect(0,0,w,h);ctx.imageSmoothingQuality='high';
  ctx.drawImage(baseImg,sx(0),sy(0),full.W*k,full.H*k);
  if(tiles){const z=clamp(Math.ceil(Math.log2(k*dpr))+tiles.maxZoom,tiles.minZoom||0,tiles.maxZoom),ts=tiles.tileSize*2**(tiles.maxZoom-z),nx=Math.ceil(full.W/ts),ny=Math.ceil(full.H/ts);
   const x0=clamp(Math.floor((cx-w/2/k)/ts),0,nx-1),x1=clamp(Math.floor((cx+w/2/k)/ts),0,nx-1),y0=clamp(Math.floor((cy-h/2/k)/ts),0,ny-1),y1=clamp(Math.floor((cy+h/2/k)/ts),0,ny-1);
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const t=tile(z,x,y);if(t.ok)ctx.drawImage(t.img,sx(x*ts),sy(y*ts),Math.min(ts,full.W-x*ts)*k+.6,Math.min(ts,full.H-y*ts)*k+.6);}}
  else if(highImg&&k*dpr>baseImg.naturalWidth/full.W*1.05)ctx.drawImage(highImg,sx(0),sy(0),full.W*k,full.H*k);
  const boxes=[];for(const p of [...pins].sort((a,c)=>(c.id===selected)-(a.id===selected)||c.major-a.major)){const x=sx(p.px),y=sy(p.py),vis=x>-20&&x<w+20&&y>-20&&y<h+20;p.el.style.display=vis?'':'none';if(!vis)continue;p.el.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px)';
   const len=p.name.length*7+16,left=x+len+16>w,box=left?[x-12-len,y-12,x-10,y+12]:[x+10,y-12,x+12+len,y+12],hit=boxes.some(a=>!(box[2]<a[0]||box[0]>a[2]||box[3]<a[1]||box[1]>a[3])),show=p.id===selected||((p.major||k>minK()*2.2)&&!hit);
   p.el.classList.toggle('label',show);p.el.classList.toggle('left',left);p.el.toggleAttribute('aria-current',p.id===selected);if(show)boxes.push(box);}}
 const redraw=()=>{if(!raf)raf=requestAnimationFrame(draw)};
 function choose(id){selected=id;select.value=id;const p=pins.find(q=>q.id===id);if(p){cx=p.px;cy=p.py;k=clamp(minK()*4,minK(),maxK());caption.textContent=p.name;}else{fit();caption.textContent='The open world';}redraw();}
 function zoomAt(f,x=w/2,y=h/2){const wx=cx+(x-w/2)/k,wy=cy+(y-h/2)/k;k=clamp(k*f,minK(),maxK());cx=wx-(x-w/2)/k;cy=wy-(y-h/2)/k;redraw();}
 const pointers=new Map();let last=null;const rect=()=>view.getBoundingClientRect();
 view.addEventListener('pointerdown',e=>{if(e.button||e.target.closest('button'))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});view.setPointerCapture(e.pointerId);last=null;});
 view.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const o=pointers.get(e.pointerId),n={x:e.clientX,y:e.clientY};
  if(pointers.size===1){cx-=(n.x-o.x)/k;cy-=(n.y-o.y)/k;pointers.set(e.pointerId,n);redraw();}
  else{const other=[...pointers].find(([id])=>id!==e.pointerId)[1],d0=Math.hypot(o.x-other.x,o.y-other.y),d1=Math.hypot(n.x-other.x,n.y-other.y);pointers.set(e.pointerId,n);const r=rect();if(d0>0)zoomAt(d1/d0,(n.x+other.x)/2-r.left,(n.y+other.y)/2-r.top);cx-=((n.x+other.x)-(o.x+other.x))/2/k;cy-=((n.y+other.y)-(o.y+other.y))/2/k;redraw();}});
 for(const t of ['pointerup','pointercancel'])view.addEventListener(t,e=>pointers.delete(e.pointerId));
 view.addEventListener('wheel',e=>{e.preventDefault();const r=rect();zoomAt(Math.exp(-clamp(e.deltaY,-120,120)*.0017),e.clientX-r.left,e.clientY-r.top);},{passive:false});
 view.addEventListener('keydown',e=>{if(e.target!==view)return;const s=60/k;if(e.key==='ArrowLeft')cx-=s;else if(e.key==='ArrowRight')cx+=s;else if(e.key==='ArrowUp')cy-=s;else if(e.key==='ArrowDown')cy+=s;else if(e.key==='+'||e.key==='=')zoomAt(1.4);else if(e.key==='-')zoomAt(1/1.4);else if(e.key==='Home')return choose('');else return;e.preventDefault();redraw();});
 document.querySelectorAll('[data-map-zoom]').forEach(bt=>bt.addEventListener('click',()=>bt.dataset.mapZoom==='fit'?choose(''):zoomAt(bt.dataset.mapZoom==='in'?1.4:1/1.4)));
 select.addEventListener('change',()=>choose(select.value));new ResizeObserver(redraw).observe(view);
 size();const q=new URLSearchParams(location.search).get('place');choose(pins.some(p=>p.id===q)?q:'');
}
main().catch(e=>{caption.textContent=e.message||'The map could not open. Return to the story to use the illustrated map.';});
