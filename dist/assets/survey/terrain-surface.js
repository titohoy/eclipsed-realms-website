// Continuous terrain LOD. The full relief lattice has two metres between samples.
export async function createSurface(T, world, baseURL) {
  const side=2017, tiles=16, span=4032, tileMetres=span/tiles;
  const url=name=>new URL(name,baseURL).href;
  async function grid(){
    const r=await fetch(url('altitude.bin.gz'));
    if(!r.ok)throw Error('The relief could not be loaded.');
    const bytes=await r.arrayBuffer(),head=new Uint8Array(bytes,0,2);
    const unzipped=head[0]===31&&head[1]===139?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():bytes;
    if(unzipped.byteLength!==side*side*2)throw Error('Incomplete survey elevation.');
    const v=new Uint16Array(unzipped);
    for(let y=0;y<side;y++){let z=0;for(let x=0;x<side;x++){const k=y*side+x;z=(z+v[k])&65535;v[k]=z;}}
    return v;
  }
  const [samples,plate]=await Promise.all([grid(),new T.TextureLoader().loadAsync(url('soil.webp'))]);
  plate.colorSpace=T.SRGBColorSpace;plate.anisotropy=4;
  const mat=new T.MeshStandardMaterial({map:plate,roughness:1});
  const group=new T.Group();world.add(group);
  const terrain=[],clamp=(n,l,h)=>Math.max(l,Math.min(h,n));
  const zAt=(x,y)=>(samples[clamp(y,0,2016)*side+clamp(x,0,2016)]-32768)*.0078125;
  function height(x,z){
    const gx=clamp((x+2016)/2,0,2016), gy=clamp((z+2016)/2,0,2016);
    const ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy;
    return (zAt(ix,iy)*(1-fx)+zAt(ix+1,iy)*fx)*(1-fy)+(zAt(ix,iy+1)*(1-fx)+zAt(ix+1,iy+1)*fx)*fy;
  }
  function make(tile,sub){
    const p=[],uv=[],norm=[],idx=[],stride=126/sub;
    function vert(x,y,skirt=0){
      const gx=tile.i*126+x*stride,gy=tile.j*126+y*stride;
      const nx=(zAt(gx-1,gy)-zAt(gx+1,gy))/4,nz=(zAt(gx,gy-1)-zAt(gx,gy+1))/4;
      const len=Math.hypot(nx,1,nz);p.push(gx*2-2016,zAt(gx,gy)-skirt,gy*2-2016);norm.push(nx/len,1/len,nz/len);uv.push(gx/2016,1-gy/2016);
    }
    for(let y=0;y<=sub;y++)for(let x=0;x<=sub;x++){vert(x,y);const a=y*(sub+1)+x;if(y<sub&&x<sub)idx.push(a,a+sub+1,a+1,a+1,a+sub+1,a+sub+2);}
    const edges=Array.from({length:4},()=>[]);
    for(let k=0;k<=sub;k++){edges[0].push([k,0]);edges[1].push([sub,k]);edges[2].push([sub-k,sub]);edges[3].push([0,sub-k]);}
    for(const edge of edges){const start=p.length/3;edge.forEach(([x,y],i)=>{vert(x,y,7);if(i){const [x0,y0]=edge[i-1],a=y0*(sub+1)+x0,b=y*(sub+1)+x;idx.push(a,b,start+i-1,b,start+i,start+i-1);}});}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('normal',new T.Float32BufferAttribute(norm,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeBoundingSphere();
    if(tile.obj){tile.obj.geometry.dispose();tile.obj.geometry=g;}else{tile.obj=new T.Mesh(g,mat);group.add(tile.obj);}
    tile.sub=sub;
  }
  for(let j=0;j<tiles;j++)for(let i=0;i<tiles;i++){const t={i,j,x:(i+.5)*tileMetres-2016,z:(j+.5)*tileMetres-2016,sub:0};make(t,7);terrain.push(t);}
  let lastX=Infinity,lastZ=Infinity,lastR=Infinity;
  return {group,height,update(target,radius){if(Math.hypot(target.x-lastX,target.z-lastZ)<8&&Math.abs(lastR-radius)<8)return;lastX=target.x;lastZ=target.z;lastR=radius;
    for(const t of terrain){const d=Math.hypot(Math.max(0,Math.abs(t.x-target.x)-tileMetres*.5),Math.max(0,Math.abs(t.z-target.z)-tileMetres*.5))+radius*.42;
      const sub=d<180?126:d<440?63:d<1020?21:7;if(sub!==t.sub)make(t,sub);}
  },dispose(){for(const t of terrain)t.obj.geometry.dispose();group.removeFromParent();plate.dispose();mat.dispose();}};
}
