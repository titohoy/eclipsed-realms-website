/* Miniature scenery for the illustrated map. Coordinates are metres (+Y up, camera on +Z).
   Illustrative scenery only; neither these tableaux nor their scale represent surveyed level geometry. */
export function makeSet(T, anchor) {
  const group=new T.Group(); group.name='Narrative set: '+anchor;
  let seed=Array.from(String(anchor)).reduce((h,c)=>Math.imul(h,31)+c.charCodeAt(0)|0,311);
  const rnd=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296};
  const pick=a=>a[Math.floor(rnd()*a.length)], between=(a,b)=>a+(b-a)*rnd(), pi=Math.PI;
  const C={cut:'#253b37',dark:'#27352f',soil:'#635845',edge:'#a18b5e',moss:'#66724d',lawn:'#778462',
    timber:'#685038',end:'#947551',beams:'#493c2b',lightwood:'#aa8b58',iron:'#464f4a',ironlight:'#87918a',
    leather:'#875a3d',slate:'#515e5b',ink:'#242e2c',mortar:'#4e5750',stone:'#899087',ivory:'#c4b391',
    gold:'#cead6b',green:'#52746a',rust:'#974c41',flame:'#ffe8a2',amber:'#ffb757'};
  const ST=['#7b8278','#898b7d','#989787','#848c82','#a4a28e','#8f9487'];
  const CELL=['#69746d','#747d73','#636f67','#849083','#7c8679'];
  const LOG=['#665039','#755d3e','#836849','#776346','#5c4a33'];
  const ROOF=['#576761','#5c706b','#67776c','#4a5d5b'];
  const greens=['#304c43','#3f6050','#4f705b','#52664b','#647957'];
  const resourceGeos=[],materials=[],geos=new Map(), batches=new Map(), moved=[];
  const stoneMat=new T.MeshStandardMaterial({roughness:.96,metalness:.035,vertexColors:true,flatShading:true,side:T.DoubleSide});
  const hotMat=new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,toneMapped:false});
  const runeMat=new T.MeshBasicMaterial({color:0xfbd88b,transparent:true,opacity:.82,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false});
  materials.push(stoneMat,hotMat,runeMat);
  function groupIn(parent=group){const o=new T.Group();parent.add(o);return o;}
  function bucket(root=group,mat=stoneMat){let cols=batches.get(root);if(!cols)batches.set(root,cols=new Map());let b=cols.get(mat);if(!b)cols.set(mat,b={p:[],n:[],c:[],idx:[]});return b;}
  const cache=(key,newOne)=>{if(!geos.has(key))geos.set(key,newOne());return geos.get(key)};
  const boxG=cache('box',()=>new T.BoxGeometry(1,1,1)),ballG=cache('ball',()=>new T.IcosahedronGeometry(1,0));
  const cylG=(a=1,b=1,n=8)=>cache('c:'+a+':'+b+':'+n,()=>new T.CylinderGeometry(a,b,1,n,1));
  const M=new T.Matrix4(),Nm=new T.Matrix3(),V=new T.Vector3(),P=new T.Vector3(),S=new T.Vector3(),Q=new T.Quaternion(),E=new T.Euler(),up=new T.Vector3(0,1,0),col=new T.Color();
  function emit(g,hex,x,y,z,sx=1,sy=1,sz=1,rot=[0,0,0],root=group,mat=stoneMat){
    const b=bucket(root,mat),off=b.p.length/3;
    if(Array.isArray(rot))Q.setFromEuler(E.set(rot[0],rot[1],rot[2]));else Q.copy(rot);
    M.compose(P.set(x,y,z),Q,S.set(sx,sy,sz)); Nm.getNormalMatrix(M);col.set(hex);
    const p=g.getAttribute('position'),n=g.getAttribute('normal');
    for(let i=0;i<p.count;i++) {V.fromBufferAttribute(p,i).applyMatrix4(M);b.p.push(V.x,V.y,V.z);V.fromBufferAttribute(n,i).applyMatrix3(Nm).normalize();b.n.push(V.x,V.y,V.z);b.c.push(col.r,col.g,col.b);}
    if(g.index){const ind=g.index.array;for(let i=0;i<ind.length;i++)b.idx.push(off+ind[i]);}else for(let i=0;i<p.count;i++)b.idx.push(off+i);
  }
  const box=(x,y,z,w,h,d,c,rot=[0,0,0],root=group,mat=stoneMat)=>emit(boxG,c,x,y,z,w,h,d,rot,root,mat);
  const cyl=(x,y,z,rt,rb,h,c,n=8,rot=[0,0,0],root=group,mat=stoneMat)=>{const rad=Math.max(rt,rb,1e-6);emit(cylG(rt/rad,rb/rad,n),c,x,y,z,rad,h,rad,rot,root,mat)};
  const ell=(x,y,z,w,h,d,c,rot=[0,0,0],root=group,mat=stoneMat)=>emit(ballG,c,x,y,z,w,h,d,rot,root,mat);
  function pole(a,b,r,c,n=6,root=group,mat=stoneMat){const d=new T.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]);const len=d.length();if(len<1e-5)return;const q=new T.Quaternion().setFromUnitVectors(up,d.divideScalar(len));emit(cylG(1,1,n),c,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,r,len,r,q,root,mat);}
  function face(a,b,c,hex,root=group,mat=stoneMat){const dst=bucket(root,mat),off=dst.p.length/3;const ab=new T.Vector3().fromArray(b).sub(new T.Vector3().fromArray(a)),ac=new T.Vector3().fromArray(c).sub(new T.Vector3().fromArray(a));ab.cross(ac).normalize();col.set(hex);for(const p of [a,b,c]){dst.p.push(...p);dst.n.push(ab.x,ab.y,ab.z);dst.c.push(col.r,col.g,col.b)}dst.idx.push(off,off+1,off+2)}
  function quad(a,b,c,d,hex,root=group,mat=stoneMat){face(a,b,d,hex,root,mat);face(b,c,d,hex,root,mat)}
  function wedge(x,y,z,inner,outer,from,to,depth,shade){const coords=(r,t,k)=>[x+r*Math.cos(t),y+r*Math.sin(t),z+k];const a=coords(inner,from,depth/2),b=coords(outer,from,depth/2),c=coords(outer,to,depth/2),d=coords(inner,to,depth/2),A=coords(inner,from,-depth/2),B=coords(outer,from,-depth/2),D=coords(inner,to,-depth/2),F=coords(outer,to,-depth/2);quad(a,b,c,d,shade);quad(A,D,F,B,shade);quad(b,B,F,c,shade);quad(a,d,D,A,shade);quad(a,A,B,b,shade);quad(d,c,F,D,shade);}
  function arch(x,y,z,r,t,depth,colors=ST,count=13){for(let i=0;i<count;i++)wedge(x,y,z,r,r+t,pi*i/count+.006,pi*(i+1)/count-.006,depth,pick(colors));}
  function post(x,z,h,r,mats=ST,base=0){const layers=Math.ceil(h/.38),dy=h/layers;for(let i=0;i<layers;i++)box(x,base+(i+.5)*dy,z,2*r*between(.98,1.04),dy-.018,2*r*between(.98,1.04),pick(mats));box(x,base+.1,z,2*r+.16,.18,2*r+.16,pick(mats));box(x,base+h-.08,z,2*r+.17,.16,2*r+.17,pick(mats));}
  function wall(x,z,width,height,thick,colors=ST,theta=0,foot=0){
    const layers=Math.ceil(height/.36),dy=height/layers;box(x,foot+height/2,z,width-.04,height-.03,thick-.08,C.mortar,[0,theta,0]);
    for(let j=0;j<layers;j++){let u=-width/2;while(u<width/2-.035){let w=Math.min(between(.66,1.14),width/2-u);if(width/2-u-w<.24)w=width/2-u;const local=u+w/2;box(x+local*Math.cos(theta),foot+(j+.5)*dy,z-local*Math.sin(theta),w-.024,dy-.022,thick+between(-.018,.028),pick(colors),[0,theta,0]);u+=w;}}
  }
  function base(radius,forest=false){
    cyl(0,-.34,-.55,radius,radius*.95,.53,C.cut,22);cyl(0,-.085,-.55,radius*1.005,radius,.10,C.edge,22);cyl(0,-.035,-.55,radius,radius*.995,.07,forest?'#5b6549':'#665f4b',22);
    // Mottled patches and pebbles use irregular flat facets rather than textures.
    for(let i=0;i<(forest?175:68);i++){let a=rnd()*2*pi,r=Math.sqrt(rnd())*(radius-.3),x=Math.cos(a)*r,z=Math.sin(a)*r-.55;ell(x,.008,z,between(.10,.41),between(.012,.037),between(.10,.36),forest?pick(['#637150','#515e44','#79805b','#6a7552','#7e7f59']):pick(['#756c55','#5d5949','#77725f','#77775c']),[0,a,0]);}
  }
  function pavers(x1,x2,z1,z2,dz=.56,colors=ST){for(let z=z1;z<z2;z+=dz){let x=x1;while(x<x2-.08){let w=Math.min(between(.48,.93),x2-x);box(x+.5*w,between(-.015,.005),z+dz/2,w-.026,between(.07,.1),dz-.032,pick(colors),[0,between(-.025,.025),0]);x+=w;}}}
  function torch(x,y,z){pole([x,y-.6,z-.09],[x,y+.06,z+.14],.045,C.beams);cyl(x,y,z+.12,.075,.048,.18,C.ironlight);ell(x,y+.16,z+.12,.071,.18,.066,C.amber,[0,0,.12],group,hotMat);ell(x-.008,y+.11,z+.14,.035,.105,.04,C.flame,[0,0,-.11],group,hotMat);}
  function candles(x,y,z,n=3){for(let i=0;i<n;i++){const xx=x+between(-.13,.13),zz=z+between(-.09,.09),h=between(.11,.29);cyl(xx,y+h/2,zz,.042,.049,h,'#d1bc86');ell(xx,y+h+.04,zz,.024,.069,.022,'#ffdc91',[0,0,.12],group,hotMat);}}
  function lantern(x,y,z,small=false){const s=small?.65:1;box(x,y+1.75*s,z,.11,.85*s,.11,C.beams);const h=.31*s,r=.13*s;cyl(x,y+.16*s,z,r,r,h,'#ffc87e',6,[0,0,0],group,hotMat);cyl(x,y+.36*s,z,.045*s,.19*s,.16*s,C.iron);cyl(x,y-.028*s,z,.16*s,.1*s,.09*s,C.iron);pole([x,y+.41*s,z],[x,y+1.84*s,z],.016*s,C.ink,5);for(let a=0;a<6;a++){let xx=x+r*Math.cos(a*pi/3),zz=z+r*Math.sin(a*pi/3);pole([xx,y,zz],[xx,y+h,zz],.014*s,C.iron,4)}}
  function barrel(x,z,r=.28){const h=r*2.65;cyl(x,.5*h,z,r*.85,r,h,pick(LOG),10);for(const t of [.15,.79])cyl(x,t*h,z,r*(1.025-.14*t),r*(1.025-.14*t),.061,C.iron,10);cyl(x,h,z,r*.83,r*.83,.025,C.end,10);}
  function crate(x,z,w=.55){box(x,w*.48,z,w,w*.96,w*.84,'#8d704c');for(const s of [-1,1])box(x+s*w*.41,w*.48,z+w*.43,.065,w,.048,C.beams);box(x,w*.48,z+w*.43,.059,w*1.18,.05,C.beams,[0,0,-.75]);}
  function house(x,z,w,d,h,roof,wallcol,offset=0){let o=groupIn();o.position.set(x,0,z);o.rotation.y=offset;box(0,h*.5,0,w,h,d,wallcol,[0,0,0],o);
    const rise=w*.49;const p1=[-w*.55,h-.03,d*.56],p2=[w*.55,h-.03,d*.56],p3=[0,h+rise,d*.56],q1=[-w*.55,h-.03,-d*.56],q2=[w*.55,h-.03,-d*.56],q3=[0,h+rise,-d*.56];face(p1,p2,p3,wallcol,o);face(q2,q1,q3,wallcol,o);quad(p1,p3,q3,q1,roof,o);quad(p3,p2,q2,q3,roof,o);
    pole(p3,q3,.065,C.beams,5,o);for(const pt of [p1,p2])pole(pt,p3,.054,C.beams,5,o);const f=d*.503;for(const v of [-.46,0,.46])box(v*w,h*.48,f,.09,h,.09,C.beams,[0,0,0],o);box(0,h*.64,f,w,.09,.09,C.beams,[0,0,0],o);
    for(const v of [-.26,.26]){box(v*w,h*.71,f+.018,w*.19,h*.23,.06,'#d6b978',[0,0,0],o);box(v*w,h*.71,f+.055,.038,h*.24,.02,C.beams,[0,0,0],o);}
    box(0,h*.21,f+.014,w*.17,h*.42,.04,C.beams,[0,0,0],o);box(-w*.28,h+rise*.41,-d*.23,.23,.8,.23,pick(ST),[0,0,0],o);}
  function pine(x,z,h,r){const twist=between(0,pi);pole([x,0,z],[x,h*.88,z],h*.045,pick(LOG),7);for(let i=0;i<4;i++)cyl(x,h*(.38+.16*i),z,0,r*(1-i*.185),h*(.51-i*.061),greens[Math.min(4,i+Math.floor(rnd()*2))],7,[0,twist+i*.48,0]);}
  function rock(x,z,s){ell(x,s*.16,z,s*.78,s*.41,s*.64,pick(['#727d70','#829084','#616f61','#899080']),[between(-.2,.2),rnd()*pi,between(-.1,.1)]);}
  function blades(x,z,s=.5){const c=pick(['#7d8a5c','#71845d','#8a8c60']);for(let i=0;i<4;i++){const a=rnd()*2*pi,r=s*between(.2,.6),h=s*between(.42,1);face([x+.045,0,z],[x-.045,0,z],[x+Math.cos(a)*r,h,z+Math.sin(a)*r],c);}}
  function pennant(x,y,z,w,h,cloth=C.rust){const o=groupIn();o.position.set(x,y,z);box(0,.015,0,w+.17,.05,.05,C.gold,[0,0,0],o);quad([-w/2,0,0],[w/2,0,0],[w/2,-h*.77,.045],[-w/2,-h*.77,.045],cloth,o);face([-w/2,-h*.76,.045],[w/2,-h*.76,.045],[0,-h,.065],cloth,o);for(let k of [-.41,.41])box(k*w,-h*.37,.035,.017,h*.72,.014,C.gold,[0,0,0],o);const d=w*.18;quad([0,-h*.20,.046],[d,-h*.38,.046],[0,-h*.56,.056],[-d,-h*.38,.052],C.gold,o);moved.push({type:'flag',obj:o,base:rnd()*5});return o;}
  function stageCage(){base(5.05);pavers(-3.85,3.35,-3.80,1.9,.56,['#778071','#707b72','#889083','#68766b']);wall(0,-3.67,6.95,2.92,.45,CELL);wall(-3.6,-2.2,3.35,2.60,.42,CELL,pi/2);wall(3.55,-2.55,2.38,1.59,.44,CELL,pi/2);
    for(let j=0;j<2;j++){const z=-3.1+j*1.65;post(-3.08,z,1.43,.24,CELL);post(3.08,z,1.43,.24,CELL);arch(0,1.4,z,2.84,.46,.38,CELL,19);}
    // A door within the doorway. Its ironwork and latch rotate around the left post.
    const gx=-1.50,gz=-.93;post(gx-.93,gz,1.77,.19,CELL);post(gx+.93,gz,1.77,.19,CELL);arch(gx,1.74,gz,.76,.34,.44,CELL,9);
    const door=groupIn();door.position.set(gx-.76,.07,gz+.04);moved.push({type:'cage',obj:door});const w=1.52;
    for(let i=0;i<8;i++){const xx=w*(i+.3)/7.6,top=1.67+Math.sqrt(Math.max(0,.74*.74-(xx-w/2)**2));pole([xx,0,0],[xx,top,0],.038,'#58645e',7,door);}
    for(const yy of [.12,.72,1.54])box(w/2,yy,0,w,.075,.077,C.ironlight,[0,0,0],door);box(w-.065,.9,.044,.12,.26,.065,'#a08e67',[0,0,0],door);
    for(let i=0;i<4;i++)box(gx,.09+i*.10,-1.64-i*.35,1.38,.18+i*.2,.38,pick(CELL));
    torch(-2.85,1.65,-2.90);torch(2.06,1.65,-3.35);candles(.93,.06,-.81,4);barrel(2.63,-2.57,.34);crate(2.03,-2.63,.49);
    for(let i=0;i<16;i++)rock(between(-3.2,3.22),between(-3.3,-2.60),between(.13,.35));
    for(let i=0;i<7;i++){const f=i/6;pole([2.89+f*.48,1.8+f*.61,-2.50],[3.32,2.7,-3.17+f*.54],.007,'#9b9b81',3);}
  }
  function stageGallows(){base(6.3);pavers(-3.85,3.85,-3.7,2.35,.56,['#8b8268','#9b8f71','#797863','#92866b','#a1987e']);
    house(-3.72,-3.78,1.96,1.65,2.40,pick(ROOF),'#b5a180',.16);house(-1.55,-5.08,1.78,1.68,2.77,pick(ROOF),'#ac9471',-.06);house(2.39,-4.01,1.77,1.59,1.94,'#795f4d','#b5a587',-.17);house(4.0,-2.52,1.49,1.74,2.24,pick(ROOF),'#ac9f7d',-.35);
    const gz=-2.18;for(const x of [-1.53,1.53])for(const z of [gz-.70,gz+.70])box(x,.43,z,.2,.86,.2,C.beams);box(0,.60,gz,3.47,.22,1.67,C.beams);
    for(let i=0;i<17;i++)box(-1.7+.211*i,.77,gz,.202,.15,1.85,pick(LOG));
    for(const x of [-1.46,1.46]){box(x,1.95,gz,.22,2.37,.25,C.beams);pole([x,2.27,gz],[x-Math.sign(x)*.67,2.94,gz],.10,C.timber,4);}
    box(0,3.08,gz,3.48,.22,.30,C.end);for(const x of [-.59,.59]){pole([x,2.97,gz],[x,2.33,gz],.018,'#be9d6d',5);const pts=[];for(let i=0;i<=14;i++){const a=2*pi*i/14;pts.push([x+.106*Math.sin(a),2.17+.16*Math.cos(a),gz-.03*Math.sin(a)]);}for(let i=1;i<pts.length;i++)pole(pts[i-1],pts[i],.015,'#bb9769',4);}
    for(let j=0;j<4;j++)box(1.2,.10+j*.105,gz+1.69-j*.22,.72,.20+j*.21,.28,pick(LOG));barrel(-3.15,-1.72,.29);crate(-3.8,-1.64,.44);
    pole([-4.2,3.27,-2.7],[-1.64,3.02,-4.28],.012,C.beams);for(let j=0;j<7;j++){let t=j/7;const xx=-4.2+t*2.56,yy=3.24-.25*t,zz=-2.7-1.58*t;face([xx,yy,zz],[xx+.21,yy-.02,zz-.12],[xx+.10,yy-.24,zz-.03],j%2?C.green:C.rust);}
  }
  function stageRefuge(){base(6.4,true);for(let i=0;i<36;i++){const s=i<18?-1:1,k=i%18,x=s*(1.55+k*.21),z=-3.23+k*.06,h=between(1.82,2.58);cyl(x,h/2,z,.13,.14,h,pick(LOG),6);cyl(x,h+.15,z,0,.14,.31,C.end,6);}
    for(const side of [-1,1])for(const y of [.53,1.45])pole([side*1.50,y,-3.03],[side*5.02,y,-2.1],.081,C.beams,5);
    for(const s of [-1,1]){box(s*1.41,1.46,-3.17,.32,2.92,.40,C.beams);const gate=groupIn();gate.position.set(s*1.39,.06,-3.15);gate.rotation.y=s*1.09;for(let k=0;k<6;k++)box(-s*(k+.5)*.21,1.03,0,.20,1.94+.06*Math.cos(k),.13,pick(LOG),[0,0,0],gate);for(let k of [.48,1.48])box(-s*.65,k,.08,1.28,.10,.08,C.beams,[0,0,0],gate);}
    pole([-1.63,2.90,-3.17],[1.63,2.90,-3.17],.17,C.end,5);pennant(.79,2.75,-2.91,.36,.76,C.green);lantern(-1.36,1.32,-2.79,true);
    house(-2.9,-4.2,1.94,1.61,2.10,'#68725c','#958464',.18);house(1.23,-4.94,1.68,1.48,1.91,'#63735d','#a1906e',-.21);
    for(const [x,z,h] of [[-4.1,-3,4.47],[-3.25,-4.55,4.74],[-1.9,-5.28,4.49],[3.18,-4.46,4.51],[4.31,-2.61,4.79],[4.31,-1.23,3.39],[-4.47,.07,2.66]])pine(x,z,h,h*.21);
    for(let i=0;i<65;i++){const x=(rnd()<.5?-1:1)*between(2.25,5.23),z=between(-3.8,2.2);if(x*x+(z+.55)**2<35)blades(x,z,between(.20,.52));}
    for(let i=0;i<23;i++){const x=(rnd()<.5?-1:1)*between(2.23,4.9),z=between(-2.32,1.6);rock(x,z,between(.19,.46));}crate(2.17,-2.63,.5);barrel(-2.45,-2.30,.28);
  }
  function stageClearing(){base(6.26,true);for(const [x,z,h] of [[-4.28,-2.74,4.33],[-3.44,-4.15,5.30],[-2.60,-4.77,4.12],[-1.18,-5.21,4.94],[.24,-5.50,5.42],[2.15,-4.63,4.43],[3.40,-3.88,5.29],[4.47,-2.40,4.57],[-4.35,.65,2.89],[4.93,-.34,3.41]])pine(x,z,h,h*between(.185,.24));
    for(let i=0;i<65;i++){let x=between(-5.22,5.22),z=between(-4.05,2.68);if(Math.abs(x)<2.0&&z> -2.5||x*x+(z+.55)**2>34)continue;blades(x,z,between(.27,.68));if(i%3===0)rock(x,z,between(.25,.64));}
    pole([-3.45,.23,-1.98],[-2.1,.25,-3.24],.22,pick(LOG),9);pole([-3.10,.30,-2.29],[-3.49,.74,-2.21],.061,C.end);for(let i=0;i<11;i++)ell(-1.0+Math.sin(i*.48)*.4,-.018,2.0-i*.53,between(.39,.54),.052,between(.19,.32),pick(['#868775','#768174','#8a8b75']),[0,rnd()*pi,0]);
    const x=.37,z=-1.33;box(x,.10,z,.86,.16,.48,'#484a3a');box(x,.52,z,.78,.76,.11,'#70674b',[.11,0,0]);box(x,.53,z+.060,.66,.66,.045,'#a29970',[.11,0,0]);
    const ins=(a,b,c,d)=>pole([x+a,b,z+.105],[x+c,d,z+.105],.019,'#526255',5);
    ins(-.23,.28,-.23,.74);ins(.23,.28,.23,.74);ins(-.24,.74,.24,.74);ins(0,.26,-.16,.48);ins(-.16,.48,0,.68);ins(0,.68,.16,.48);ins(.16,.48,0,.26);
    const ringRoot=groupIn();ringRoot.position.set(x,.065,z+.49);moved.push({type:'magic',obj:ringRoot});
    for(let k=0;k<42;k++){const a=2*pi*k/42,bb=2*pi*(k+.79)/42,r=1.05;pole([Math.cos(a)*r,0,Math.sin(a)*r],[Math.cos(bb)*r,0,Math.sin(bb)*r],.012,'#ffffff',4,ringRoot,runeMat);}
    for(let k=0;k<9;k++){const a=k*2*pi/9,r=.93;pole([r*Math.cos(a),.03,r*Math.sin(a)],[1.03*Math.cos(a),.23+(k%3)*.05,1.03*Math.sin(a)],.012,'#ffffff',4,ringRoot,runeMat);}
    const sparks=groupIn();sparks.position.set(x,.15,z+.49);moved.push({type:'spark',obj:sparks});for(let k=0;k<15;k++){const a=2*pi*k/15,r=between(.38,.96);ell(Math.cos(a)*r,between(.12,1.2),Math.sin(a)*r,.022,.073,.022,'#ffffff',[0,0,between(-.32,.32)],sparks,runeMat);}
  }
  function tower(x,z,r,h){const n=11,dy=.38;cyl(x,h/2,z,r*.97,r*.97,h,C.mortar,n);for(let j=0;j<Math.ceil(h/dy);j++){const y=(j+.5)*dy;for(let k=0;k<n;k++){const a=(k+(j%2)*.5)*2*pi/n;box(x+r*.92*Math.sin(a),y,z+r*.92*Math.cos(a),r*.57,dy-.019,.16,pick(ST),[0,a,0]);}}
    for(const y of [.28,h*.58,h-.25])cyl(x,y,z,r*1.09,r*1.06,.14,'#a6a58e',n);for(let k=0;k<n;k+=2){const a=k*2*pi/n;box(x+r*.91*Math.sin(a),h+.16,z+r*.91*Math.cos(a),r*.42,.39,.30,pick(ST),[0,a,0]);}for(const yy of [h*.48,h*.78]){box(x,yy,z+r+.06,.10,.40,.04,C.ink);box(x,yy+.03,z+r+.08,.25,.06,.032,C.ink);}}
  function stageCity(){base(6.55);pavers(-3.75,3.75,-4.65,2.76,.57,['#8d9488','#969a8b','#778376','#a0a491','#7e8b7f']);const gz=-2.97;
    tower(-2.78,gz,1.08,3.64);tower(2.78,gz,1.08,3.64);for(const s of [-1,1]){wall(s*1.74,gz,.82,2.4,.94,ST);wall(s*4.48,gz,1.63,2.60,.72,ST);for(let j=0;j<3;j++)box(s*(3.92+j*.52),2.79,gz,.31,.38,.74,pick(ST));}
    arch(0,1.39,gz,1.33,.47,1.05,ST,15);arch(0,1.39,gz+.47,1.31,.27,.18,['#b1ae94','#a4a58f','#c2baa0'],13);post(-1.46,gz+.43,1.42,.16);post(1.46,gz+.43,1.42,.16);
    // Inner city rooftops are visible through the gate. A pair of banners frames the approach.
    house(-.71,-5.36,1.46,1.47,1.83,'#4d6262','#b7aa8a',.16);house(1.31,-5.13,1.46,1.63,2.12,'#5a6869','#b4a588',-.21);cyl(.21,2.94,-5.69,.30,.36,2.2,pick(ST),7);cyl(.21,4.41,-5.69,0,.55,1.09,'#475a5a',7);pole([.21,4.83,-5.69],[.21,5.13,-5.69],.022,C.gold);
    for(const s of [-1,1]){pennant(s*2.78,3.24,gz+1.15,.58,1.33,'#91483d');torch(s*1.77,1.79,gz+.63);}box(0,2.99,gz+.57,.39,.34,.08,'#b8a16d',[0,0,pi*.25]);
    for(let j=0;j<2;j++){barrel(-4.53+j*.55,-1.62,.26);crate(4.1+j*.37,-1.37-j*.61,.46);}
  }
  const stages={cage:stageCage,gallows:stageGallows,thornhallow:stageRefuge,veilcross:stageClearing,cairnhold:stageCity};(stages[anchor]||stageClearing)();
  // Concatenate all stationary pieces, including house transforms, into a single material pass.
  // Folding fixed child groups occurs before geometry creation, so there is no per-frame merge.
  const dynamicRoots=new Set(moved.map(m=>m.obj));group.updateMatrixWorld(true);
  for(const [node,cols] of [...batches]){if(node===group||dynamicRoots.has(node))continue;const pos=new T.Vector3(),nor=new T.Matrix3().getNormalMatrix(node.matrixWorld);
    for(const [mat,b] of cols){const to=bucket(group,mat),off=to.p.length/3;for(let i=0;i<b.p.length;i+=3){pos.fromArray(b.p,i).applyMatrix4(node.matrixWorld);to.p.push(pos.x,pos.y,pos.z);pos.fromArray(b.n,i).applyMatrix3(nor).normalize();to.n.push(pos.x,pos.y,pos.z);to.c.push(b.c[i],b.c[i+1],b.c[i+2]);}for(const ix of b.idx)to.idx.push(off+ix);}batches.delete(node);node.removeFromParent();}
  for(const [root,cols] of batches)for(const [mat,bb] of cols){if(!bb.idx.length)continue;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(bb.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(bb.n,3));g.setAttribute('color',new T.Float32BufferAttribute(bb.c,3));g.setIndex(bb.idx);g.computeBoundingSphere();const mesh=new T.Mesh(g,mat);mesh.castShadow=mesh.receiveShadow=mat===stoneMat;root.add(mesh);resourceGeos.push(g);}
  for(const primitive of geos.values())primitive.dispose();batches.clear();geos.clear();
  function animate(phase=0,time=0,magic=false){
    const p=Math.max(0,Math.min(1,Number.isFinite(+phase)?+phase:0)),t=Number.isFinite(+time)?+time:0;let q=Math.max(0,Math.min(1,(p-.23)/.53));q=q*q*(3-2*q);
    const key=typeof magic==='string'?magic.toLowerCase():magic===true?'holy':'',spell=Boolean(key)&&!['none','melee','shield','parry','steel','sword'].includes(key),pulse=.5+.5*Math.sin(t*2.1+.4);
    hotMat.color.setScalar(.94+.055*Math.sin(t*7.1)+.025*Math.sin(t*11.2));runeMat.color.set(key.includes('blood')?'#e76d55':key.includes('dark')?'#998bd7':'#f8d68a');runeMat.opacity=spell?.53+pulse*.4:.16+p*.12;
    for(const m of moved){const o=m.obj;if(m.type==='cage')o.rotation.y=q*1.42;else if(m.type==='flag'){o.rotation.x=Math.sin(t*1.45+m.base)*.037;o.rotation.z=Math.sin(t*.9+m.base)*.012;}else if(m.type==='magic'){const k=spell?.91+pulse*.12:.72;o.scale.set(k,1,k);o.rotation.y=spell?t*.15:0;}else if(m.type==='spark'){o.visible=spell;o.rotation.y=t*.22;o.position.y=.12+pulse*.19;}}
  }
  animate(0,0,false);
  function dispose(){for(const g of resourceGeos)g.dispose();for(const m of materials)m.dispose();group.clear();}
  return {group,animate,dispose};
}

