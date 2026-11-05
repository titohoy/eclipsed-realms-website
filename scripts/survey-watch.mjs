// Private workstation input checks for the real 3D world. Only hashes and paths enter the review report.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const actorDir='Content/__ExternalActors__/Maps/L_EclipsedRealms_OpenWorldMap';
export function actorInventory(project){
 const files=[];
 function visit(rel){for(const e of fs.readdirSync(path.join(project,rel),{withFileTypes:true})){const name=rel+'/'+e.name;if(e.isDirectory())visit(name);else if(e.name.endsWith('.uasset'))files.push(name);}}
 visit(actorDir);return files.sort();
}
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
export function checkSurvey(project,root){
 const m=JSON.parse(fs.readFileSync(path.join(root,'content/atlas/survey-inputs.json'),'utf8'));
 const changes=[],hashes=[];
 for(const [rel,sz,modified,digest] of m.files){
  if(!rel||rel.includes('..')||path.isAbsolute(rel))throw Error('Invalid survey path');
  let value;
  try{const filename=path.join(project,rel),s=fs.statSync(filename);value=s.size===sz&&s.mtimeMs===modified?digest:hash(fs.readFileSync(filename));}
  catch{value='missing';}
  hashes.push([rel,value]);if(value!==digest)changes.push(rel);
 }
 const inventory=actorInventory(project);
 const roster=hash(JSON.stringify(inventory));
 if(roster!==m.actorRoster)changes.push('Open-world actor inventory changed; reconcile actor additions and removals.');
 const digest=hash(JSON.stringify([roster,hashes]));
 if(!changes.length&&m.digest!==digest)throw Error('Private survey baseline is corrupt.');
 return {digest,changes};
}
