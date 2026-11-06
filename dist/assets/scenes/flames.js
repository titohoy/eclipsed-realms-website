export async function createFlames(T,scene){
 const root=new URL('./flame/',import.meta.url),data=await fetch(new URL('effect.json',root)).then(r=>{if(!r.ok)throw Error('Flames unavailable');return r.json()});
 if(data.schema!==1||!/^textures\/[a-f0-9]{64}\.webp$/.test(data.texture))throw Error('Invalid flame');
 const texture=await new T.TextureLoader().loadAsync(new URL(data.texture,root).href);texture.colorSpace=T.SRGBColorSpace;texture.flipY=false;texture.wrapS=texture.wrapT=T.RepeatWrapping;
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(data.geometry.positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(data.geometry.uvs,2));geometry.setIndex(data.geometry.indices);geometry.computeBoundingSphere();
 const material=new T.ShaderMaterial({uniforms:{flame:{value:texture},seconds:{value:0}},side:T.DoubleSide,depthWrite:false,transparent:true,blending:T.AdditiveBlending,
 vertexShader:'varying vec2 texcoord;void main(){texcoord=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
 fragmentShader:'uniform sampler2D flame;uniform float seconds;varying vec2 texcoord;void main(){vec2 uv=texcoord+.04*sin(6.28318530718*(texcoord+vec2(.2,1.5)*seconds));vec3 light=texture2D(flame,uv).rgb;gl_FragColor=vec4(light*10.,light.r);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
 const mesh=new T.InstancedMesh(geometry,material,data.instances.length);mesh.frustumCulled=false;mesh.visible=false;scene.add(mesh);
 const rows=data.instances.map(row=>({matrix:new T.Matrix4().compose(new T.Vector3(...row.slice(0,3)),new T.Quaternion(...row.slice(3,7)),new T.Vector3(...row.slice(7,10))),point:new T.Vector3(...row.slice(0,3))}));
 return {update(camera,key,time){material.uniforms.seconds.value=time;mesh.visible=key==='cage';if(!mesh.visible)return;let count=0;for(const row of rows)if(row.point.distanceToSquared(camera.position)<6400)mesh.setMatrixAt(count++,row.matrix);mesh.count=count;mesh.instanceMatrix.needsUpdate=true;},dispose(){scene.remove(mesh);mesh.dispose();geometry.dispose();material.dispose();texture.dispose();}};
}
