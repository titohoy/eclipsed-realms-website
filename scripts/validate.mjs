import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadGuide,guideIndex} from './guide-data.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dist=path.join(root,'dist');
const json=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8').replace(/^\uFEFF/,''));
const data=json('dist/game-data.json'),snapshot=json('content/source-snapshot.json'),review=json('content/reviewed-bible.json'),sync=json('content/sync-status.json');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const {validateMap}=await import('./map-review.mjs');validateMap(root);
const surveyAssets={'relief.bin':'8ff1949660e3687cf2b9fdccdca65163f2707b8f34663d26e5dd5e7f2ea5f719'};
for(const [name,sha] of Object.entries(surveyAssets))assert.equal(hash(fs.readFileSync(path.join(dist,'assets/cartography',name))),sha,'3D terrain/forest needs review: '+name);
for(const f of ['world-flight.js','journey.js','scene-sound.js','advert.js','assets/people/cast.js','assets/survey/scan-layer.js','assets/cartography/engine/three.module.min.js','assets/cartography/engine/three.core.min.js'])assert(fs.statSync(path.join(dist,f)).size>0,'Missing immersive scene asset: '+f);
const scope=json('content/atlas/complete-world-scope.json'),coverage=json('content/atlas/final-world-hq-coverage.json'),manifest=json('dist/assets/survey/manifest.json'),assetReview=json('content/atlas/public-assets.json');
assert(scope.success&&scope.completeDescriptorCoverage&&scope.trainingArenaExcluded,'World scope requires review');assert.equal(scope.includedLayers,179);assert.equal(scope.expectedRoots,scope.observedRoots);assert.equal(scope.expectedNested,scope.observedNested);assert.equal(scope.sourcePlacements,coverage.sourcePlacements);
assert(manifest.complete&&!coverage.draft,'Incomplete world scan');assert.deepEqual(manifest.summary,coverage.summary);assert.equal(hash(fs.readFileSync(path.join(dist,'assets/survey/manifest.json'))),coverage.manifestSHA256,'World asset manifest drift');
for(const [file,sha] of Object.entries(assetReview)){assert(/^(assets\/(people|survey)\/)\S+$/.test(file)&&!file.includes('..'),'Unexpected asset path');assert.equal(hash(fs.readFileSync(path.join(dist,file))),sha,'Reviewed asset changed: '+file);}
for(const dir of ['assets/people','assets/survey']){function checkDir(rel){for(const e of fs.readdirSync(path.join(dist,rel),{withFileTypes:true})){const name=rel+'/'+e.name;if(e.isDirectory())checkDir(name);else assert(assetReview[name],'Unreviewed public asset: '+name);}}checkDir(dir);}
for(const f of ['content','source-snapshot.json','reviewed-bible.json','survey-inputs.json','guide-v2.json','player-guide.json'])assert(!fs.existsSync(path.join(dist,f)),'Private review data in dist');
const current=JSON.parse(execFileSync(process.execPath,[path.join(root,'scripts/sync-bible.mjs'),'--check'],{encoding:'utf8'}));
assert(current.sourceHealthy,'Bible is unhealthy');assert(!current.changed,'Bible changed since review');assert.equal(current.digest,review.digest);assert.equal(snapshot.sourceDigest,review.digest);assert.equal(sync.sourceDigest,review.digest);
// Player guide: content/guide-v2.json is the single private source (no Bible fingerprints).
const guide=loadGuide(root),guideArticles=guide.sections.flatMap(s=>s.articles.map(a=>({...a,section:s.id}))),guideIds=new Set(guideArticles.map(a=>a.id));
assert(guide.sections.length>=6&&guideArticles.length>=40,'Guide is too small');assert.equal(new Set(guide.sections.map(s=>s.id)).size,guide.sections.length,'Duplicate guide section');assert.equal(guideIds.size,guideArticles.length,'Duplicate guide article id');
for(const s of guide.sections)assert(s.id&&s.title&&s.blurb&&s.intro&&s.icon&&s.articles.length,'Incomplete guide section '+s.id);
for(const a of guideArticles){assert(a.title&&a.summary&&Array.isArray(a.body)&&a.body.length&&a.body.every(t=>typeof t==='string'&&t.trim().length>20),'Article lacks player copy: '+a.id);assert(typeof a.evidence==='string'&&a.evidence.trim(),'Article lacks private evidence: '+a.id);assert(typeof a.keywords==='string','Article keywords: '+a.id);
 for(const r of a.related){assert(guideIds.has(r),'Unresolved related article in '+a.id+': '+r);assert.notEqual(r,a.id,'Self link '+a.id);}
 for(const row of [...a.numbers,...a.controls])assert(row.every(c=>typeof c==='string'&&c.trim()),'Empty table cell in '+a.id);for(const row of a.numbers)assert.equal(row.length,2,'Numbers row shape '+a.id);for(const row of a.controls)assert.equal(row.length,3,'Controls row shape '+a.id);}
