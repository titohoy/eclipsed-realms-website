import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
// When the Unreal-rendered film exists in dist/assets/film/, Discover plays it as a muted, looping, inline video
// (autoplay-safe on desktop and mobile) with the poster as fallback; otherwise the real-time canvas film is used.
const filmDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist/assets/film');
const has=f=>fs.existsSync(path.join(filmDir,f));
const label='A traveler faces the Cult and the Nun as a demon emerges from the darkness.';
function filmMedia(){
 if(!has('discover.mp4')&&!has('discover.webm'))return `<canvas class="advert-canvas" aria-label="${label}"></canvas>`;
 return `<video class="advert-video" autoplay muted loop playsinline preload="auto" poster="assets/film-poster.jpg" aria-label="${label}">`+
  (has('discover.webm')?'<source src="assets/film/discover.webm" type="video/webm">':'')+
  (has('discover.mp4')?'<source src="assets/film/discover.mp4" type="video/mp4">':'')+'</video>';
}
export function homePage(){return `<section class="cinematic-ad" data-film-state="loading" aria-label="Eclipsed Realms cinematic">${filmMedia()}<div class="ad-shade"></div><div class="ad-fade" aria-hidden="true"></div><div class="ad-loading" role="status" aria-live="polite"><span class="ad-spin" aria-hidden="true"></span><span class="ad-loading-text">Loading the film…</span><span class="ad-loading-bar" aria-hidden="true"><i></i></span></div><div class="ad-title"><p class="eyebrow">A DARK FANTASY ROLE-PLAYING GAME</p><h1>Eclipsed <em>Realms.</em></h1><p class="ad-line">A stranger. A blade. A realm in the dark.</p><div class="ad-actions"><a class="button" href="story.html">Enter the story →</a><a class="ad-world-link" href="realm.html">Explore the realm ↗</a></div></div><div class="ad-controls"><span class="ad-duration">A glimpse of the realm · 23s loop</span><button class="ad-sound" type="button" aria-pressed="false">Sound off</button></div><span class="ad-progress" aria-hidden="true"><i></i></span></section>`;}
