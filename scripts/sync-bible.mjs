import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {checkMap} from './map-review.mjs';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const project=process.env.ECLIPSED_BIBLE_PROJECT || 'D:/Unreal Projects/EclipsedRealms';
const web=path.join(project,'Docs/NarrativeReview/web');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const read=p=>fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'');
const json=p=>JSON.parse(read(p));
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.isSymbolicLink())continue;const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(json|js|mjs|html|css|md)$/.test(e.name))files.push(p);}}
walk(web);walk(path.join(project,'Atlas/data'));
// Watcher clock ticks are health, not content changes. Read them independently.
const health=json(path.join(web,'source-status.json'));
const live=json(path.join(web,'live-sync.json'));
const survey=checkMap(project,root);
const healthy=health.status==='matched'&&!live.lastError&&!survey.mismatches.length;
const contentFiles=files.filter(p=>!['live-sync.json','source-status.json'].includes(path.basename(p)));
const sources=Object.fromEntries([...new Set(contentFiles)].sort().map(p=>[path.relative(project,p).replaceAll('\\','/'),hash(read(p))]));
sources['reviewed-open-world-cartography']=survey.digest;
const digest=hash(JSON.stringify(sources));
const baseline=path.join(root,'content/reviewed-bible.json');
const prev=fs.existsSync(baseline)?json(baseline):{sources:{}};
const changed=[...new Set([...Object.keys(sources),...Object.keys(prev.sources)])].filter(k=>sources[k]!==prev.sources[k]);
if(process.argv.includes('--check')){console.log(JSON.stringify({changed:changed.length>0,digest,files:changed,sourceHealthy:healthy,sourceStatus:health.status,sourceError:live.lastError,mapDigest:survey.digest,mapFilesNeedingReview:survey.mismatches},null,2));process.exit(0);}
if(!healthy)throw Error('Bible snapshot is stale or its watcher reports an error. Preserve the published edition until the Bible is current.');
if(changed.length&&!process.argv.includes('--accept-reviewed'))throw Error('Bible changed. Review changed sources and editorial.json before building with --accept-reviewed. Run --check for the exact files.');
const registry={};const context=vm.createContext({ATLAS:{register:(id,data)=>registry[id]=data}});
for(const f of fs.readdirSync(path.join(project,'Atlas/data')).filter(f=>f.endsWith('.js')))vm.runInContext(read(path.join(project,'Atlas/data',f)),context,{timeout:2000});
const current=json(path.join(web,'current-project.json')), authored=json(path.join(web,'authored.json'));
const combatRaw=read(path.join(web,'combat-encyclopedia/combat-data.js'));
const combat=JSON.parse(combatRaw.slice(combatRaw.indexOf('{'),combatRaw.lastIndexOf('}')+1));
const editorial=json(path.join(root,'content/editorial.json'));
const featureMap=new Map(Object.values(registry).flatMap(r=>r.features||[]).map(f=>[f.id,f]));
if(!Array.isArray(combat.entries)||combat.entries.length<100||!current.quests?.length||!authored.alignment?.ids)throw Error('Incomplete Bible source. Preserve the published site.');
const entries=combat.entries.map(e=>({...e,sourceArea:'Combat Bible',evidenceLabel:e.status==='checked'?'Reviewed project record':'Atlas reference',body:e.body||[],warnings:e.warnings||[]}));
for(const id of editorial.systems){
 const f=featureMap.get(id);if(!f)throw Error('Missing required Bible feature '+id);if(entries.some(e=>e.id===id))continue;
 if(f.stale||f.status.design==='superseded')throw Error('Selected system is now stale/superseded: '+id);
 entries.push({id,title:f.name,category:['world','quests'].includes(f.category)?'world':f.category==='consequences'?'society':f.category,summary:f.summary,body:[f.player,f.design&&f.design!==f.summary?f.design:null].filter(Boolean),warnings:[...(f.limitations||[]),...(f.openQuestions||[])],stats:[],sources:[{path:'Atlas/data/features-'+f.category+'.js',record:id}],sourceArea:'Atlas · Player systems',evidenceLabel:f.status.implementation==='found'?'Documented system':'In development',status:f.status.implementation==='found'?'reference':'planned',date:f.lastReconciled?.date,school:'',tags:[f.group].filter(Boolean),related:[]});
}
const checkedIds=new Set(entries.map(e=>e.id));if(checkedIds.size!==entries.length)throw Error('Duplicate guide IDs');
const categories=[...combat.categories,{id:'world',title:'World & travel'},{id:'society',title:'People & consequences'}].filter((c,i,a)=>a.findIndex(x=>x.id===c.id)===i);
const characters=editorial.characters.map(c=>({...c,name:c.npc?current.names[c.npc]:c.name}));
if(characters.some(c=>!c.name))throw Error('Character mapping changed; review required');
const storySource=read(path.join(web,'story-guide.mjs'));
const decisionLiteral=storySource.match(/export const decisions\s*=\s*(\[[\s\S]*?\n\]);/);
if(!decisionLiteral)throw Error('Story decision schema changed');
const decisions=vm.runInNewContext('('+decisionLiteral[1]+')',{}, {timeout:1000});
const quests=current.quests.map(q=>({id:q.id,title:q.title,description:q.description,group:q.group,source:q.source}));
const findings=[...(registry['project-comparison']?.projectComparison?.findings||[]),...(registry['document-library']?.documentLibrary?.projectChecks?.checks||[]).filter(f=>!f.status.startsWith('Aligned')).map(f=>({id:'library-'+f.id,title:f.title,project:f.project,kind:f.status}))];
const data={edition:new Date().toISOString().slice(0,10),authority:editorial.authority,sourceDigest:digest,sourceGeneratedAt:current.generatedAt,hero:editorial.hero,regions:editorial.regions,characters,schools:editorial.schools,faq:editorial.faq,decisions,alignment:authored.alignment,chapters:current.chapters,quests,categories,entries,audit:editorial.decisions,unresolved:editorial.unresolved,sourceFindings:findings.map(f=>({id:f.id,title:f.title,project:f.project,kind:f.kind})),coverage:{combat:combat.entries.length,systems:entries.length-combat.entries.length,quests:quests.length,atlasFeatures:featureMap.size,sourceFiles:Object.keys(sources).length}};
// Source records, review notes and hashes live in the private checkout, never in dist.
const guidePath=path.join(root,'content/player-guide.json');
if(!fs.existsSync(guidePath))throw Error('Player guide curation is required before publication.');
const guide=json(guidePath);
const reviewedEntries=Array.isArray(guide)?guide:guide.entries;
const curated=new Map(reviewedEntries.map(e=>[e.id,e]));
for(const e of entries){
 const c=curated.get(e.id);
 if(!c||c.sourceFingerprint!==hash(JSON.stringify(e)))throw Error('Player copy needs review for changed source entry: '+e.id);
}
for(const id of curated.keys())if(!checkedIds.has(id))throw Error('Source entry removed; review player guide: '+id);
const publicEntries=entries.map(e=>curated.get(e.id)).filter(e=>e.publish).map(e=>({id:e.id,title:e.title,category:e.category,school:e.school||'',summary:e.summary,body:e.body,stats:e.stats||[],tags:e.tags||[],related:(e.related||[]).filter(id=>curated.get(id)?.publish)}));
const publicData={hero:editorial.hero,regions:editorial.regions.map(({id,name,place,image,description})=>({id,name,place,image,description})),characters:characters.map(({id,name,role,intro,detail})=>({id,name,role,intro,detail})),schools:editorial.schools,faq:editorial.faq,decisions:decisions.map(({id,title,good,evil,setup,consequence,after})=>({id,title,good,evil,setup,consequence,after})),quests:quests.map(({id,title,description})=>({id,title,description:description.replace('existing dungeon route','dungeon passage').replace('existing evacuation','evacuation')})),categories:categories.map(({id,title})=>({id,title})),entries:publicEntries};
fs.writeFileSync(path.join(root,'content/source-snapshot.json'),JSON.stringify(data));
fs.writeFileSync(path.join(root,'dist/game-data.json'),JSON.stringify(publicData));
fs.writeFileSync(path.join(root,'content/sync-status.json'),JSON.stringify({authority:data.authority,builtAt:new Date().toISOString(),sourceDigest:digest,coverage:data.coverage,playerEntries:publicEntries.length},null,2)+'\n');
fs.writeFileSync(baseline,JSON.stringify({reviewedAt:new Date().toISOString(),digest,sources},null,2)+'\n');
console.log(JSON.stringify({ok:true,digest,changedFiles:changed.length,coverage:data.coverage}));
