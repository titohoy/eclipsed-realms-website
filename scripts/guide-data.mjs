// Player guide source: content/guide-v2.json (private). Only the allowlisted player fields below ever reach dist.
import fs from 'node:fs';
import path from 'node:path';
export const guidePath=root=>path.join(root,'content/guide-v2.json');
export function loadGuide(root){return JSON.parse(fs.readFileSync(guidePath(root),'utf8').replace(/^\uFEFF/,''));}
const pairs=v=>(v||[]).map(p=>p.map(String));
// Explicit allowlist: evidence and any other private field are dropped here.
export function publicGuide(g){
 return {start:{title:String(g.start.title),intro:String(g.start.intro),steps:g.start.steps.map(([id,title,note])=>({id,title,note}))},
  sections:g.sections.map(s=>({id:s.id,title:s.title,blurb:s.blurb,intro:s.intro,icon:s.icon,articles:s.articles.map(a=>({id:a.id,title:a.title,summary:a.summary,body:[...a.body],numbers:pairs(a.numbers),controls:pairs(a.controls),related:[...a.related],keywords:a.keywords||''}))}))};
}
// Compact index for other pages (link targets only).
export function guideIndex(g){return g.sections.flatMap(s=>s.articles.map(a=>({id:a.id,title:a.title,section:s.id,school:/^magic\.(holy|blood|dark)$/.test(a.id)?a.id.slice(6,7).toUpperCase()+a.id.slice(7):''})));}
