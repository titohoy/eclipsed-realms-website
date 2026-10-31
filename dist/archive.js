const controls={search:document.getElementById('archive-search'),category:document.getElementById('archive-category'),source:document.getElementById('archive-source'),spoilers:document.getElementById('archive-spoilers')};
const results=document.getElementById('archive-results');
const element=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
function render(){
  const q=controls.search.value.trim().toLocaleLowerCase();
  const selected=ARCHIVE_DATA.records.filter(r=>(!controls.category.value||r.category===controls.category.value)&&(!controls.source.value||r.source===controls.source.value));
  const visible=selected.filter(r=>(controls.spoilers.checked||!r.spoiler)&&(!q||[r.title,r.sourceTitle,r.category,...r.paragraphs,...r.notes].join(' ').toLocaleLowerCase().includes(q)));
  results.replaceChildren();
  document.getElementById('archive-count').textContent=`${visible.length} of ${ARCHIVE_DATA.records.length} entries shown.${controls.spoilers.checked?' Story spoilers are visible.':' Story spoilers are hidden. Enable them to explore the full narrative and playbill.'}`;
  if(!visible.length)results.append(element('p','No entries match these filters. Try a broader search, another collection, or enable story spoilers.','empty-state'));
  for(const r of visible){
    const detail=element('details',undefined,'archive-record');detail.id=r.id;
    const summary=element('summary');summary.append(element('span',r.category+' · '+r.sourceTitle,'record-source'),element('strong',r.title));
    const body=element('div',undefined,'record-body');
    for(const note of r.notes)body.append(element('p',note,'small'));
    if(r.conflicts.length){
      const box=element('div',undefined,'record-note');box.append(element('strong','Current rules and open questions'));
      for(const id of r.conflicts){
        const c=ARCHIVE_DATA.conflicts.find(c=>c.id===id);const p=element('p');p.append(element('strong',c.topic+'. '),document.createTextNode(c.decision+' '));
        const link=element('a','Review →');link.href='merge-review.html#'+id;p.append(link);box.append(p);
      }
      body.append(box);
    }
    body.append(element('p','Preserved source text','record-label'));
    for(const p of r.paragraphs)body.append(element('p',p));
    detail.append(summary,body);results.append(detail);
  }
  renderGallery();
}
function renderGallery(){
  const gallery=document.getElementById('archive-gallery');gallery.replaceChildren();
  for(const g of ARCHIVE_DATA.gallery.filter(g=>controls.spoilers.checked||!g.spoiler)){
    const figure=element('figure');const link=element('a');link.href=g.src;link.target='_blank';link.rel='noopener';link.setAttribute('aria-label','Open reference: '+g.alt);
    const img=element('img');img.src=g.src;img.alt=g.alt;img.loading='lazy';link.append(img);
    figure.append(link,element('figcaption',g.kind+' · '+g.source));gallery.append(figure);
  }
}
document.getElementById('archive-filter').addEventListener('submit',e=>e.preventDefault());
controls.search.addEventListener('input',render);
for(const key of ['category','source','spoilers'])controls[key].addEventListener('change',render);
render();
