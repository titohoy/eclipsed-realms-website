export function initManuscript(root = document.querySelector('[data-ms-manuscript]')) {
  if (!root || root.dataset.msInitialized) return;
  root.dataset.msInitialized = 'true';
  const $ = s => root.querySelector(s);
  const $$ = s => [...root.querySelectorAll(s)];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  root.classList.add('ms-ready');
  $$('[data-ms-controls]').forEach(el => { el.hidden = false; });

  // New Game starts with twelve Core Trait points, with a five-point cap.
  const traits = {strength: 3, agility: 2, stamina: 3, vitality: 3, charisma: 1};
  const effects = {
    strength: n => `+${15*n} Attack Power`,
    agility: n => `+${5*n} Stealth`,
    stamina: n => `+${5*n}% maximum Stamina`,
    vitality: n => `+${5*n}% maximum Health`,
    charisma: n => `+${5*n} starting social standing`
  };
  const drawTraits = (announce = false, shape = null) => {
    const left = 12 - Object.values(traits).reduce((a,b) => a+b, 0);
    $('[data-ms-points-left]').textContent = Math.max(0, left);
    const points = (shape || Object.values(traits)).map((value, i) => {
      const angle = (i*72-90)*Math.PI/180;
      const radius = 24 + value*15.2;
      return `${(200+Math.cos(angle)*radius).toFixed(2)},${(148+Math.sin(angle)*radius).toFixed(2)}`;
    });
    $('[data-ms-trait-polygon]').setAttribute('points', points.join(' '));
    $$('[data-ms-trait]').forEach(row => {
      const key = row.dataset.msTrait, value = traits[key];
      row.querySelector('[data-ms-trait-value]').value = String(value);
      row.querySelector('[data-ms-trait-effect]').textContent = effects[key](value);
      row.querySelector('[data-ms-trait-change="-1"]').disabled = value === 0;
      row.querySelector('[data-ms-trait-change="1"]').disabled = value === 5 || left === 0;
    });
    if (announce) $('[data-ms-build-status]').textContent = left ? `${left} of 12 points remain. Spend every point before beginning a New Game.` : 'All 12 points assigned. These are starting bonuses, not your full character statistics.';
  };
  $$('[data-ms-trait-change]').forEach(button => button.addEventListener('click', () => {
    const key = button.closest('[data-ms-trait]').dataset.msTrait;
    const delta = Number(button.dataset.msTraitChange);
    const total = Object.values(traits).reduce((a,b) => a+b, 0);
    if (traits[key]+delta < 0 || traits[key]+delta > 5 || total+delta > 12) return;
    traits[key] += delta;
    drawTraits(true);
  }));
  drawTraits();

  const facing = $('#ms-guard-facing');
  let guardAngle = 0, guardState = null;
  const setFacing = angle => {
    guardAngle = angle;
    $('[data-ms-guard-turn]').style.transform = `rotate(${angle}deg)`;
    $('[data-ms-facing-value]').textContent = `${Math.round(angle)}°`;
    const guarded = Math.abs(angle) <= 45;
    if (guarded === guardState) return;
    guardState = guarded;
    $('.ms-guard').classList.toggle('is-exposed', !guarded);
    $('#ms-guard-result').textContent = guarded
      ? 'Facing the attack: the hit is inside your guard. A shield adds +300 Armor for the blocked hit.'
      : 'The attack is outside your front 90° cone. An ordinary block gives no guard bonus from this direction.';
  };
  facing.addEventListener('input', () => setFacing(Number(facing.value)));

  let school = 'Holy', reliefStep = 1;
  const schoolCosts = {
    Holy: 'Holy spells spend Stamina.',
    Blood: 'Most Blood spells spend Stamina and a percentage of maximum Health. You must have more Health than the sacrifice.',
    Dark: 'Dark spells add Dark Points. Reaching 100 permanently corrupts your character; lowering them afterward does not cure it.'
  };
  const drawRelief = () => {
    const plate = $('.ms-relief-plate');
    plate.dataset.msSchool = school;
    plate.dataset.msReliefStep = String(reliefStep);
    $$('[data-ms-school-choice]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.msSchoolChoice === school)));
    $$('[data-ms-relief-choice]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.msReliefChoice) === reliefStep)));
    const steps = [
      ['01 / WIELD', 'Begin with the right school.', `Wield a ${school} Relief. The Relief in your hands and the deployed board must belong to the same school.`],
      ['02 / DEPLOY', 'Give the power a place.', `Deploy the ${school} Relief in front of you. It settles and grows, spreading its influence. You can deploy one board per school.`],
      ['03 / ENTER', 'Stand within the influence.', `Hold the matching ${school} Relief inside a deployed, available ${school} board’s influence. This meets the placement conditions; your spell still needs to be unlocked, ready and affordable.`]
    ];
    const [number,title,copy] = steps[reliefStep-1];
    $('[data-ms-relief-number]').textContent = number;
    $('[data-ms-relief-title]').textContent = title;
    $('[data-ms-relief-copy]').textContent = copy;
    $('[data-ms-price-school]').textContent = `${school}’s price`;
    $('[data-ms-price-copy]').textContent = schoolCosts[school];
    $('[data-ms-relief-status]').textContent = `${title} ${copy} ${schoolCosts[school]}`;
  };
  $$('[data-ms-school-choice]').forEach(button => button.addEventListener('click', () => {school=button.dataset.msSchoolChoice;drawRelief();}));
  $$('[data-ms-relief-choice]').forEach(button => button.addEventListener('click', () => {reliefStep=Number(button.dataset.msReliefChoice);drawRelief();}));

  const route = $('#ms-route-progress');
  const stops = [[91,266],[220,180],[375,230],[523,87]];
  const stopNames = ['first','second','third','fourth'];
  let discovered = 0;
  const drawMap = (position, isTravel = false) => {
    const isDiscovery = position > discovered;
    discovered = Math.max(discovered, position);
    route.value = String(position);
    $('[data-ms-route-position]').textContent = `At the ${stopNames[position]} waypoint`;
    $('[data-ms-map-traveller]').style.transform = `translate(${stops[position][0]}px,${stops[position][1]}px)`;
    $('[data-ms-road-progress]').style.strokeDashoffset = String(1-discovered/3);
    $$('[data-ms-reveal-stop]').forEach(c => {c.style.opacity = Number(c.dataset.msRevealStop) <= discovered ? '1' : '0';});
    $$('[data-ms-map-stop]').forEach(g => g.classList.toggle('is-discovered', Number(g.dataset.msMapStop) <= discovered));
    $$('[data-ms-travel-to]').forEach(button => {
      const n = Number(button.dataset.msTravelTo);
      button.disabled = n > discovered;
      button.setAttribute('aria-pressed', String(n === position));
    });
    $('[data-ms-map-status]').textContent = isTravel
      ? `Returned to the ${stopNames[position]} discovered waypoint through the Doll’s travel map. Discovery rewards are earned once.`
      : isDiscovery
        ? `You discovered the ${stopNames[position]} waypoint. A new waypoint earns 100 XP once and becomes a travel destination when an arrival point is available.`
        : `At the ${stopNames[position]} waypoint. ${discovered+1} of four waypoints are discovered on this sketch. Each player keeps their own discoveries.`;
  };
  route.addEventListener('input', () => drawMap(Number(route.value)));
  $$('[data-ms-travel-to]').forEach(button => button.addEventListener('click', () => drawMap(Number(button.dataset.msTravelTo), true)));

  const ledger = {
    person: ['Personal relationship', 'One person’s regard.', 'Help or harm someone and their relationship with you can change. Their feelings are not a measure of an entire faction’s standing.', 'In co-op, each player has their own relationships.'],
    faction: ['Faction reputation', 'The view of a wider group.', 'A faction responds to witnessed conduct, conversations and story events. Its standing with you is separate from an individual friendship.', 'Each player keeps their own faction standing. Starting Charisma contributes to it.'],
    voice: ['Personality', 'The way you choose to speak.', 'Bold, Witty and Empathetic are separate scores. Styled replies can develop them, and people can respond differently to your tone.', 'A bold reply is a style of speaking. It is not automatically an evil act.'],
    witness: ['Witness & identification', 'An act seen. A person recognized.', 'A witness must see what happened and recognize you to attach a personal consequence to you. Distance, cover, facing and concealment can affect that recognition.', 'Darkness alone does not reliably hide violent acts or Dark casting.']
  };
  const setLedger = key => {
    $('.ms-ledger').dataset.msLedger=key;
    $$('[data-ms-ledger-choice]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.msLedgerChoice===key)));
    const [kicker,title,copy,rule]=ledger[key];
    $('[data-ms-ledger-kicker]').textContent=kicker;
    $('[data-ms-ledger-title]').textContent=title;
    $('[data-ms-ledger-copy]').textContent=copy;
    $('[data-ms-ledger-rule]').textContent=rule;
    $('[data-ms-ledger-status]').textContent=`${kicker}. ${title} ${copy} ${rule}`;
  };
  $$('[data-ms-ledger-choice]').forEach(button => button.addEventListener('click', () => setLedger(button.dataset.msLedgerChoice)));

  let party = 1;
  const drawParty = () => {
    const free = 4-party;
    $$('[data-ms-camp-seat]').forEach(g => g.classList.toggle('ms-empty-seat', Number(g.dataset.msCampSeat) >= party));
    $('[data-ms-camp-count]').textContent=`${party} OF 4 HUMAN PLAYER SPACES`;
    $$('[data-ms-party-add]').forEach(b => { b.disabled=Number(b.dataset.msPartyAdd)>free; });
    $('[data-ms-party-status]').textContent = free===0
      ? 'The campaign is full with four human players. Companions, pets and summons do not use player spaces.'
      : free===1
        ? 'Three players are present. One space remains; a local pair needs two free spaces to join together.'
        : `${party===1?'One host is':`${party} players are`} present. ${free} human player spaces remain, enough for a local pair.`;
  };
  $$('[data-ms-party-add]').forEach(button => button.addEventListener('click', () => {
    party=Math.min(4,party+Number(button.dataset.msPartyAdd));
    drawParty();
  }));
  $('[data-ms-party-reset]').addEventListener('click', () => {party=1;drawParty();});
  drawParty();

  // ---------------------------------------------------------------------
  // The book: pages turn as the document scrolls (progressive enhancement).
  // ---------------------------------------------------------------------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = t => t * t * (3 - 2 * t);
  const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const chapterEls = $$('[data-ms-chapter]');
  const coverEl = $('.ms-cover'), shellEl = $('.ms-book'), colophonEl = $('.ms-colophon');
  if (!chapterEls.length || !coverEl || !shellEl || !colophonEl || !$('.ms-index-inner')) return;
  const LN = chapterEls.length;

  // Controls tables: present each binding as an engraved key cap / pad button (text content unchanged).
  $$('.ms-controls-table tbody td').forEach(td => {
    const pad = td.cellIndex === 2, raw = td.textContent.trim();
    td.dataset.l = pad ? 'Gamepad' : 'Keyboard & mouse';
    if (!raw || raw === '—') { td.classList.add('ms-none'); return; }
    const groups = raw.split(/,\s+/).map(g => /^(W A S D|1 2 3 4 5)$/.test(g) ? g.split(' ') : [g]);
    td.textContent = '';
    groups.forEach((g, gi) => {
      if (gi) td.append(', ');
      g.forEach((t, ti) => {
        if (ti) td.append(' ');
        const long = t.length > 16 || /\bfor\b/.test(t);
        if (long || (!pad && /^mouse$/i.test(t))) td.append(t);
        else td.append(mk(pad ? 'span' : 'kbd', pad ? 'ms-pad' : 'ms-key', t));
      });
    });
  });

  // "Skip book view": ?view=plain keeps the original reading layout (the no-JS markup) with the widgets still working.
  if (new URLSearchParams(location.search).get('view') === 'plain') {
    const back = new URL(location.href); back.searchParams.delete('view');
    root.classList.add('ms-plain');
    root.prepend(mk('p', 'ms-plainbar', `Plain reading layout. <a href="${back.pathname}${back.search}${back.hash}">Return to the book view</a>`));
    root.querySelectorAll('.ms-page,.ms-cover,.ms-colophon').forEach(el => el.classList.add('is-visible'));
    return;
  }

  // Tighten the Relief drawing's viewBox so the artwork fills the plate (original geometry untouched).
  const reliefSvg = $('.ms-relief-drawing svg');
  if (reliefSvg && reliefSvg.getAttribute('viewBox') === '0 0 620 360') reliefSvg.setAttribute('viewBox', '34 56 564 276');
  // The long drawing label becomes a real caption under the art so it stays readable at any size.
  const reliefLabel = reliefSvg && reliefSvg.querySelector('text');
  if (reliefLabel) {
    const cap = mk('p', 'ms-svg-label'); cap.setAttribute('aria-hidden', 'true'); cap.textContent = reliefLabel.textContent;
    reliefSvg.after(cap); reliefLabel.style.display = 'none';
  }
  const roman = n => { let r = ''; [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']].forEach(([v, c]) => { while (n >= v) { r += c; n -= v; } }); return r; };
  const makePage = (side, nodes, cls = '') => {
    const page = mk('div', `ms-bpage ${cls}`);
    page.dataset.side = side;
    const scroller = mk('div', 'ms-bpage-scroll');
    const body = mk('div', 'ms-bpage-body');
    nodes.forEach(n => n && body.append(n));
    scroller.append(body);
    page.append(scroller, mk('span', 'ms-pnum'));
    return page;
  };
  const wrapDiv = (cls, nodes) => { const d = mk('div', cls); nodes.forEach(n => n && d.append(n)); return d; };

  const inner = $('.ms-index-inner');
  const flourish = coverEl.querySelector('.ms-flourish');
  const frontEl = coverEl.querySelector('.ms-frontispiece'), coverCopy = coverEl.querySelector('.ms-cover-copy');
  // Index left page: the existing compass art and reading guidance, reused (no new copy or images).
  let compass = null;
  const frontSvg = frontEl && frontEl.querySelector('svg');
  if (frontSvg) {
    compass = mk('div', 'ms-index-compass');
    const c = frontSvg.cloneNode(true);
    c.removeAttribute('id'); c.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    c.setAttribute('aria-hidden', 'true'); c.setAttribute('focusable', 'false');
    compass.append(c);
  }
  const noteEl = coverEl.querySelector('.ms-cover-note');
  const noteClone = noteEl ? noteEl.cloneNode(true) : null;
  if (noteClone) noteClone.classList.add('ms-index-note');
  const indexIntro = wrapDiv('ms-index ms-index-intro', [inner.querySelector('.ms-kicker'), flourish ? flourish.cloneNode(true) : null, compass, noteClone, inner.querySelector('.ms-reading-progress'), inner.querySelector('.ms-index-position'), inner.querySelector('.ms-guide-link')]);
  const indexList = wrapDiv('ms-index ms-index-list', [inner.querySelector('nav')]);
  const lessonIds = chapterEls.map(s => s.id);

  // Lesson content is split into atoms (paragraphs, notes, rows) that are paginated at layout time.
  const WRAPPED = /(^|\s)(ms-prose|ms-notes-grid|ms-shared-record)(\s|$)/, SPLIT = /(^|\s)(ms-two-column|ms-combat-layout|ms-travel-layout)(\s|$)/;
  const flatten = (parent, out, wcls) => {
    [...parent.children].forEach(el => {
      if (SPLIT.test(el.className)) flatten(el, out, null);
      else if (WRAPPED.test(el.className)) flatten(el, out, el.className);
      else out.push({el, wcls, keep: /^(H[1-6]|HEADER)$/.test(el.tagName)});
    });
    return out;
  };
  const lessons = chapterEls.map((sec, i) => {
    const plate = sec.querySelector('figure.ms-plate');
    let frame = null;
    if (plate) {
      frame = mk('div', 'ms-frame');
      frame.append(mk('span', 'ms-frame-tag', `Plate ${roman(i + 1)}`), plate);
    }
    return {frame, atoms: flatten(sec, [], null)};
  });
  const colophonKids = [...colophonEl.children];
  let pages = [], pageInfo = [], lessonPlate = [];

  const measureHost = mk('div', 'ms-half ms-half-r ms-measure');
  measureHost.setAttribute('aria-hidden', 'true');
  const fits = page => {
    const sc = page.firstChild, body = sc.firstChild, last = body.lastElementChild;
    if (!last) return true;
    return last.getBoundingClientRect().bottom <= sc.getBoundingClientRect().bottom - parseFloat(getComputedStyle(sc).paddingBottom) + 0.5;
  };
  const place = (lesson, a) => {
    if (!a.wcls) { lesson.append(a.el); return; }
    const w = lesson.lastElementChild;
    if (w && w.dataset.wk === a.wcls) w.append(a.el);
    else { const nw = mk('div', a.wcls); nw.dataset.wk = a.wcls; nw.append(a.el); lesson.append(nw); }
  };
  const unplace = a => { const par = a.el.parentElement; a.el.remove(); if (a.wcls && par && !par.children.length) par.remove(); };

  function buildPages() {
    pages = []; pageInfo = []; lessonPlate = [];
    const add = (p, info) => { pages.push(p); pageInfo.push(info || {lesson: -1}); };
    add(makePage('l', [frontEl], 'ms-p-front'));
    add(makePage('r', [coverCopy], 'ms-p-cover'));
    add(makePage('l', [indexIntro], 'ms-p-index-intro'), {lesson: -1, index: true});
    const indexRight = makePage('r', [indexList], 'ms-p-index');
    indexRight.id = 'ms-index';
    add(indexRight, {lesson: -1, index: true});
    book.append(measureHost);
    lessons.forEach((L, i) => {
      lessonPlate[i] = pages.length;
      const plateLess = !L.frame;
      if (!plateLess) add(makePage('l', [L.frame], 'ms-p-plate'), {lesson: i});
      const paginate = compact => {
        const queue = L.atoms.slice(), made = [];
        while (queue.length || !made.length) {
          const n = made.length, side = (n % 2 === 0) !== plateLess ? 'r' : 'l';
          const page = makePage(side, [], `ms-p-lesson${n ? ' ms-p-cont' : ''}`);
          if (n === 0) page.id = lessonIds[i];
          measureHost.append(page);
          const lesson = mk('div', `ms-lesson${compact ? ' is-compact' : ''}`);
          page.firstChild.firstChild.append(lesson);
          const placed = [];
          while (queue.length) {
            const a = queue.shift();
            place(lesson, a); placed.push(a);
            if (placed.length > 1 && !fits(page)) {
              unplace(a); placed.pop(); queue.unshift(a);
              while (placed.length > 1 && placed[placed.length - 1].keep) { const k = placed.pop(); unplace(k); queue.unshift(k); }
              break;
            }
          }
          page.remove();
          made.push({page, info: {lesson: i, cont: n > 0}});
        }
        return made;
      };
      let made = paginate(false);
      if (made.length > 1) {
        const tight = paginate(true);
        made = tight.length < made.length ? tight : paginate(false);
      }
      made.forEach(m => add(m.page, m.info));
      if (!single && pages.length % 2) add(makePage('r', [], 'ms-p-blank'), {lesson: i, cont: true});
    });
    measureHost.remove();
    add(makePage('l', colophonKids.filter(n => n.tagName !== 'A'), 'ms-p-end'));
    add(makePage('r', [wrapDiv('ms-end-links', colophonKids.filter(n => n.tagName === 'A'))], 'ms-p-end-links'));
    pages.forEach((p, j) => { p.querySelector('.ms-pnum').textContent = j > 0 && !p.classList.contains('ms-p-blank') ? String(j) : ''; });
  }

  const scrollArea = mk('section', 'ms-bookscroll');
  scrollArea.setAttribute('aria-label', 'How to play: an illustrated book. Scroll to turn the pages.');
  const stage = mk('div', 'ms-stage');
  const bookWrap = mk('div', 'ms-bookwrap');
  const book = mk('div', 'ms-book3d');
  book.setAttribute('role', 'group');
  book.setAttribute('aria-roledescription', 'book');
  const spreadbox = mk('div', 'ms-spreadbox');
  const gutter = mk('div', 'ms-gutter'); gutter.setAttribute('aria-hidden', 'true');
  book.append(mk('div', 'ms-board'), mk('div', 'ms-edge ms-edge-l'), mk('div', 'ms-edge ms-edge-r'), mk('div', 'ms-edge ms-edge-b'), spreadbox, gutter);
  const hud = mk('div', 'ms-hud', '<button type="button" class="ms-hud-btn" data-ms-prev aria-label="Previous page"><span aria-hidden="true">←</span><span class="ms-hud-lbl" aria-hidden="true">Previous</span></button><div class="ms-hud-mid"><span class="ms-hud-text" data-ms-hud-text role="status" aria-live="polite"></span><span class="ms-hud-bar" aria-hidden="true"><i data-ms-hud-bar></i></span></div><button type="button" class="ms-hud-btn" data-ms-next aria-label="Next page"><span class="ms-hud-lbl" aria-hidden="true">Next</span><span aria-hidden="true">→</span></button>');
  bookWrap.append(book, hud);
  stage.append(bookWrap);
  scrollArea.append(stage);
  coverEl.before(scrollArea);
  coverEl.remove(); shellEl.remove();
  root.classList.add('ms-book-on');

  const edgeL = book.querySelector('.ms-edge-l'), edgeR = book.querySelector('.ms-edge-r');
  const hudText = hud.querySelector('[data-ms-hud-text]'), hudBar = hud.querySelector('[data-ms-hud-bar]');
  const prevBtn = hud.querySelector('[data-ms-prev]'), nextBtn = hud.querySelector('[data-ms-next]');
  const progressBar = indexIntro.querySelector('[data-ms-reading-progress]'), positionEl = indexIntro.querySelector('[data-ms-index-position]');
  const indexLinks = [...indexList.querySelectorAll('[data-ms-index]')];
  const indexUnit = () => single ? 2 : 1;
  const RKEY = 'er-ms-resume';
  let savedLesson = -1, resumeDismissed = !!location.hash, saveT = 0, curLoc = {lesson: -1, index: false};
  try { const v = JSON.parse(localStorage.getItem(RKEY) || 'null'); if (v && Number.isInteger(v.lesson) && v.lesson >= 0 && v.lesson < LN) savedLesson = v.lesson; } catch (_) {}
  addEventListener('pagehide', () => { if (curLoc.lesson >= 0) saveResume(curLoc.lesson); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && curLoc.lesson >= 0) saveResume(curLoc.lesson); });
  const saveResume = l => { try { localStorage.setItem(RKEY, JSON.stringify({lesson: l, t: Date.now()})); } catch (_) {} };

  // Always-reachable contents: bookmark ribbon tabs (Contents + every lesson).
  const tabs = mk('nav', 'ms-tabs');
  tabs.setAttribute('aria-label', 'Contents: jump to a lesson');
  const lessonTitle = k => {
    const a = indexLinks[k], sm = a && a.querySelector('small');
    if (a && sm && sm.previousSibling) return sm.previousSibling.textContent;
    const h = chapterEls[k].querySelector('h2');
    return h ? h.textContent.replace(/\s+/g, ' ').trim() : `Lesson ${k + 1}`;
  };
  const shortTitle = s => { const w = String(s).replace(/&.*/, '').trim().split(/\s+/); const pick = /^(your|playing|first|the)$/i.test(w[0]) && w[1] ? w[1] : w[0]; return pick.charAt(0).toUpperCase() + pick.slice(1); };
 const tabLinks = [['ms-index', '☰', 'Contents', 'Contents'], ...lessonIds.map((id, k) => [id, String(k + 1), shortTitle(lessonTitle(k)), `Lesson ${k + 1}: ${lessonTitle(k)}`])].map(([id, n, title, label]) => {
    const a = mk('a', 'ms-tab', `<span class="ms-tab-n" aria-hidden="true">${n}</span><span class="ms-tab-t">${title}</span>`);
    a.href = `#${id}`; a.setAttribute('aria-label', label); a.title = label;
    tabs.append(a); return a;
  });

  // Quiet tools row: keyboard hint, plain layout link, demo pause.
  const coarse = matchMedia('(pointer: coarse)');
  const tools = mk('div', 'ms-tools');
  const hint = mk('span', 'ms-tool-hint');
  const setHint = () => { hint.textContent = coarse.matches ? 'Swipe left or right to turn pages.' : `Turn pages with the ← → keys, press 1–${Math.min(9, LN)} for a lesson, or scroll.`; };
  setHint(); coarse.addEventListener('change', setHint);
  const plainLink = mk('a', 'ms-tool', 'Skip book view<span class="ms-visually-hidden"> and read as a plain page</span>');
  plainLink.href = '?view=plain';
  plainLink.addEventListener('click', e => {
    e.preventDefault();
    const u = new URL(location.href); u.searchParams.set('view', 'plain');
    u.hash = curLoc.lesson >= 0 ? `#${lessonIds[curLoc.lesson]}` : '';
    location.href = u.href;
  });
  const demoToggle = mk('button', 'ms-tool ms-demo-toggle', 'Pause demos');
  demoToggle.type = 'button'; demoToggle.setAttribute('aria-pressed', 'false');
  tools.append(hint, plainLink, demoToggle);

  const resume = mk('div', 'ms-resume');
  resume.hidden = true; resume.setAttribute('role', 'status');
  if (savedLesson >= 0) {
    resume.innerHTML = `<span>Welcome back.</span><button type="button" class="ms-resume-go">Continue from Lesson ${savedLesson + 1}</button><button type="button" class="ms-resume-x" aria-label="Dismiss">×</button>`;
    resume.querySelector('.ms-resume-go').addEventListener('click', () => { resumeDismissed = true; resume.hidden = true; goUnit(single ? lessonPlate[savedLesson] : lessonPlate[savedLesson] >> 1); });
    resume.querySelector('.ms-resume-x').addEventListener('click', () => { resumeDismissed = true; resume.hidden = true; });
  }
  stage.prepend(tools, tabs);
  stage.append(resume);
  let onSpreadChange = () => {};

  let single = false, fade = false, N = 0, turnPx = 700, top = 0, P = 0, lastRender = null;
  let spreadCount = 0, lastBW = 0, lastBH = 0, leaves = [], units = [], baseL = null, baseR = null, activeKey = null, shownUnit = -1;
  const half = side => mk('div', `ms-half ms-half-${side}`);

  function mount() {
    const prev = pageInfo.length ? {u: Math.round(P), single, N, lesson: curLoc.lesson, index: curLoc.index, was: scrollY >= top - innerHeight * 0.6 && scrollY <= top + (N + 1) * turnPx} : null;
    cancelTurn();
    single = innerWidth < 780; fade = reducedMotion.matches;
    book.classList.toggle('is-single', single);
    book.classList.toggle('is-fade', fade);
    pages.forEach(p => p.remove());
    spreadbox.replaceChildren();
    buildPages();
    spreadCount = pages.length >> 1;
    leaves = []; units = []; baseL = baseR = null; activeKey = null; shownUnit = -1; lastRender = null;
    if (fade) {
      const count = single ? pages.length : spreadCount;
      for (let u = 0; u < count; u++) {
        const unit = mk('div', 'ms-unit'); unit.style.zIndex = String(u);
        if (single) { const h = half('r'); h.append(pages[u]); unit.append(h); }
        else { const l = half('l'), r = half('r'); l.append(pages[2 * u]); r.append(pages[2 * u + 1]); unit.append(l, r); }
        spreadbox.append(unit);
        units.push({el: unit, vis: null, op: -1});
      }
      N = count - 1;
    } else {
      const count = single ? pages.length - 1 : spreadCount - 1;
      baseR = half('r'); baseR.append(pages[pages.length - 1]);
      if (!single) { baseL = half('l'); baseL.append(pages[0]); spreadbox.append(baseL); }
      spreadbox.append(baseR);
      for (let i = 0; i < count; i++) {
        const wrap = mk('div', 'ms-leafwrap');
        const castL = mk('div', 'ms-castbox ms-castbox-l', '<i></i>'), castR = mk('div', 'ms-castbox ms-castbox-r', '<i></i>');
        const leaf = mk('div', 'ms-leaf');
        const front = mk('div', 'ms-face ms-front'), back = mk('div', 'ms-face ms-back');
        const shF = mk('div', 'ms-shade'), shB = mk('div', 'ms-shade');
        let frontPage, backPage;
        if (single) { frontPage = pages[i]; backPage = mk('div', 'ms-bpage ms-blank'); backPage.dataset.side = 'l'; }
        else { frontPage = pages[2 * i + 1]; backPage = pages[2 * i + 2]; }
        front.append(frontPage, shF); back.append(backPage, shB);
        leaf.append(front, back);
        wrap.append(castL, castR, leaf);
        spreadbox.append(wrap);
        leaves.push({wrap, leaf, front, back, castL: castL.firstChild, castR: castR.firstChild, shF, shB, p: -1, turned: null, near: null});
      }
      N = count;
    }
    lastBW = book.offsetWidth; lastBH = book.offsetHeight;
    fitPlates();
    measure();
    if (prev && prev.was) {
      let nu = prev.u;
      if (prev.single !== single || prev.N !== N) {
        if (prev.lesson >= 0) nu = single ? lessonPlate[prev.lesson] : lessonPlate[prev.lesson] >> 1;
        else if (prev.index) nu = indexUnit();
        else nu = prev.u >= prev.N ? N : 0;
      }
      scrollTo({top: unitY(clamp(nu, 0, N)), behavior: 'instant'});
    }
    paint(true);
  }

  // Scale each plate to fit its page so widgets never need an inner scrollbar.
  function fixSvgText(frame) {
    frame.querySelectorAll('.ms-trait-wheel circle.ms-parchment-fill').forEach(c => c.setAttribute('r', '50'));
    frame.querySelectorAll('svg text').forEach(t => {
      t.style.fontSize = ''; t.style.letterSpacing = '';
      const m = t.getScreenCTM();
      const sc2 = m ? Math.hypot(m.a, m.b) : 0; if (!sc2) return;
      const base = parseFloat(getComputedStyle(t).fontSize) || 12;
      if (base * sc2 >= 12) return;
      let fs = 12.2 / sc2;
      t.style.fontSize = `${fs.toFixed(2)}px`;
      const svg = t.ownerSVGElement, vb = svg && svg.viewBox.baseVal;
      if (vb && vb.width) {
        const bb = t.getBBox();
        if (bb.width > vb.width * 0.96) { fs = Math.max(base, fs * vb.width * 0.96 / bb.width); t.style.fontSize = `${fs.toFixed(2)}px`; }
      }
    });
  }
  function fitPlates() {
    lessons.forEach(L => {
      if (!L.frame) return;
      const sc = L.frame.closest('.ms-bpage-scroll');
      if (!sc) return;
      L.frame.style.zoom = '';
      if (!single) {
        const cs = getComputedStyle(sc);
        const avail = sc.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        const need = L.frame.offsetHeight + 4;
        const z = Math.min(1, Math.max(0.5, avail / need));
        if (z < 0.995) L.frame.style.zoom = z.toFixed(3);
        for (let k = 0, zz = z; k < 8 && zz > 0.5 && sc.scrollHeight > sc.clientHeight + 1; k++) {
          zz = Math.max(0.5, zz * (sc.clientHeight - 4) / sc.scrollHeight - 0.006);
          L.frame.style.zoom = zz.toFixed(3);
        }
      }
      fixSvgText(L.frame);
    });
  }
  let fitQueued = 0;
  const refit = () => { if (!fitQueued) fitQueued = requestAnimationFrame(() => { fitQueued = 0; fitPlates(); }); };
  root.addEventListener('click', refit);
  root.addEventListener('input', refit);

  function measure() {
    turnPx = Math.round(Math.max(innerHeight, 560) * (single ? 0.75 : 0.9));
    scrollArea.style.height = `${Math.round(innerHeight + N * turnPx + turnPx * 0.3)}px`;
    top = scrollArea.getBoundingClientRect().top + scrollY;
  }
  const unitY = u => top + (u <= 0 ? 0 : (u - 0.1) * turnPx);
  const toP = y => {
    const s = clamp((y - top) / turnPx, 0, N);
    if (s >= N) return N;
    const i = Math.floor(s), f = s - i;
    return i + smooth(clamp((f - 0.18) / 0.64));
  };

  function setActive(s) {
    if (s === activeKey) return;
    activeKey = s;
    if (fade) { units.forEach((u, i) => { u.el.inert = i !== s; }); return; }
    if (baseL) baseL.inert = s !== 0;
    baseR.inert = s !== N;
    leaves.forEach((L, i) => { L.front.inert = i !== s; L.back.inert = single || i !== s - 1; });
  }

  function render(force) {
    if (!force && P === lastRender) return;
    lastRender = P;
    const fl = Math.floor(P);
    if (fade) {
      units.forEach((u, i) => {
        const op = clamp(P - i + 1);
        const vis = i >= fl && i <= Math.ceil(P);
        if (vis !== u.vis) { u.vis = vis; u.el.classList.toggle('is-off', !vis); }
        if (op !== u.op) { u.op = op; u.el.style.opacity = op.toFixed(3); }
      });
    } else {
      if (baseL) baseL.classList.toggle('is-off', P >= 1);
      baseR.classList.toggle('is-off', P < N - 1);
      leaves.forEach((L, i) => {
        const near = i >= fl - 1 && i <= fl + 1;
        if (near !== L.near) { L.near = near; L.wrap.classList.toggle('is-off', !near); L.leaf.style.willChange = near ? 'transform' : ''; }
        const p = clamp(P - i);
        if (p === L.p) return;
        L.p = p;
        const turned = p >= 0.5;
        if (turned !== L.turned) { L.turned = turned; L.wrap.style.zIndex = String(turned ? 200 + i : 200 - i); }
        L.leaf.style.transform = p ? `rotateY(${(-180 * p).toFixed(2)}deg)` : '';
        const s = Math.sin(Math.PI * p), c = Math.cos(Math.PI * p);
        const sh = (s * 0.62).toFixed(3);
        L.shF.style.opacity = sh; L.shB.style.opacity = sh;
        const cast = (s * 0.7).toFixed(3), tx = `translateX(${(c * 100).toFixed(2)}%)`;
        if (single || !turned) { L.castR.style.opacity = cast; L.castR.style.transform = tx; L.castL.style.opacity = '0'; }
        else { L.castL.style.opacity = cast; L.castL.style.transform = tx; L.castR.style.opacity = '0'; }
      });
    }
    setActive(Number.isInteger(P) ? P : -1);
    const frac = P / Math.max(1, N);
    edgeR.style.transform = `scaleX(${(0.12 + 0.88 * (1 - frac)).toFixed(3)})`;
    edgeL.style.transform = `scaleX(${(0.12 + 0.88 * frac).toFixed(3)})`;
    hudBar.style.transform = `scaleX(${frac.toFixed(4)})`;
    if (progressBar) {
      const unitOf = j => single ? j : j >> 1, first = unitOf(lessonPlate[0]), lastU = unitOf(pageInfo.lastIndexOf(pageInfo.filter(x => x.lesson === LN - 1).pop()));
      progressBar.style.transform = `scaleX(${clamp((P - first) / Math.max(1, lastU - first)).toFixed(4)})`;
    }
    const u = Math.round(P);
    if (u !== shownUnit) { shownUnit = u; describe(u); }
  }

  function describe(u) {
    const li = single ? u : 2 * u;
    const info = single ? pageInfo[u] : (pageInfo[li + 1].lesson >= 0 || pageInfo[li + 1].index ? pageInfo[li + 1] : pageInfo[li]);
    const lesson = info.lesson;
    let label;
    if (single) label = u === 0 ? 'Frontispiece' : `Page ${u}`;
    else label = u === 0 ? 'Cover' : `Pages ${u * 2}–${u * 2 + 1}`;
    if (lesson >= 0) label += ` · Lesson ${lesson + 1} of ${LN}${info.cont ? ' (continued)' : ''}`;
    else if (info.index) label += ' · The lessons';
    hudText.textContent = label;
    positionEl.textContent = lesson >= 0 ? `Lesson ${lesson + 1} of ${LN}` : 'Lesson index';
    indexLinks.forEach((a, k) => { if (k === lesson) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    pages.forEach((p, j) => p.classList.toggle('is-current', single ? j === u : (j >> 1) === u));
    prevBtn.disabled = u <= 0;
    nextBtn.disabled = u >= N;
    const activeTab = lesson >= 0 ? lesson + 1 : info.index ? 0 : -1;
    tabLinks.forEach((a, k) => { if (k === activeTab) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    curLoc = {lesson, index: !!info.index};
    clearTimeout(saveT);
    if (lesson >= 0) saveT = setTimeout(() => saveResume(lesson), 1200);
    if (u > indexUnit()) resumeDismissed = true;
    resume.hidden = resumeDismissed || savedLesson < 0 || u > indexUnit();
    onSpreadChange();
  }

  let frame = 0;
  const paint = force => { frame = 0; P = toP(scrollY); render(force); };
  const queue = () => { if (!frame) frame = requestAnimationFrame(() => paint(false)); };
  addEventListener('scroll', queue, {passive: true});

  let lastW = innerWidth, lastH = innerHeight, resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if ((innerWidth < 780) !== single || book.offsetWidth !== lastBW || book.offsetHeight !== lastBH) { lastW = innerWidth; lastH = innerHeight; mount(); return; }
      if (innerWidth === lastW && Math.abs(innerHeight - lastH) < 120) return;
      lastW = innerWidth; lastH = innerHeight;
      const keep = Math.round(P); measure(); scrollTo({top: unitY(keep), behavior: 'instant'}); paint(true);
    }, 120);
  }, {passive: true});
  reducedMotion.addEventListener('change', mount);

  // Animated page turns: tween the book position P (eased), then map it back to a scroll offset so scrubbing still agrees.
  let turnAnim = null;
  const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const lerp = (a, b, k) => a + (b - a) * k;
  const cancelTurn = () => { if (turnAnim) { cancelAnimationFrame(turnAnim.raf); turnAnim = null; } };
  const yForP = v => {
    v = clamp(v, 0, N);
    const i = Math.floor(v), fr = v - i;
    if (fr < 1e-4) return unitY(i);
    if (fr > 1 - 1e-4) return unitY(i + 1);
    const t = 0.5 - Math.sin(Math.asin(1 - 2 * fr) / 3);
    return top + (i + 0.18 + 0.64 * t) * turnPx;
  };
  function turnTo(u) {
    const y1 = unitY(u), startP = toP(scrollY);
    const inBook = scrollY >= top - 2 && scrollY <= top + (N + 1) * turnPx;
    cancelTurn();
    const dist = Math.abs(u - startP);
    if (inBook && dist < 0.01) { scrollTo({top: y1, behavior: 'instant'}); return; }
    const y0 = scrollY;
    const dur = inBook ? (dist <= 1.05 ? 850 : Math.min(1800, 850 + (dist - 1) * 150)) : clamp(Math.abs(y1 - y0) / 2.2, 600, 1200);
    const t0 = performance.now();
    turnAnim = {u, raf: 0, lastY: null};
    const tick = now => {
      if (!turnAnim) return;
      if (turnAnim.lastY !== null && Math.abs(scrollY - turnAnim.lastY) > 8) { turnAnim = null; return; }
      const k = clamp((now - t0) / dur), e = ease(k);
      const y = k >= 1 ? y1 : inBook ? yForP(lerp(startP, u, e)) : lerp(y0, y1, e);
      scrollTo({top: y, behavior: 'instant'});
      turnAnim.lastY = scrollY;
      if (k < 1) turnAnim.raf = requestAnimationFrame(tick); else turnAnim = null;
    };
    turnAnim.raf = requestAnimationFrame(tick);
  }
  addEventListener('wheel', cancelTurn, {passive: true});
  addEventListener('touchstart', cancelTurn, {passive: true});
  const curTarget = () => turnAnim ? turnAnim.u : Math.round(P);
  const goUnit = (u, instant) => {
    u = clamp(u, 0, N);
    if (instant || reducedMotion.matches) { cancelTurn(); scrollTo({top: unitY(u), behavior: 'instant'}); }
    else turnTo(u);
  };
  const goHash = (id, instant) => {
    let u;
    const m = /^lesson-(\d+)$/.exec(id);
    if (m) id = lessonIds[Number(m[1]) - 1] || id;
    if (id === 'manuscript-top') u = 0;
    else if (id === 'ms-index') u = single ? 2 : 1;
    else { const i = lessonIds.indexOf(id); if (i < 0) return false; u = single ? lessonPlate[i] : lessonPlate[i] >> 1; }
    goUnit(u, instant); return true;
  };
  root.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (a && goHash(a.getAttribute('href').slice(1))) e.preventDefault();
  });
  addEventListener('hashchange', () => goHash(location.hash.slice(1)));
  prevBtn.addEventListener('click', () => goUnit(curTarget() - 1));
  nextBtn.addEventListener('click', () => goUnit(curTarget() + 1));
  // Swipe to turn on touch screens (vertical scrolling is left to the browser).
  let swipe = null;
  book.addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || (e.target.closest && e.target.closest('input,select,textarea'))) { swipe = null; return; }
    const t = e.touches[0]; swipe = {x: t.clientX, y: t.clientY, t: performance.now()};
  }, {passive: true});
  book.addEventListener('touchend', e => {
    if (!swipe) return;
    const t = e.changedTouches[0], dx = t.clientX - swipe.x, dy = t.clientY - swipe.y, dt = performance.now() - swipe.t;
    swipe = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.6 && dt < 900) goUnit(curTarget() + (dx < 0 ? 1 : -1));
  }, {passive: true});
  addEventListener('keydown', e => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.target.closest && e.target.closest('input,select,textarea,[contenteditable]')) return;
    const r = scrollArea.getBoundingClientRect();
    if (r.top > innerHeight * 0.5 || r.bottom < innerHeight * 0.5) return;
    const cur = curTarget();
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { if (cur >= N) return; e.preventDefault(); goUnit(cur + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { if (cur <= 0) return; e.preventDefault(); goUnit(cur - 1); }
    else if (/^[1-9]$/.test(e.key) && lessonIds[Number(e.key) - 1]) { e.preventDefault(); goHash(lessonIds[Number(e.key) - 1]); }
  });

  // ---------------------------------------------------------------------
  // Plates and prose atoms are detached until mount() lays the pages out, so look in the frames and chapters too.
  const roots = () => [root, ...lessons.map(L => L.frame).filter(Boolean), ...chapterEls];
  const Q = sel => { for (const r of roots()) { const e = r.querySelector(sel); if (e) return e; } return null; };
  const QQ = sel => { const out = new Set(); roots().forEach(r => r.querySelectorAll(sel).forEach(e => out.add(e))); return [...out]; };
  // Auto demos: every plate plays a short looping storyboard while its spread is open and visible.
  // ---------------------------------------------------------------------
  const IDLE = 6000, REDUCED_STEP = 5600;
  let demoPaused = false, demoRaf = 0, lastT = 0;
  const demos = [];
  const capHTML = '<span class="ms-demo-tag"><b>Demo</b> <span data-ms-demo-n></span></span><span class="ms-demo-text" aria-hidden="true"></span><span class="ms-demo-btns"><button type="button" class="ms-demo-btn" data-ms-demo-pause aria-pressed="false">Pause</button><button type="button" class="ms-demo-btn" data-ms-demo-next hidden>Next</button></span>';
  const isCurrentEl = el => { const pg = el.closest('.ms-bpage'); return !!pg && pg.classList.contains('is-current'); };
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(en => { const d = demos.find(x => x.watch === en.target); if (d) d.inView = en.isIntersecting && en.intersectionRatio > 0.15; });
    kick();
  }, {threshold: [0, 0.15, 0.4]}) : null;

  function setCaption(d, i) {
    d.txt.textContent = d.steps[i].cap;
    d.nEl.textContent = `${i + 1}/${d.steps.length}`;
  }
  function enterStep(d, i) {
    d.idx = i; d.t = 0; d.done = false;
    const s = d.steps[i];
    if (s.enter) s.enter(d);
    setCaption(d, i);
    if (s.frame) s.frame(reducedMotion.matches ? 1 : 0, d);
    if (reducedMotion.matches) d.done = true;
    d.live.forEach(e => e.setAttribute('aria-live', 'off'));
  }
  function releaseDemo(d) { if (d.snap) { const sn = d.snap; d.snap = null; if (d.restore) d.restore(sn); } }
  function stopDemo(d) {
    d.on = false;
    releaseDemo(d);
    if (!(d.inView && isCurrentEl(d.watch))) { d.idx = -1; if (d.reset) d.reset(d); setCaption(d, 0); }
  }
  function stepDemo(d, dt, now) {
    const s = d.steps[d.idx], reduced = reducedMotion.matches;
    d.t += dt;
    if (!reduced) {
      if (s.frame && s.anim && !d.done) {
        const k = clamp(d.t / s.anim);
        s.frame(ease(k), d);
        if (k >= 1) d.done = true;
      }
      if (d.ambient) d.ambient(now, d);
    }
    if (d.t >= (reduced ? REDUCED_STEP : s.dur)) enterStep(d, (d.idx + 1) % d.steps.length);
  }
  const canRun = (d, now) => !demoPaused && !document.hidden && d.inView && now >= d.idleUntil && isCurrentEl(d.watch);
  function demoTick(now) {
    demoRaf = 0;
    const dt = Math.min(64, now - (lastT || now)); lastT = now;
    let any = false;
    demos.forEach(d => {
      if (!canRun(d, now)) { if (d.on) stopDemo(d); return; }
      if (!d.on) { d.on = true; if (!d.snap && d.save) d.snap = d.save(); enterStep(d, d.idx < 0 ? 0 : d.idx); }
      stepDemo(d, dt, now); any = true;
    });
    if (any) demoRaf = requestAnimationFrame(demoTick); else lastT = 0;
  }
  function kick() { if (!demoRaf) demoRaf = requestAnimationFrame(demoTick); }
  onSpreadChange = kick;
  document.addEventListener('visibilitychange', kick);

  function setPaused(v) {
    demoPaused = v;
    demos.forEach(d => { const b = d.cap.querySelector('[data-ms-demo-pause]'); b.textContent = v ? 'Play' : 'Pause'; b.setAttribute('aria-pressed', String(v)); });
    demoToggle.textContent = v ? 'Play demos' : 'Pause demos';
    demoToggle.setAttribute('aria-pressed', String(v));
    kick();
  }
  demoToggle.addEventListener('click', () => setPaused(!demoPaused));
  const syncReduced = () => demos.forEach(d => { d.cap.querySelector('[data-ms-demo-next]').hidden = !reducedMotion.matches; });

  function touchDemo(d) {
    const now = performance.now();
    d.idleUntil = now + IDLE;
    if (d.on) stopDemo(d); else releaseDemo(d);
    d.live.forEach(e => e.removeAttribute('aria-live'));
    clearTimeout(d.resumeT);
    d.resumeT = setTimeout(kick, IDLE + 60);
  }
  ['pointerdown', 'keydown', 'input', 'focusin'].forEach(type => root.addEventListener(type, e => {
    if (!e.target.closest || e.target.closest('.ms-demo')) return;
    demos.forEach(d => { if (d.zones.some(z => z.contains(e.target))) touchDemo(d); });
  }, true));

  function defineDemo(o) {
    if (!o.watch || !o.steps.length) return;
    const d = Object.assign({idx: -1, t: 0, on: false, inView: !io, idleUntil: 0, done: false, live: [], zones: [o.watch]}, o);
    d.cap = mk('div', 'ms-demo', capHTML);
    d.cap.setAttribute('role', 'group'); d.cap.setAttribute('aria-label', 'Automatic demonstration');
    d.txt = d.cap.querySelector('.ms-demo-text'); d.nEl = d.cap.querySelector('[data-ms-demo-n]');
    d.mountCap(d.cap);
    d.cap.querySelector('[data-ms-demo-pause]').addEventListener('click', () => setPaused(!demoPaused));
    d.cap.querySelector('[data-ms-demo-next]').addEventListener('click', () => { touchDemo(d); if (!d.snap && d.save) d.snap = d.save(); enterStep(d, (d.idx + 1) % d.steps.length); });
    setCaption(d, 0);
    demos.push(d);
    if (io) io.observe(d.watch);
  }
  reducedMotion.addEventListener('change', syncReduced);

  // 1. Trait allocator: cycle contrasting builds.
  const keys5 = ['strength', 'agility', 'stamina', 'vitality', 'charisma'];
  const nm = k => k[0].toUpperCase() + k.slice(1);
  const builds = [{lead: 'strength', v: [5, 1, 3, 3, 0]}, {lead: 'agility', v: [1, 5, 2, 2, 2]}, {lead: 'vitality', v: [2, 0, 4, 5, 1]}, {lead: 'charisma', v: [1, 2, 2, 2, 5]}];
  const traitPlate = Q('.ms-traits');
  defineDemo({
    watch: traitPlate, live: [Q('[data-ms-build-status]')],
    mountCap: c => Q('.ms-traits figcaption').after(c),
    steps: builds.map(b => ({
      dur: 5000, anim: 1200,
      cap: `${nm(b.lead)} ${b.v[keys5.indexOf(b.lead)]}: ${effects[b.lead](b.v[keys5.indexOf(b.lead)])}.`,
      enter: d => { d.from = keys5.map(k => traits[k]); QQ('[data-ms-trait]').forEach(r => r.classList.toggle('is-demo-hot', r.dataset.msTrait === b.lead)); },
      frame: (e, d) => {
        const vals = d.from.map((f, i) => lerp(f, b.v[i], e));
        keys5.forEach((k, i) => { traits[k] = Math.round(vals[i]); });
        drawTraits(false, e >= 1 ? null : vals);
      }
    })),
    save: () => ({...traits}),
    restore: sn => { Object.assign(traits, sn); drawTraits(false); },
    reset: () => QQ('[data-ms-trait]').forEach(r => r.classList.remove('is-demo-hot'))
  });

  // 2. Guard direction: sweep the attack angle through the 90 degree cone.
  const guardPlate = Q('.ms-guard'), attackLine = guardPlate && guardPlate.querySelector('.ms-attack-line');
  const sweep = [[0, 'Facing the attack: the hit is inside your guard.'], [40, 'Turn to 40°: still inside the front 90° cone.'], [75, 'Turn to 75°: outside the front 90° cone.'], [180, 'Facing 180°: attacks from the rear receive no guard bonus.'], [-75, 'Turn the other way, -75°: outside the cone.'], [-30, 'Back to -30°: inside the cone again.']];
  defineDemo({
    watch: guardPlate, live: [Q('#ms-guard-result')],
    mountCap: c => guardPlate.querySelector('figcaption').after(c),
    steps: sweep.map(([a, cap]) => ({
      dur: 3400, anim: 1600, cap,
      enter: d => { d.a0 = guardAngle; },
      frame: (e, d) => { const ang = lerp(d.a0, a, e); setFacing(ang); facing.value = String(clamp(Math.round(ang / 5) * 5, -180, 180)); }
    })),
    ambient: now => { if (attackLine) attackLine.style.transform = `translateY(${(Math.sin(now / 260) * 5).toFixed(2)}px)`; },
    save: () => ({a: guardAngle, v: facing.value}),
    restore: sn => { setFacing(sn.a); facing.value = sn.v; },
    reset: () => { if (attackLine) attackLine.style.transform = ''; }
  });

  // 3. Stamina costs: dodge, technique, ultimate, then Evasive.
  const strip = Q('.ms-cost-strip');
  if (strip) {
    const cells = [...strip.children].filter(c => c.tagName === 'DIV');
    const costs = cells.map(c => parseFloat(c.querySelector('strong').textContent));
    const strongs = cells.map(c => c.querySelector('strong')), origText = strongs.map(s => s.textContent);
    const meters = cells.map(c => { const m = mk('i', 'ms-cost-meter', '<b></b>'); c.append(m); return m.firstChild; });
    const fmt = v => Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, '');
    const paint = (i, v) => { strongs[i].textContent = fmt(Math.round(v * 100) / 100); meters[i].style.transform = `scaleX(${(v / 100).toFixed(3)})`; };
    const restore = () => cells.forEach((c, i) => { c.style.opacity = ''; c.classList.remove('is-demo-hot'); strongs[i].textContent = origText[i]; meters[i].style.transform = `scaleX(${(costs[i] / 100).toFixed(3)})`; });
    restore();
    const costSteps = [
      {i: 0, cap: 'A dodge needs movement. It costs 15 Stamina.'},
      {i: 1, cap: 'A weapon technique costs 50 Stamina.'},
      {i: 2, cap: 'A physical Ultimate costs 100 Stamina.'}
    ].map(({i, cap}) => ({
      dur: 3200, anim: 1100, cap,
      enter: () => cells.forEach((c, j) => { c.classList.toggle('is-demo-hot', j === i); c.style.opacity = j > i ? '.4' : ''; if (j < i) paint(j, costs[j]); else if (j > i) { strongs[j].textContent = origText[j]; meters[j].style.transform = 'scaleX(0)'; } }),
      frame: e => paint(i, costs[i] * e)
    }));
    costSteps.push({
      dur: 4200, anim: 1400, cap: 'These are base costs. Evasive reduces a dodge to 11.25 Stamina.',
      enter: () => cells.forEach((c, j) => { c.classList.toggle('is-demo-hot', j === 0); c.style.opacity = ''; paint(j, costs[j]); }),
      frame: e => paint(0, lerp(costs[0], 11.25, e))
    });
    defineDemo({watch: strip, mountCap: c => strip.append(c), steps: costSteps, reset: restore});
  }

  // 4. Relief: wield, deploy, enter, then the price of each school.
  const reliefPlate = Q('.ms-relief-plate');
  const reliefSteps = [
    ['Holy', 1, 'Wield the school’s Relief and deploy it in front of you.'],
    ['Holy', 2, 'As the board settles and grows, its influence spreads.'],
    ['Holy', 3, 'Stand within that influence while holding a matching Relief to begin casting.'],
    ['Blood', 3, 'Blood: most spells spend Stamina and a share of maximum Health.'],
    ['Dark', 3, 'Dark spells add Dark Points. Reaching 100 permanently corrupts your character.']
  ];
  defineDemo({
    watch: reliefPlate, live: [Q('[data-ms-relief-status]')],
    mountCap: c => Q('.ms-magic-price').before(c),
    steps: reliefSteps.map(([sc, st, cap]) => ({
      dur: st === 1 ? 3600 : 4400, cap,
      enter: () => { school = sc; reliefStep = st; drawRelief(); Q('.ms-magic-price').classList.toggle('is-demo-hot', sc !== 'Holy'); }
    })),
    save: () => ({school, reliefStep}),
    restore: sn => { school = sn.school; reliefStep = sn.reliefStep; drawRelief(); Q('.ms-magic-price').classList.remove('is-demo-hot'); },
    reset: () => Q('.ms-magic-price').classList.remove('is-demo-hot')
  });

  // 5. Travel: reveal the road waypoint by waypoint, then return by Doll.
  const travelPlate = Q('.ms-travel-plate');
  defineDemo({
    watch: travelPlate, live: [Q('[data-ms-map-status]')],
    mountCap: c => travelPlate.querySelector('figcaption').after(c),
    steps: [
      ['Unexplored ground is black on your map.', () => { discovered = 0; drawMap(0); }],
      ['As you move, you reveal the area within 60 metres.', () => drawMap(1)],
      ['Walk into a travel waypoint to discover it and earn 100 XP once.', () => drawMap(2)],
      ['That knowledge stays with your character.', () => drawMap(3)],
      ['Speak to a regional Cursed Doll to open her travel map.', () => drawMap(1, true)],
      ['You can return to discovered waypoints with available arrival points.', () => drawMap(3, true)]
    ].map(([cap, enter]) => ({dur: 3800, cap, enter})),
    save: () => ({discovered, pos: Number(route.value)}),
    restore: sn => { discovered = sn.discovered; drawMap(sn.pos); }
  });

  // 6. People & choices: the ledger turns through person, faction, voice, witness.
  const ledgerPlate = Q('.ms-ledger');
  const ledgerEls = ledgerPlate ? {
    person: ledgerPlate.querySelector('use.ms-memory-person'),
    faction: ledgerPlate.querySelector('.ms-memory-faction'), voice: ledgerPlate.querySelector('.ms-memory-voice'), witness: ledgerPlate.querySelector('.ms-memory-witness')
  } : {};
  const ledgerLines = ledgerPlate && ledgerPlate.querySelector('.ms-memory-lines');
  let ledgerKey = 'person';
  const clearLedgerFx = () => { Object.values(ledgerEls).forEach(el => { if (el) { el.style.transform = ''; } }); if (ledgerLines) ledgerLines.style.opacity = ''; };
  defineDemo({
    watch: ledgerPlate, live: [Q('[data-ms-ledger-status]')],
    mountCap: c => ledgerPlate.querySelector('.ms-ledger-layout').after(c),
    steps: Object.keys(ledger).map(key => ({
      dur: 4800, cap: `${ledger[key][0]}: ${ledger[key][1]}`,
      enter: () => { clearLedgerFx(); ledgerKey = key; setLedger(key); }
    })),
    ambient: now => {
      const el = ledgerEls[ledgerKey];
      if (el) { el.style.transformBox = 'fill-box'; el.style.transformOrigin = 'center'; el.style.transform = `scale(${(1 + 0.05 * Math.sin(now / 300)).toFixed(3)})`; }
      if (ledgerLines) ledgerLines.style.opacity = (0.75 + 0.25 * Math.sin(now / 420)).toFixed(3);
    },
    save: () => ({key: Q('.ms-ledger').dataset.msLedger || 'person'}),
    restore: sn => { clearLedgerFx(); ledgerKey = sn.key; setLedger(sn.key); },
    reset: clearLedgerFx
  });

  // 7. Playing together: seats fill around the fire.
  const campPlate = Q('.ms-camp'), fire = campPlate && campPlate.querySelector('.ms-camp-fire');
  const seats = QQ('[data-ms-camp-seat]');
  const partySteps = [
    [1, 'A campaign welcomes up to four human players.'],
    [2, 'Join with a new adventurer or your existing character on that host.'],
    [3, 'Pets, companions and summons do not use those spaces.'],
    [4, 'The campaign is full with four human players.'],
    [1, 'A local pair needs two free player spaces to join together.'],
    [3, 'Two can play locally on each computer.']
  ];
  const resetSeats = () => { seats.forEach(s => { s.style.transform = ''; }); if (fire) fire.style.transform = ''; };
  defineDemo({
    watch: campPlate, live: [Q('[data-ms-party-status]')],
    mountCap: c => campPlate.querySelector('figcaption').after(c),
    steps: partySteps.map(([n, cap]) => ({
      dur: 3600, anim: 800, cap,
      enter: d => { d.fresh = seats.filter((s, i) => i >= party && i < n); party = n; drawParty(); },
      frame: (e, d) => (d.fresh || []).forEach(s => { s.style.transformBox = 'fill-box'; s.style.transform = e >= 1 ? '' : `translateY(${((1 - e) * 14).toFixed(1)}px)`; })
    })),
    ambient: now => { if (fire) { fire.style.transformBox = 'fill-box'; fire.style.transformOrigin = '50% 100%'; fire.style.transform = `scaleY(${(1 + 0.05 * Math.sin(now / 130) + 0.03 * Math.sin(now / 71)).toFixed(3)})`; } },
    save: () => ({party}),
    restore: sn => { party = sn.party; drawParty(); resetSeats(); },
    reset: resetSeats
  });
  syncReduced();

  mount();
  addEventListener('load', () => { mount(); if (location.hash) goHash(location.hash.slice(1), true); }, {once: true});
  if (location.hash) goHash(location.hash.slice(1), true);

}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initManuscript(), {once:true});
else initManuscript();
