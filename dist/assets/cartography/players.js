/* Hand-modelled cloth, wood, leather and metal miniatures for the introductory scenes.
 * Coordinates are in metres; +Y is up and +Z is the actor's forward direction.
 * The application owns group.position and group.rotation. pose() only touches the rig.
 */
const libraries = new WeakMap();
const PI = Math.PI, TAU = 2 * PI;
function library(T) {
  if (libraries.has(T)) return libraries.get(T);
  const geometries=new Map();
  const get=(key,f)=>{if(!geometries.has(key)) geometries.set(key,f()); return geometries.get(key);};
  const result={get,box:get('box',()=>new T.BoxGeometry(1,1,1)),
    bead:get('bead',()=>new T.IcosahedronGeometry(1,1)),
    round:get('round',()=>new T.SphereGeometry(1,12,9)),
    mats:{
      paint:new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.88,metalness:.03,side:T.DoubleSide}),
      metal:new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.45,metalness:.48,side:T.DoubleSide}),
      light:new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,toneMapped:false})
    }};
  libraries.set(T,result); return result;
}
function shaped(T,lib,rings,n=12,pleat=0) {
  const key='shape'+JSON.stringify([rings,n,pleat]); return lib.get(key,()=>{
    const pos=[],idx=[]; rings.forEach(([y,x,z,dz=0,dx=0],j)=>{
      for(let i=0;i<n;i++){const a=(i+.5)*TAU/n, f=1+pleat*(i%2?1:-1);pos.push(dx+x*Math.sin(a)*f,y,dz+z*Math.cos(a)*f);}
      if(j) for(let i=0;i<n;i++){let a=(j-1)*n+i,b=(j-1)*n+(i+1)%n;idx.push(a,b,b+n,a,b+n,a+n);}
    });
    for(let i=1;i<n-1;i++){idx.push(0,i+1,i);let k=(rings.length-1)*n;idx.push(k,k+i,k+i+1);}
    let g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
  });
}
export function makeActor(THREE,role='traveler',seed=0) {
  const T=THREE,lib=library(T);
  if(!['traveler','doll','guard','villager','fighter','mage','companion'].includes(role))role='traveler';
  const group=new T.Group();group.name='Realm · '+role;group.userData.role=role;
  const joint=(p,name,x=0,y=0,z=0)=>{let g=new T.Group();g.name=name;g.position.set(x,y,z);p.add(g);return g;};
  const frame=joint(group,'puppet'),pelvis=joint(frame,'hips'),chest=joint(pelvis,'chest'),head=joint(chest,'head',0,.528,.006);
  let h=2166136261;for(const c of String(seed))h=Math.imul(h^c.charCodeAt(0),16777619);
  const pick=(a)=>a[(h>>>0)%a.length];
  const D=role==='doll',G=role==='guard',F=role==='fighter',M=role==='mage',V=role==='villager',C=role==='companion',R=role==='traveler';
  const skin=D?'#e8d7ba':pick(['#c69671','#b78459','#be9876','#a97854','#d0a585']), blush=D?'#bc947d':'#966e53';
  const ink='#27342d',leather='#534434',black='#302e27',belt='#756044',brass='#d0ad6b',gold='#e7c984',steel='#98a9a1',steelD='#63766e',wood='#876a47',cream='#d8c9a4';
  const coat=D?'#647875':G?'#495e54':F?'#935d43':M?'#526961':V?pick(['#87644b','#75694b','#786251']):C?'#72816a':'#425c51';
  const shade=D?'#435c5a':G?'#344c42':F?'#684634':M?'#394f47':V?'#745641':C?'#51674f':'#30473e';
  const lining=D?'#c9b996':G?'#b29562':F?'#c19063':M?'#d0b47b':'#a7ab88';
  const hair=D?'#40372e':M?'#c6c4ae':pick(['#503b2b','#60503a','#554332','#554a3b']);
  const batches=new Map(),colorCache=new Map();
  const vec=(v)=>new T.Vector3(...v);
  // Batch every rigid bone into at most one draw per surface type; details are vertex colours.
  function stamp(bone,g,col,xyz=[0,0,0],s=[1,1,1],rot=[0,0,0],kind='paint',quat=null) {
    if(!batches.has(bone))batches.set(bone,new Map());let slots=batches.get(bone);
    if(!slots.has(kind))slots.set(kind,{p:[],n:[],c:[],i:[]});let b=slots.get(kind);
    let m=new T.Matrix4().compose(vec(xyz),quat||new T.Quaternion().setFromEuler(new T.Euler(...rot)),vec(s));
    let nm=new T.Matrix3().getNormalMatrix(m),p=g.getAttribute('position'),n=g.getAttribute('normal'),offset=b.p.length/3,v=new T.Vector3();
    if(!colorCache.has(col))colorCache.set(col,new T.Color(col));let pigment=colorCache.get(col);
    for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m);b.p.push(v.x,v.y,v.z);v.fromBufferAttribute(n,i).applyMatrix3(nm).normalize();b.n.push(v.x,v.y,v.z);b.c.push(pigment.r,pigment.g,pigment.b);}
    if(g.index){for(let i=0;i<g.index.count;i++)b.i.push(offset+g.index.getX(i));}else for(let i=0;i<p.count;i++)b.i.push(offset+i);
  }
  const box=(b,xyz,s,col,rot=[0,0,0],kind='paint')=>stamp(b,lib.box,col,xyz,s,rot,kind);
  const bead=(b,xyz,s,col,rot=[0,0,0],kind='paint',smooth=false)=>stamp(b,smooth?lib.round:lib.bead,col,xyz,s,rot,kind);
  const shape=(b,rings,col,n=12,pleat=0,off=[0,0,0],kind='paint')=>stamp(b,shaped(T,lib,rings,n,pleat),col,off,[1,1,1],[0,0,0],kind);
  function rod(b,a,z,r1,r2,col,kind='paint',n=7){
    let v=vec(z).sub(vec(a));if(v.lengthSq()<1e-10)return;
    let key='rod'+[r1,r2,n].join(','),g=lib.get(key,()=>new T.CylinderGeometry(r2,r1,1,n)),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.clone().normalize());
    stamp(b,g,col,[(a[0]+z[0])/2,(a[1]+z[1])/2,(a[2]+z[2])/2],[1,v.length(),1],[0,0,0],kind,q);
  }
  function panel(b,points,tri,col,kind='paint') {
    const key='panel'+JSON.stringify([points,tri]);let g=lib.get(key,()=>{let mesh=new T.BufferGeometry();mesh.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));mesh.setIndex(tri);mesh.computeVertexNormals();return mesh;});stamp(b,g,col,[0,0,0],[1,1,1],[0,0,0],kind);
  }
  // Leg rigs. The two-bone sagittal solver below keeps the planted boot sole at y=0.
  const l1=.394,l2=.385,ank=.090,legs=[],arms=[];
  for(const side of [-1,1]){
    let thigh=joint(pelvis,'thigh '+side,.101*side,0,0),shin=joint(thigh,'knee '+side,0,-l1,0),foot=joint(shin,'boot '+side,0,-l2,0);
    const pants=D?'#cfc2a2':G||F?'#566258':'#655b48';
    shape(thigh,[[-l1,.056,.06,.012],[-.24,.075,.079],[-.12,.086,.087],[.012,.072,.07]],pants,9);
    shape(shin,[[-l2+.005,.047,.048],[-.27,.056,.063,-.01],[-.14,.065,.069,-.013],[-.025,.062,.062],[.01,.047,.05]],pants,9);
    shape(shin,[[-l2,.054,.058],[-.24,.062,.07,-.009],[-.17,.069,.073,-.01],[-.15,.071,.071,-.01]],D?'#8a755e':leather,9);
    shape(shin,[[-.183,.073,.075,-.01],[-.15,.073,.075,-.01]],D?'#b89677':belt,9);
    shape(foot,[[-ank,.065,.132,.048],[-ank+.022,.067,.135,.049],[-.033,.064,.115,.046],[-.003,.055,.077,.023],[.033,.051,.054]],D?'#5b493b':leather,10);
    shape(foot,[[-ank,.066,.133,.049],[-ank+.012,.066,.134,.049]],black,10);
    if(G||F){bead(shin,[0,-.017,.046],[.072,.084,.035],steelD,[0,0,0],'metal');bead(shin,[0,-.02,.061],[.058,.072,.028],steel,[0,0,0],'metal');}
    else if(D){for(let i=0;i<2;i++)shape(shin,[[-.112+i*.045,.064,.070,-.011],[-.103+i*.045,.064,.070,-.011]],'#a88058',9);}
    legs.push({side,thigh,shin,foot});
  }
  shape(pelvis,[[-.18,.174,.113],[-.055,.166,.115],[.075,.148,.112]],shade,12,.025);
  const skirt=D?-.335:M?-.51:V?-.31:-.14;
  shape(chest,[[skirt,D?.227:M?.203:.201,D?.158:.148,.005],[-.07,.174,.125],[.05,.146,.108],[.14,.152,.119],[.31,.203,.139],[.401,.189,.113],[.433,.089,.077]],coat,16,D||M?.055:.012);
  shape(chest,[[skirt+.003,D?.227:M?.203:.201,D?.161:.151,.005],[skirt+.025,D?.224:M?.202:.198,D?.159:.149,.005]],lining,16,D||M?.055:.012);
  shape(chest,[[.425,.069,.064],[.538,.059,.057,.003]],skin,10);
  // Belts and personal effects sit against the tunic rather than floating on the rig.
  shape(chest,[[.027,.154,.119],[.074,.153,.118]],D?'#9c785c':leather,12);
  box(chest,[.008,.052,.117],[.061,.039,.013],brass,[0,0,0],'metal');box(chest,[.008,.052,.126],[.038,.022,.008],leather);
  if(!D){bead(chest,[.14,-.007,.088],[.058,.065,.039],belt,[.07,-.38,.14]);box(chest,[.136,.023,.117],[.085,.044,.025],leather,[.07,-.38,.14]);bead(chest,[.14,.014,.134],[.009,.009,.006],brass,[0,0,0],'metal');}
  // Faceted face: cheeks, brow shelves, painted eye sockets, sculpted nose and lips.
  if(D)head.scale.set(1.29,1.20,1.26);
  shape(head,[[-.038,.045,.049,.019],[-.003,.081,.078,.018],[.048,.106,.089,.009],[.113,.113,.10],[.184,.111,.099,-.004],[.226,.092,.079,-.005],[.254,.047,.041,-.006]],skin,14);
  bead(head,[0,.071,.096],[.026,.028,.027],skin,[-.25,0,0]);
  bead(head,[0,.056,.112],[.033,.014,.018],skin);
  for(const s of [-1,1]){
    bead(head,[s*.109,.092,-.003],[.022,.039,.025],skin);bead(head,[s*.121,.091,.005],[.011,.024,.012],blush);
    const x=s*.046;
    bead(head,[x,.105,.0915],D?[.025,.029,.013]:[.027,.012,.010],D?ink:'#453e31',[0,s*.18,-s*.036]);
    if(!D){bead(head,[x,.104,.0995],[.019,.0065,.005],cream,[0,s*.12,0]);bead(head,[x,.105,.105],[.006,.008,.003],ink);}
    bead(head,[x-s*.004,D?.111:.108,D?.104:.107],D?[.0055,.0055,.003]:[.002,.002,.0018],'#faf0ce');
    rod(head,[x-s*.022,.13,.093],[x+s*.024,.136,.082],.009,.004,D?hair:ink);
    if(D){bead(head,[s*.074,.064,.079],[.017,.012,.004],'#c8a68d',[0,s*.4,0]);}
  }
  rod(head,[-.025,.023,.091],[.003,.020,.098],.005,.004,D?'#977567':'#855b4c');rod(head,[.003,.020,.098],[.025,.024,.091],.004,.003,D?'#977567':'#855b4c');
  if(!G){
    shape(head,[[.161,.115,.10,-.006],[.209,.113,.101,-.008],[.253,.084,.073,-.012],[.272,.031,.031,-.01]],hair,12);
    for(let i=0;i<5;i++){let x=(i-2)*.032;bead(head,[x,.164+.014*Math.cos(i),.086-.022*Math.abs(i-2)],[.029,.047+.009*(i%2),.021],hair,[0,0,-.23+i*.05]);}
  }
  // Open-faced tailored hood with a real face aperture, stitched opening and crown.
  function hood(){
    const rings=[[-.068,.139,.117,.67,-.008],[.005,.14,.132,.87,-.007],[.112,.145,.148,.90,-.007],[.202,.137,.14,.73,-.006],[.253,.109,.113,.47,-.020],[.291,.042,.049,0,-.050],[.28,.009,.01,0,-.087]];
    const verts=[],ix=[],edges=[[],[]],N=18;
    rings.forEach(([y,rx,rz,gap,dz],j)=>{for(let i=0;i<=N;i++){let a=gap+(TAU-gap*2)*i/N;let k=[rx*Math.sin(a),y,rz*Math.cos(a)+dz];verts.push(k);if(i===0)edges[0].push(k);if(i===N)edges[1].push(k);if(j&&i){let a0=j*(N+1)+i;ix.push(a0-N-2,a0-N-1,a0,a0-N-2,a0,a0-1);}}});
    panel(head,verts,ix,coat);for(const edge of edges)for(let j=0;j<4;j++)rod(head,edge[j],edge[j+1],.008,.007,lining);
    shape(chest,[[.359,.191,.134,.006],[.394,.177,.13],[.441,.109,.093],[.463,.085,.082]],M?'#858d74':shade,14);
  }
  const cape=joint(chest,'cape',0,.365,-.052);
  if(R||M||C||F){
    const longest=M?.813:C?.53:R?.70:.435;
    const verts=[[-.137,.044,-.04],[0,.049,-.058],[.139,.043,-.04],[-.21,-.098,-.078],[0,-.104,-.113],[.20,-.13,-.082],[-.228,-longest*.68,-.11],[-.066,-longest*.65,-.137],[.098,-longest*.70,-.143],[.204,-longest*.69,-.10],[-.242,-longest,-.15],[-.133,-longest*.94,-.174],[-.013,-longest*1.035,-.144],[.082,-longest*.94,-.186],[.231,-longest*.89,-.15]];
    panel(cape,verts,[0,1,4,0,4,3,1,2,5,1,5,4,3,4,7,3,7,6,4,8,7,4,5,8,5,9,8,6,7,11,6,11,10,7,12,11,7,8,12,8,13,12,8,9,14,8,14,13],shade);
    for(let i=10;i<14;i++)rod(cape,verts[i],verts[i+1],.006,.006,lining);
    rod(cape,verts[3],verts[10],.003,.005,lining);rod(cape,verts[5],verts[14],.003,.005,lining);
  }
  if(R||M)hood();
  if(C||R||F){rod(chest,[-.163,.378,.071],[.130,.08,.098],.021,.021,belt,'paint',8);box(chest,[.003,.225,.132],[.052,.048,.014],brass,[.02,0,.72],'metal');}
  if(M){
    panel(chest,[[-.058,.371,.14],[.004,.384,.145],[.008,.045,.121],[-.047,.048,.121],[-.079,-.46,.151],[-.002,-.461,.156]],[0,1,2,0,2,3,3,2,5,3,5,4],lining);
    for(let i=0;i<3;i++)box(chest,[-.026,.295-.052*i,.146],[.022,.022,.009],brass,[0,0,PI/4],'metal');
    shape(head,[[.018,.058,.046,.04],[-.005,.053,.041,.041],[-.062,.014,.015,.054]].reverse(),'#bcb9a7',9);
  }
  if(D||V){
    // Saucer collar; vest lacing or apron folds.
    for(let s of [-1,1])panel(chest,[[s*.027,.431,.066],[s*.123,.395,.104],[s*.090,.329,.129],[s*.016,.36,.153]],[0,1,2,0,2,3],cream);
    if(V){panel(chest,[[-.131,.067,.111],[.125,.067,.113],[.125,-.285,.133],[.014,-.309,.157],[-.151,-.285,.129]],[0,1,3,1,2,3,0,3,4],'#c7b995');
      shape(head,[[.148,.118,.109,-.011],[.219,.124,.119,-.015],[.263,.078,.079,-.025]],cream,12);
      bead(head,[0,.130,-.093],[.081,.074,.059],'#b3a685');bead(head,[.106,.074,-.028],[.018,.069,.019],cream,[.2,0,-.10]);
    }else{for(let i=0;i<3;i++)bead(chest,[0,.27-.065*i,.137],[.010,.011,.007],brass,[0,0,0],'metal');
      for(let s of [-1,1]){bead(head,[s*.105,.101,-.012],[.029,.096,.051],hair,[s*.03,0,-s*.14]);bead(head,[s*.094,.024,-.027],[.037,.038,.032],hair);}}
  }
  if(G||F){
    shape(chest,[[.101,.157,.124],[.184,.177,.139],[.308,.213,.152],[.392,.171,.115]],G?steelD:steel,12,.006,[0,0,0],'metal');
    shape(chest,[[.093,.159,.127],[.115,.160,.13]],G?brass:steelD,12,0,[0,0,0],'metal');
    for(let i=0;i<3;i++)bead(chest,[0,.346-i*.072,.15],[.012,.011,.006],brass,[0,0,0],'metal');
    if(G){
      shape(head,[[.127,.142,.129],[.16,.134,.126],[.221,.122,.108],[.263,.076,.067],[.281,.025,.021]],steel,14,0,[0,0,0],'metal');
      shape(head,[[.117,.158,.140],[.132,.158,.140],[.15,.132,.126]],steelD,14,0,[0,0,0],'metal');
      for(let s of [-1,1])panel(head,[[s*.117,.139,.026],[s*.113,.129,.086],[s*.099,.030,.071],[s*.104,.014,.034],[s*.126,.069,-.003]],[0,1,2,0,2,4,2,3,4],steelD,'metal');
      rod(head,[0,.27,0],[0,.163,.122],.009,.010,brass,'metal');
    }else{bead(head,[-.016,.013,.040],[.080,.046,.054],hair);bead(head,[.047,.041,.041],[.038,.044,.049],hair);}
  }
  const gear={};
  for(const side of [-1,1]){
    let shoulder=joint(chest,'shoulder '+side,.198*side,.368,.001),elbow=joint(shoulder,'elbow '+side,side*.027,-.272,0),palm=joint(elbow,'wrist '+side,side*.004,-.247,.002);
    shape(shoulder,[[-.272,.046,.053,0,.025*side],[-.18,.055,.063,0,.023*side],[-.08,.070,.071,0,.016*side],[.011,.070,.078],[.049,.052,.050]],coat,10);
    shape(elbow,[[-.25,.036,.041],[-.169,.045,.050],[-.074,.055,.058],[.01,.047,.05]],V||D?cream:lining,9);
    if(G||F){bead(shoulder,[side*.014,-.014,0],[.090,.076,.096],steelD,[0,0,side*.13],'metal');bead(shoulder,[side*.018,.002,0],[.09,.066,.093],steel,[0,0,side*.13],'metal');shape(elbow,[[-.229,.044,.049],[-.084,.061,.064],[-.072,.064,.067]],steelD,9,0,[0,0,0],'metal');}
    else shape(elbow,[[-.224,.043,.048],[-.174,.051,.056]],M||D?brass:belt,9);
    bead(palm,[0,-.046,.014],[.044,.062,.034],skin,[-.13,0,side*.05]);
    bead(palm,[-side*.032,-.039,.033],[.018,.033,.019],skin,[-.32,0,side*.29]);
    const grip=joint(palm,'held item '+side,0,-.054,.035);arms.push({side,shoulder,elbow,palm,grip}); if(side<0)gear.right=grip;else gear.left=grip;
  }
  function sword(b) {
    rod(b,[0,-.083,0],[0,.103,0],.018,.016,leather);bead(b,[0,-.092,0],[.025,.031,.025],brass,[0,0,0],'metal');
    rod(b,[-.085,.095,-.009],[.085,.098,-.009],.011,.011,brass,'metal');
    const v=[[-.030,.112,0],[.030,.112,0],[.023,.631,0],[-.023,.631,0],[0,.728,.001],[0,.119,.012],[0,.635,.010],[0,.119,-.012],[0,.635,-.010]];
    panel(b,v,[0,5,6,0,6,3,3,6,4,1,2,6,1,6,5,2,4,6,0,3,8,0,8,7,3,4,8,1,7,8,1,8,2,2,8,4],steel,'metal');rod(b,[0,.12,.014],[0,.63,.012],.0033,.0019,'#c7d0bf','metal',4);
  }
  if(G){
    const s=gear.right;rod(s,[0,-.58,0],[0,1.12,0],.018,.014,wood);
    const v=[[-.042,1.138,0],[0,1.365,0],[.042,1.138,0],[0,1.073,0],[0,1.146,.016],[0,1.146,-.016]];
    panel(s,v,[0,1,4,1,2,4,2,3,4,3,0,4,0,5,1,1,5,2,2,5,3,3,5,0],steel,'metal');rod(s,[0,1.039,0],[0,1.12,0],.020,.020,brass,'metal');
  }
  let activeSword=null;
  if(F)sword(gear.right);
  if(R){activeSword=joint(gear.right,'drawn blade');sword(activeSword);
    rod(chest,[-.165,.045,-.01],[-.224,-.37,-.118],.027,.018,leather,'paint',5);rod(chest,[-.165,.041,-.009],[-.151,.138,.026],.015,.015,belt);}
  if(G||F){
    const s=gear.left,fac=[[0,.219,.026],[-.14,.156,.010],[-.128,-.062,.016],[-.084,-.156,.020],[0,-.232,.035],[.084,-.156,.020],[.128,-.062,.016],[.14,.156,.010],[0,-.012,.071]];
    const tri=[];for(let i=0;i<8;i++)tri.push(i,(i+1)%8,8);
    panel(s,fac,tri,G?'#4b6559':'#80563f');
    for(let i=0;i<8;i++)rod(s,fac[i],fac[(i+1)%8],.009,.009,brass,'metal');
    bead(s,[0,.013,.071],[.035,.042,.021],steel,[0,0,0],'metal');rod(s,[0,.181,.04],[0,-.196,.053],.009,.005,brass,'metal');
    rod(s,[-.105,.061,.041],[.105,.061,.041],.006,.006,brass,'metal');
  }
  if(C){
    let s=gear.left,arc=[[-.022,-.44,.013],[-.025,-.33,.034],[-.012,-.17,.102],[0,0,.116],[.011,.20,.106],[.022,.36,.048],[.024,.47,.012]];
    for(let i=0;i<arc.length-1;i++)rod(s,arc[i],arc[i+1],i===3?.017:.012,i===1?.017:.010,wood);
    rod(s,arc[0],arc[6],.0025,.0025,'#d7ccae','paint',4);
    rod(chest,[.154,-.067,-.128],[-.052,.411,-.155],.045,.048,leather);
    for(let j=0;j<3;j++){let x=-.06+j*.020;rod(chest,[x+.027,.364,-.157],[x-.020,.518+j*.014,-.159],.004,.004,wood);bead(chest,[x-.017,.50+j*.014,-.159],[.012,.035,.011],cream,[0,0,.28]);}
  }
  if(V){const s=gear.left;shape(s,[[-.232,.091,.078],[-.202,.107,.088],[-.120,.116,.092]],wood,12);
    for(let i=0;i<3;i++)shape(s,[[-.221+i*.033,.101+i*.006,.084+i*.003],[-.211+i*.033,.104+i*.006,.087+i*.003]],'#baa276',12);
    for(let i=0;i<12;i++){let a=i*PI/12,b=(i+1)*PI/12;rod(s,[.110*Math.cos(a),-.119+.136*Math.sin(a),.005],[.110*Math.cos(b),-.119+.136*Math.sin(b),.005],.008,.008,belt);}
  }
  const spell=joint(gear.right,'illustrative spell light',0,.114,.072);
  if(M){
    const s=gear.left;box(s,[0,.031,.01],[.22,.282,.040],brass,[0,0,-.06],'metal');
    box(s,[0,.031,.036],[.192,.25,.015],shade,[0,0,-.06]);for(let k=0;k<4;k++){const a=k*PI/2;rod(s,[Math.sin(a)*.073,.032+Math.cos(a)*.09,.050],[0,.032,.050],.0045,.0065,gold,'metal');}
    bead(s,[0,.036,.056],[.021,.033,.012],brass,[0,0,0],'metal');
    bead(spell,[0,0,0],[.035,.067,.035],'#ffe8ab',[0,0,0],'light');for(let i=0;i<5;i++){let a=i*TAU/5;bead(spell,[.074*Math.cos(a),.02+(.026*i),.06*Math.sin(a)],[.008,.013,.008],'#f7de8d',[0,0,0],'light');}
  }
  for(const [bone,slots] of batches)for(const [kind,b] of slots){let g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(b.n,3));g.setAttribute('color',new T.Float32BufferAttribute(b.c,3));g.setIndex(b.i);g.computeBoundingSphere();const m=new T.Mesh(g,lib.mats[kind]);m.castShadow=kind!=='light';m.receiveShadow=kind!=='light';bone.add(m);}
  frame.scale.setScalar(D?.43:G?1.035:V?.973:1);
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),homeY=.856,offset=(h>>>0)%113*.031;
  const ease=(v)=>v*v*(3-2*v);
  function pose(action='idle',phase=0,time=0){
    phase=Number.isFinite(phase)?phase:0;time=Number.isFinite(time)?time:0;let t=time+offset;
    const clock=phase*TAU,beat=Math.sin(clock),loop=Math.cos(clock),breathe=Math.sin(t*1.58),soft=Math.sin(t*.73);
    const walking=action==='walk'||action==='run',kneel=action==='kneel',attack=action==='strike'||action==='attack',block=action==='block',cast=action==='cast',guard=action==='guard',point=action==='point',listen=action==='listen';
    const pulse=ease(clamp(Math.sin(PI*clamp(phase,0,1)),0,1));
    let y=homeY+(walking?-.013-.011*Math.cos(clock*2):.005*breathe),cx=0,cz=0;
    if(kneel)y=.52+.002*breathe;if(block)y-=.076;if(attack)y-=.04+.025*pulse;
    pelvis.position.set(walking?.021*beat:0,y,0);pelvis.rotation.set(0,walking?.08*beat:0,walking?.02*beat:0);
    chest.rotation.set(walking?.055:listen?.095:block?.132:attack?.11:cast?-.07:.01, walking?-.105*beat:attack?-.58+1.13*ease(clamp(phase*1.75-.34,0,1)):point?-.22:0, walking?-.022*beat:listen?.032:0);
    head.rotation.set((listen?.075:kneel?.10:cast?-.12:0)+.018*breathe, walking?.025*soft:point?-.20:guard?.125*Math.sin(t*.65):listen?.135+.025*soft:.075*soft,listen?-.105:walking?.014*beat:.012*soft);
    cape.rotation.set(-.020-(walking?.075+.035*Math.cos(clock*2):attack?.09*pulse:.015*(1+breathe)),0,.011*Math.sin(t*1.33));
    for(const leg of legs){const s=leg.side;let z=walking?.212*Math.cos(clock+(s<0?0:PI)):s<0?.035:-.023;
      let lift=walking?.091*Math.pow(Math.max(0,Math.sin(clock+(s<0?0:PI))),1.24):0;
      if(kneel)z=s<0?.29:-.35;if(block||guard)z=s<0?.16:-.12;if(attack)z=s<0?.15+.08*pulse:-.14;
      let down=y-ank-lift,d=clamp(Math.hypot(down,z),.13,l1+l2-.0001);
      let k=Math.acos(clamp((d*d-l1*l1-l2*l2)/(2*l1*l2),-1,1)),a=Math.atan2(-z,down)-Math.atan2(l2*Math.sin(k),l1+l2*Math.cos(k));
      leg.thigh.rotation.set(a,0,0);leg.shin.rotation.set(k,0,0);leg.foot.rotation.set(-a-k+(walking?.16*lift/.091:0),0,0);
    }
    for(const a of arms){
      const s=a.side,right=s<0;let ax=-.085+(walking?s*.39*beat:.017*breathe),ay=0,az=s*.093,ex=-.20-(walking?.09*(1+Math.sin(clock*s)):.012*breathe),ey=0,ez=0,wx=0,wy=0,wz=0;
      if(D){ax-=.04;az+=s*.10;}if(V&&s>0){ex-=.49;az+=.055;}if(M&&s>0){ex-=.76;ay=.25;az=.17;}
      if(guard||(G&&!walking&&!point&&!attack&&!block)){if(right){ax=-.16;ex=-1.02;az=-.14;wx=.98;wz=.05;}else{ax=-.23;ex=-.69;ay=-.13;wx=.72;}}
      if(F&&!attack&&!block&&!walking){if(right){ax=-.09;ex=-.32;wz=-.30;wx=.23;}else{ex=-.37;wx=.33;}}
      if(listen&&!D){if(right){ax=-.22;ex=-.44;ay=.13;}else{ax=-.06;ex=-.45;}}
      if(kneel){ax=right?-.41:-.31;ex=right?-.56:-.88;az=s*.15;}
      if(point&&right){ax=-1.23-.055*breathe;ay=-.23;az=-.13;ex=-.135;wx=.15;}
      if(block){if(!right){ax=-.85;ex=-1.00;az=-.095;ay=-.31;wx=1.60;}else{ax=-.23;ex=-1.14;az=-.26;wx=.83;wz=.27;}}
      if(attack){const wind=ease(clamp(phase/.28,0,1)),hit=ease(clamp((phase-.28)/.30,0,1)),settle=ease(clamp((phase-.62)/.38,0,1));if(right){ax=-.45-1.90*wind+1.20*hit+.87*settle;ay=-.08+.68*wind-1.13*hit+.32*settle;az=-.18-.53*wind+.78*hit-.30*settle;ex=-.52-.65*wind+.96*hit-.22*settle;wx=.40-.52*hit+.33*settle;wz=.14+.45*wind-.71*hit;}else{ax=-.48-.20*pulse;ex=-.74;az=.17;wx=.9;}}
      if(cast){if(right){ax=-.87-.35*pulse;ex=-.96+.22*pulse;az=-.25-.08*pulse;ay=-.25;wx=.68;wy=-.18;}else{ax=-.39;ex=-1.0;ay=.30;az=.10;wx=.32;}}
      a.shoulder.rotation.set(ax,ay,az);a.elbow.rotation.set(ex,ey,ez);a.palm.rotation.set(wx,wy,wz);
    }
    if(activeSword)activeSword.visible=attack||block||guard;
    spell.visible=M&&cast;spell.scale.setScalar(.72+.46*pulse+.06*breathe);spell.rotation.y=t*1.7;
  }
  pose('idle',0,0);return {group,pose};
}