assert(guide.start.steps.length>=3&&guide.start.steps.every(st=>guideIds.has(st[0])&&st[1]&&st[2]),'Start path has an unresolved article');
assert.deepEqual(data.entries,guideIndex(guide),'game-data.json entries must be the allowlisted guide index');
for(const e of data.entries)assert.deepEqual(Object.keys(e).sort(),['id','school','section','title'],'Unexpected public entry fields '+e.id);
const ids=new Set(data.entries.map(e=>e.id));
const forbiddenKeys=new Set(['source','sources','sourceArea','sourceDigest','sourceGeneratedAt','sourceFingerprint','rationale','authority','coverage','warnings','status','evidenceLabel','audit','unresolved','sourceFindings','alignment','chapters','npc','date','edition','evidence']);
function walk(v){if(!v||typeof v!=='object')return;for(const [k,x]of Object.entries(v)){assert(!forbiddenKeys.has(k),'Private field deployed: '+k);walk(x);}}walk(data);
const forbiddenCopy=/development bible|\batlas\b|source[- ]code|source reference|current project|reviewed project|blueprint|\bC\+\+\b|replicat(?:ed|ion)|native default|test harness|authoring|\bruntime\b|\bTODO\b|\bdebug\b|server-side|\.cpp\b|\.h\b|Docs\/|Source\/|unverified|canon corrections|evidence label/i;
const publicText=JSON.stringify(data);assert(!forbiddenCopy.test(publicText),'Developer rhetoric in public content: '+publicText.match(forbiddenCopy)?.[0]);
const references=new Set(['index.html','guide.html','story.html','start.html','faq.html','site.css','site.js','game-data.json','favicon.svg']);
for(const f of fs.readdirSync(dist).filter(f=>f.endsWith('.html'))){const text=fs.readFileSync(path.join(dist,f),'utf8');assert(!forbiddenCopy.test(text),'Developer rhetoric in '+f);if(!['updates.html','archive.html','archive-print.html','merge-review.html'].includes(f))assert.equal((text.match(/<h1[ >]/g)||[]).length,1,'Expected one main heading in '+f);for(const m of text.matchAll(/(?:src|href)="([^"]+)"/g)){const url=new URL(m[1].replaceAll('&amp;','&'),'https://local.test/'+f);if(url.origin!=='https://local.test')continue;references.add(url.pathname.slice(1));if(url.searchParams.has('entry'))assert(ids.has(url.searchParams.get('entry')),'Broken guide link in '+f+': '+url.searchParams.get('entry'));}}
const guideHtml=fs.readFileSync(path.join(dist,'guide.html'),'utf8'),guideVisible=guideHtml.replace(/<script[\s\S]*?<\/script>/g,' ').replace(/<[^>]+>/g,' ').replaceAll('&amp;','&').replaceAll('&#39;',"'").replaceAll('&quot;','"');
for(const a of guideArticles){assert(!guideHtml.includes(a.evidence),'Private evidence emitted for '+a.id);assert(guideHtml.includes('id="read-'+a.id+'"'),'Article missing from guide.html: '+a.id);assert(!/[.\-]/.test(a.id)||!guideVisible.includes(a.id),'Internal id shown in guide copy: '+a.id);}
const idLinks=[...guideHtml.matchAll(/href="#(read-[^"]+)"/g)].map(m=>m[1]);for(const l of idLinks)assert(guideHtml.includes('id="'+l+'"'),'Broken in-page guide link '+l);
assert(!/guide-v2|"evidence"|sourceFingerprint|player-guide/.test(guideHtml),'Private guide field in guide.html');
assert(!/\bE-\d{2,3}\b|\.(?:cpp|uasset)\b|[A-Za-z]+\/Eclipsed[A-Za-z]+|\bD:[\\/]/.test(guideVisible),'Source citation or internal reference in guide copy');
const spoilerTerms=/\bendings?\b|\bheirs?\b|\bmarriage\b|\bmarried\b|\bspouse\b|\bReaper\b|\bhouseholds?\b|\blegacy\b|\bredemption\b|\bbond quests?\b|\bpenance\b|\babsolution\b|\bbeggars?\b|\binclination\b|\balignment vote|\bBenevolent\b|\bMalevolent\b/i;
assert(!spoilerTerms.test(guideVisible),'Spoiler or unbuilt-feature term in guide: '+guideVisible.match(spoilerTerms)?.[0]);
assert(!/\bdesign[- ]only\b|\bplanned\b|\bcoming soon\b|\bnot yet (?:built|implemented)\b/i.test(guideVisible),'Unbuilt feature wording in guide');
assert.equal((guideHtml.match(/<h1[ >]/g)||[]).length,1,'Guide must have one h1');
for(const r of data.regions)references.add('assets/archive/original/'+r.image);for(const s of data.schools)references.add(s.image);
for(const ref of references)assert(fs.existsSync(path.join(dist,ref)),'Missing local asset '+ref);
for(const f of ['site-data.json','sync-status.json','archive-data.js','archive.js','archive.css','app.js','style.css'])assert(!fs.existsSync(path.join(dist,f)),'Internal/legacy asset published '+f);
const sourcePath=process.env.ECLIPSED_BIBLE_PROJECT||'D:/Unreal Projects/EclipsedRealms';
const project=JSON.parse(fs.readFileSync(path.join(sourcePath,'Docs/NarrativeReview/web/current-project.json')));
assert(!('quests' in data)&&!('decisions' in data),'Story spoilers in public data');assert(!/spoiler switch|story spoilers are yours to reveal/i.test(JSON.stringify(data)+fs.readFileSync(path.join(dist,'story.html'))),'Obsolete spoiler UI');assert(data.characters.every(c=>!('detail' in c)),'Character revelations in public data');
const raw=fs.readFileSync(path.join(sourcePath,'Docs/NarrativeReview/web/combat-encyclopedia/combat-data.js'),'utf8');const combat=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));
for(const e of combat.entries){const s=snapshot.entries.find(x=>x.id===e.id);for(const key of ['title','summary','body','stats','sources','warnings','status'])assert.deepEqual(s[key],e[key],'Private source drift '+e.id);}
console.log(JSON.stringify({ok:true,playerArticles:guideArticles.length,guideSections:guide.sections.length,guideArticles:guideArticles.length,quests:snapshot.quests.length,worldLayers:scope.includedLayers,worldInstances:manifest.summary.placements,reviewed3dAssets:Object.keys(assetReview).length,privateMetadataExcluded:true,developerCopyExcluded:true,localReferences:references.size,sourceFresh:true}));
