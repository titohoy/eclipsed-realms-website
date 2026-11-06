export function applyWorldProjection(T,material){
 const recipe=material.userData.nativeWorldProjection;if(!recipe)return;
 if(recipe.kind!=='sequential'||recipe.textureSizeCm?.length!==3||!recipe.textureSizeCm.every(n=>Number.isFinite(n)&&n!==0)||!Number.isFinite(recipe.blendScale)||!Number.isFinite(recipe.blendBias))throw Error('Invalid scenery projection');
 for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])if(material[key]){material[key].wrapS=material[key].wrapT=T.RepeatWrapping;}
 const uniform={size:{value:new T.Vector3(...recipe.textureSizeCm)},contrast:{value:new T.Vector2(recipe.blendScale,recipe.blendBias)}};
 material.onBeforeCompile=shader=>{
  shader.uniforms.nativeTextureSizeCm=uniform.size;shader.uniforms.nativeProjectionContrast=uniform.contrast;
  shader.vertexShader='varying vec3 vNativeWorldPosition;\nvarying vec3 vNativeWorldNormal;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <defaultnormal_vertex>','#include <defaultnormal_vertex>\nvNativeWorldNormal=inverseTransformDirection(transformedNormal,viewMatrix);');
  shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvec4 nativeVertex=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nnativeVertex=instanceMatrix*nativeVertex;\n#endif\nvNativeWorldPosition=(modelMatrix*nativeVertex).xyz;');
  shader.fragmentShader=[
   'varying vec3 vNativeWorldPosition;',
   'varying vec3 vNativeWorldNormal;',
   'uniform vec3 nativeTextureSizeCm;',
   'uniform vec2 nativeProjectionContrast;',
   'vec4 nativeTexture(sampler2D image){',
   ' vec3 p=vNativeWorldPosition.xzy*100./nativeTextureSizeCm;',
   ' vec3 n=abs(normalize(vNativeWorldNormal.xzy));',
   ' float x=clamp(n.x*nativeProjectionContrast.x+nativeProjectionContrast.y,0.,1.);',
   ' float z=clamp(n.z*nativeProjectionContrast.x+nativeProjectionContrast.y,0.,1.);',
   ' return mix(mix(texture2D(image,p.xz),texture2D(image,p.yz),x),texture2D(image,p.xy),z);',
   '}',''
  ].join('\n')+shader.fragmentShader;
  for(const name of ['map_fragment','roughnessmap_fragment','metalnessmap_fragment','aomap_fragment','normal_fragment_maps']){
   const chunk=T.ShaderChunk[name].replace(/texture2D\(\s*(map|roughnessMap|metalnessMap|aoMap|normalMap),\s*v\w+Uv\s*\)/g,'nativeTexture( $1 )');
   shader.fragmentShader=shader.fragmentShader.replace('#include <'+name+'>',chunk);
  }
 };
 material.customProgramCacheKey=()=> 'native-world-projection-sequential-v1';material.needsUpdate=true;
}
