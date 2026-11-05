// Progressive enhancement for the static, fully readable handbook: search, filtering and deep links.
const fold=s=>String(s||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/co[-\s]?op(?:erative)?\b/g,'coop').replace(/new game\s*\+/g,'new game plus').replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const stem=w=>w.length>4&&w.endsWith('ies')?w.slice(0,-3)+'y':w.length>3&&w.endsWith('s')&&!w.endsWith('ss')?w.slice(0,-1):w;
const words=s=>fold(s).split(' ').filter(Boolean).map(stem);
const ignored=new Set('a an the to i me my our your do does did how can could would should is are am it at as of or on in with and for you someone something happens what where when why will want know about'.split(' '));
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function buildIndex(articles){
 return articles.map(a=>{const t=words(a.title),k=words(a.keywords),s=words(a.summary),b=words(a.body);
  return {a,phrase:fold(a.title),fields:[new Set(t),new Set(k),new Set(s),new Set(b)]};});
}
export function search(index,q){
 const phrase=fold(q),terms=[...new Set(words(q).filter(w=>!ignored.has(w)))].slice(0,20);
 if(!phrase)return index.map(r=>({a:r.a,score:0}));
 const use=terms.length?terms:words(q).slice(0,3),out=[],weights=[40,30,16,6];
 for(const r of index){
  let score=r.phrase===phrase?300:r.phrase.includes(phrase)?110:0,miss=false;
  for(const w of use){let best=0;
   r.fields.forEach((set,i)=>{if(set.has(w))best=Math.max(best,weights[i]);else if(w.length>=3&&i<3)for(const x of set)if(x.startsWith(w)){best=Math.max(best,weights[i]*.5);break;}});
   if(!best){miss=true;break;}score+=best;}
  if(!miss)out.push({a:r.a,score});
 }
 return out.sort((x,y)=>y.score-x.score||x.a.title.localeCompare(y.a.title));
}
export function initGuide(root=document.querySelector('[data-handbook]')){
 if(!root||root.dataset.enhanced==='1')return;
 const $=s=>root.querySelector(s),$$=s=>[...root.querySelectorAll(s)];
 const nodes=$$('[data-article]');if(!nodes.length)return;
 const articles=nodes.map(n=>({id:n.dataset.article,section:n.dataset.section,node:n,title:n.querySelector('[data-title]').textContent,summary:n.querySelector('[data-summary]').textContent,body:n.querySelector('[data-body]').textContent+' '+[...n.querySelectorAll('.hb-table')].map(t=>t.textContent).join(' '),keywords:n.dataset.keywords||''}));
 const byId=new Map(articles.map(a=>[a.id,a])),index=buildIndex(articles);
 const input=$('#handbook-query'),form=$('.hb-search'),clear=$('[data-clear-query]'),live=$('[data-live]'),found=$('[data-found]'),empty=$('[data-empty]'),toc=$('[data-toc]'),home=$('[data-hb-home]');
 root.dataset.enhanced='1';input.maxLength=180;
 const mq=matchMedia('(min-width:981px)');if(!mq.matches)toc.open=false;
 const sectionName=id=>$(`[data-sec="${id}"] h2`)?.textContent||'';
 function openArticle(id,scroll=true){const a=byId.get(id);if(!a)return false;a.node.open=true;if(scroll){a.node.scrollIntoView({block:'start'});a.node.querySelector('summary').focus({preventScroll:true});}return true;}
 function apply(q,{push=false}={}){
  q=q.slice(0,180);const hits=q.trim()?search(index,q):null,set=hits&&new Set(hits.map(h=>h.a.id));
  for(const a of articles){a.node.hidden=!!set&&!set.has(a.id);}
  for(const li of $$('[data-toc-art]'))li.hidden=!!set&&!set.has(li.dataset.tocArt);
  for(const s of $$('[data-sec]')){const any=articles.some(a=>a.section===s.dataset.sec&&!a.node.hidden);s.hidden=!any;}
  for(const s of $$('[data-toc-sec]'))s.hidden=!articles.some(a=>a.section===s.dataset.tocSec&&!a.node.hidden);
  if(home)home.hidden=!!set;
  clear.hidden=!input.value;empty.hidden=!hits||hits.length>0;
  if(hits&&hits.length){
   found.hidden=false;
   found.innerHTML=`<p class="hb-kicker">Search results</p><h2>${hits.length} ${hits.length===1?'article':'articles'} for “${E(q.trim())}”</h2><ol>${hits.slice(0,8).map(h=>`<li><a href="#read-${E(h.a.id)}" data-open><span>${E(sectionName(h.a.section))}</span><strong>${E(h.a.title)}</strong><em>${E(h.a.summary)}</em></a></li>`).join('')}</ol>`;
   if(hits.length<=3)for(const h of hits)h.a.node.open=true;
  }else{found.hidden=true;found.innerHTML='';}
  live.textContent=hits?`${hits.length} ${hits.length===1?'article':'articles'} matching ${q.trim()}.`:'';
  const url=new URL(location.href);if(q.trim())url.searchParams.set('q',q.trim());else url.searchParams.delete('q');url.searchParams.delete('entry');
  history[push?'pushState':'replaceState']({}, '', url.pathname+url.search+(q.trim()?'':url.hash));
 }
 let timer;
 input.addEventListener('input',()=>{clear.hidden=!input.value;clearTimeout(timer);timer=setTimeout(()=>apply(input.value),120);});
 form.addEventListener('submit',e=>{e.preventDefault();clearTimeout(timer);apply(input.value);if(!found.hidden)found.scrollIntoView({block:'start'});});
 for(const b of $$('[data-clear-query]'))b.addEventListener('click',()=>{input.value='';apply('');input.focus();});
 root.addEventListener('click',e=>{const a=e.target.closest?.('a[data-open]');if(!a)return;const id=decodeURIComponent(a.getAttribute('href').replace(/^#read-/,''));
  const art=byId.get(id);if(!art)return;e.preventDefault();if(art.node.hidden&&input.value){input.value='';apply('');}openArticle(id);history.replaceState({},'',location.pathname+location.search+'#read-'+id);});
 $('[data-expand]').addEventListener('click',()=>articles.forEach(a=>{if(!a.node.hidden)a.node.open=true;}));
 $('[data-collapse]').addEventListener('click',()=>articles.forEach(a=>a.node.open=false));
 document.addEventListener('keydown',e=>{if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||e.key!=='/'||e.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;e.preventDefault();input.focus();input.select();});
 addEventListener('hashchange',()=>{const id=decodeURIComponent(location.hash.replace(/^#read-/,''));if(location.hash.startsWith('#read-'))openArticle(id);});
 // Initial state: ?q= search, ?entry= (legacy deep link), or #read- hash.
 const p=new URLSearchParams(location.search),q0=(p.get('q')||'').slice(0,180);
 if(q0){input.value=q0;apply(q0);}
 const entry=p.get('entry')||(location.hash.startsWith('#read-')?decodeURIComponent(location.hash.slice(6)):'');
 if(entry&&byId.has(entry))requestAnimationFrame(()=>openArticle(entry));
}
if(typeof document!=='undefined')initGuide();
