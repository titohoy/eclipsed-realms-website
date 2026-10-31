import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dist=path.join(root,'dist');
const json=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8').replace(/^\uFEFF/,''));
const data=json('dist/game-data.json'),snapshot=json('content/source-snapshot.json'),curation=json('content/player-guide.json'),review=json('content/reviewed-bible.json'),sync=json('content/sync-status.json');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const current=JSON.parse(execFileSync(process.execPath,[path.join(root,'scripts/sync-bible.mjs'),'--check'],{encoding:'utf8'}));
assert(current.sourceHealthy,'Bible is unhealthy');assert(!current.changed,'Bible changed since review');assert.equal(current.digest,review.digest);assert.equal(snapshot.sourceDigest,review.digest);assert.equal(sync.sourceDigest,review.digest);
assert.equal(curation.length,snapshot.entries.length);assert.equal(new Set(curation.map(e=>e.id)).size,curation.length);
for(const e of snapshot.entries){const c=curation.find(x=>x.id===e.id);assert(c,'Unreviewed source '+e.id);assert.equal(c.sourceFingerprint,hash(JSON.stringify(e)),'Outdated player copy '+e.id);assert.equal(typeof c.publish,'boolean');assert(c.rationale);}
assert.equal(data.entries.length,curation.filter(e=>e.publish).length);assert.equal(new Set(data.entries.map(e=>e.id)).size,data.entries.length);
const ids=new Set(data.entries.map(e=>e.id));
for(const e of data.entries){assert(e.title&&e.summary&&e.body.length,'Incomplete article '+e.id);assert.deepEqual(Object.keys(e).sort(),['id','title','category','school','summary','body','stats','tags','related'].sort());for(const id of e.related)assert(ids.has(id),'Missing related article '+id);}
const forbiddenKeys=new Set(['source','sources','sourceArea','sourceDigest','sourceGeneratedAt','sourceFingerprint','rationale','authority','coverage','warnings','status','evidenceLabel','audit','unresolved','sourceFindings','alignment','chapters','npc','date','edition']);
function walk(v){if(!v||typeof v!=='object')return;for(const [k,x]of Object.entries(v)){assert(!forbiddenKeys.has(k),'Private field deployed: '+k);walk(x);}}walk(data);
const forbiddenCopy=/development bible|\batlas\b|source[- ]code|source reference|current project|reviewed project|blueprint|\bC\+\+\b|replicat(?:ed|ion)|native default|test harness|authoring|\bruntime\b|\bTODO\b|\bdebug\b|server-side|\.cpp\b|\.h\b|Docs\/|Source\/|unverified|canon corrections|evidence label/i;
const publicText=JSON.stringify(data);assert(!forbiddenCopy.test(publicText),'Developer rhetoric in public content: '+publicText.match(forbiddenCopy)?.[0]);
const references=new Set(['index.html','guide.html','story.html','start.html','faq.html','site.css','site.js','game-data.json','favicon.svg']);
for(const f of fs.readdirSync(dist).filter(f=>f.endsWith('.html'))){const text=fs.readFileSync(path.join(dist,f),'utf8');assert(!forbiddenCopy.test(text),'Developer rhetoric in '+f);if(!['updates.html','archive.html','archive-print.html','merge-review.html'].includes(f))assert.equal((text.match(/<h1[ >]/g)||[]).length,1,'Expected one main heading in '+f);for(const m of text.matchAll(/(?:src|href)="([^"]+)"/g)){const url=new URL(m[1].replaceAll('&amp;','&'),'https://local.test/'+f);if(url.origin!=='https://local.test')continue;references.add(url.pathname.slice(1));if(url.searchParams.has('entry'))assert(ids.has(url.searchParams.get('entry')),'Broken guide link in '+f+': '+url.searchParams.get('entry'));}}
for(const r of data.regions)references.add('assets/archive/original/'+r.image);for(const s of data.schools)references.add(s.image);
for(const ref of references)assert(fs.existsSync(path.join(dist,ref)),'Missing local asset '+ref);
for(const f of ['site-data.json','sync-status.json','archive-data.js','archive.js','archive.css','app.js','style.css'])assert(!fs.existsSync(path.join(dist,f)),'Internal/legacy asset published '+f);
const sourcePath=process.env.ECLIPSED_BIBLE_PROJECT||'D:/Unreal Projects/EclipsedRealms';
const project=JSON.parse(fs.readFileSync(path.join(sourcePath,'Docs/NarrativeReview/web/current-project.json')));
assert.deepEqual(data.quests.map(({id,title})=>({id,title})),project.quests.map(({id,title})=>({id,title})));
const raw=fs.readFileSync(path.join(sourcePath,'Docs/NarrativeReview/web/combat-encyclopedia/combat-data.js'),'utf8');const combat=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));
for(const e of combat.entries){const s=snapshot.entries.find(x=>x.id===e.id);for(const key of ['title','summary','body','stats','sources','warnings','status'])assert.deepEqual(s[key],e[key],'Private source drift '+e.id);}
console.log(JSON.stringify({ok:true,playerArticles:data.entries.length,reviewedSourceEntries:curation.length,withheld:curation.filter(e=>!e.publish).length,quests:data.quests.length,privateMetadataExcluded:true,developerCopyExcluded:true,localReferences:references.size,sourceFresh:true}));
