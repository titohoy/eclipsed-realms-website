import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dist=path.join(root,'dist');
const data=JSON.parse(fs.readFileSync(path.join(dist,'site-data.json')));
const sourceCheck=JSON.parse(execFileSync(process.execPath,[path.join(root,'scripts/sync-bible.mjs'),'--check'],{encoding:'utf8'}));
assert(sourceCheck.sourceHealthy,'Bible source is not current');
assert(!sourceCheck.changed,'Bible changed since the editorial review');
assert.equal(data.sourceDigest,sourceCheck.digest,'Published data and reviewed Bible differ');
const editorial=JSON.parse(fs.readFileSync(path.join(root,'content/editorial.json'),'utf8').replace(/^\uFEFF/,''));
assert.equal(data.authority,'Eclipsed Realms · Development Bible');
assert.equal(data.entries.length,data.coverage.combat+data.coverage.systems);
assert.equal(new Set(data.entries.map(e=>e.id)).size,data.entries.length);
assert.equal(new Set(data.quests.map(e=>e.id)).size,data.quests.length);
for(const e of data.entries){assert(e.id&&e.title&&e.summary);assert(Array.isArray(e.body));assert(Array.isArray(e.tags));assert(Array.isArray(e.sources));assert(e.sources.length>0,'No source for '+e.id);}
const sourcePath=process.env.ECLIPSED_BIBLE_PROJECT||'D:/Unreal Projects/EclipsedRealms';
const project=JSON.parse(fs.readFileSync(path.join(sourcePath,'Docs/NarrativeReview/web/current-project.json')));
assert.deepEqual(data.quests,project.quests.map(q=>({id:q.id,title:q.title,description:q.description,group:q.group,source:q.source})));
const combatText=fs.readFileSync(path.join(sourcePath,'Docs/NarrativeReview/web/combat-encyclopedia/combat-data.js'),'utf8');
const combat=JSON.parse(combatText.slice(combatText.indexOf('{'),combatText.lastIndexOf('}')+1));
for(const e of combat.entries){const target=data.entries.find(x=>x.id===e.id);for(const k of ['title','summary','body','stats','sources','warnings','status'])assert.deepEqual(target[k],e[k],`Combat projection changed ${e.id}.${k}`);}
for(const c of editorial.characters.filter(c=>c.npc))assert.equal(data.characters.find(x=>x.id===c.id).name,project.names[c.npc]);
const references=new Set(['index.html','guide.html','story.html','updates.html','site.css','site.js','site-data.json','sync-status.json']);
for(const r of data.regions)references.add('assets/archive/original/'+r.image);
for(const s of data.schools)references.add(s.image);
for(const f of fs.readdirSync(dist).filter(x=>/\.(html|js|css)$/.test(x))){const text=fs.readFileSync(path.join(dist,f),'utf8');for(const m of text.matchAll(/(?:src|href)=["']([^"'#?]+)|url\(['"]?([^)'"?#]+)/g)){const ref=m[1]||m[2];if(!/^(?:https?:|data:|mailto:|\$)/.test(ref)&&!ref.includes('${'))references.add(ref.split('?')[0]);}}
for(const f of references)assert(fs.existsSync(path.join(dist,f)),'Missing local reference '+f);
for(const f of ['archive-data.js','archive.js','archive.css','app.js','style.css'])assert(!fs.existsSync(path.join(dist,f)),'Legacy material remains published: '+f);
const forbidden=['canonDocuments','dialogues','siwc_bypass','source_repository_credential','token_expires_at'];for(const key of forbidden)assert(!Object.hasOwn(data,key));
assert(data.audit.length>=12);assert(data.unresolved.length>=3);
console.log(JSON.stringify({ok:true,guideEntries:data.entries.length,quests:data.quests.length,exactCombatRecords:combat.entries.length,localReferences:references.size,uniqueIds:true,legacyRemoved:true}));
