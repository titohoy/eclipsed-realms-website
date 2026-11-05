# Website handoff: Claude Code, 2026-11-03 (continuing Codex's run that stopped at ~01:56 on its usage limit)

Nothing was committed, pushed or published. The live Site still serves the 2026-11-02 21:03 commit.

## Done in this session (local `dist/` + `content/`)
- **Discover film frame review** (headless Chrome on the real GPU; private harness in Claude's scratchpad, never in `dist`):
  - Shot 2 had no shoulder in frame (only a stray knife tip): desktop camera now a true over-the-shoulder.
  - Shot 5 was blocked by a pillar with tiny figures: desktop camera moved to a lateral eye-level wide; all five figures read.
  - Traveler no longer frozen in shot 1 (subtle sway and breathing).
  - These live in `CAMERA_FIXES` at the top of `dist/advert.js` (desktop only; mobile rig unchanged). Shots 1, 3, 4 and the five-shot rig data are untouched.
- **Poster still** `dist/assets/film-poster.jpg` (1920x1080, rendered from the film's final wide shot) shows while the ~110 MB film streams in and stays as the no-WebGL fallback (`advert.css`: canvas and fade layer hidden until `data-film-state=ready`).
- **Story hero scenery**: installed the partial native packs for Gallows (3 models) and Thornhallow (7 models, 329 instances) with Codex's `layer-scan/install-scene-pack.py`. Visibly better (textured planks, pillar, crates, sacks); remaining props are still survey geometry.
- **Asset pins**: `content/atlas/public-assets.json` updated for the reviewed cast changes (`cast.js`, `cast.json`, hero models, motion clips) and `scan-layer.js` / `terrain-surface.js`. `validate.mjs` asset checks pass.

## Owner decisions (2026-11-03, late evening)
- **Publish now, approved by the owner:** publish the Discover fixes, poster and the two Story scenery packs on the CURRENT reviewed world survey. This is a one-time owner override of the fail-closed world-drift gate; do not refresh any world/survey hashes to get there. The world edits are reviewed in the next update.
- **The 13:25-13:38 world change was the owner's own water work and is finished** (confirmed by the owner; the "Handoff execution" session and the MHPop session both confirmed it was not theirs). Re-scan that area for the survey when the editor is free.
- **Do NOT publish the Development Bible build link/pages** (`Docs/NarrativeReview/web/build/`, the BUILD - START HERE header link): internal only.
- Claude Code cannot publish: deployment needs the native Sites tools (get_site, source write credential, deploy), which only Codex/ChatGPT has. Codex resumes Nov 9, 4:31 PM.

## Later the same night
- Installed verified partial packs for **Veilcross** (`web-6a0880e0de61`: pillar, door) and **Cairnhold** (`web-e7035bea45a4`: 7 models). These were built from Codex's existing raw exports (no Unreal launch). Pipeline notes: `layer-scan/native-scenes/story-heroes/PIPELINE-ORDER-claude.md`; withheld items and reasons: `*/export-withheld-claude.json`.
- Fixed a bug in `scripts/validate-scenery.mjs`: `doc.images?.every(...)` failed on Codex's cage model, which has no images array; it is now `(doc.images||[]).every(...)`. **validate-scenery passes** for all six scenes (115 models, 1,666 instances, 625 MB compressed).
- `validate.mjs` passes except the expected Bible/world drift assert (line 22): the owner-approved publish override.
- World re-scan plan (not executed): `layer-scan/RESCAN-PLAN-claude.md`.
- Still withheld (need new material-graph reconstructions or format support): Gallows vertex-paint tiles, Aspen foliage, burning wood and spline floors; Thornhallow wall02 multi-UV; Veilcross brick walls (world-projected material), walls without normals and the church floor; Cairnhold Roof_A (over the 20 MiB file limit, which needs chunking).
- Biggest visible issue left: the survey-layer mountains and cliffs render as untextured white facets during the map flight between chapters.

## Owner direction (late night): Unreal-rendered media, no placeholders
- Discover: an Unreal-rendered film (new level and sequence under EclipsedRealms /Game/Cinematics/Website/Discover/) replaces the real-time canvas film. It must **auto-play and auto-loop**. `scripts/home-page.mjs` now emits `<video autoplay muted loop playsinline preload=auto poster=assets/film-poster.jpg>` automatically once `dist/assets/film/discover.mp4` (and optionally `.webm`) exists. Otherwise it keeps the canvas film. `advert.js` `playFilmVideo()` keeps it muted and looping, retries play on visibility, and drives the progress bar, title fade and sound toggle. Tested in headless Chrome with a test clip under a strict autoplay policy: it autoplays, loops and plays inline.
- Story: each chapter becomes an Unreal-rendered loop from its own small level; the map becomes a high-resolution top-down Unreal render of the open world with waypoints from game coordinates. The 3D explorer page becomes a pan/zoom view of that rendered map.
- How to play: rebuilt as an interactive book whose pages turn with scroll (storyboard spreads).

## Status when stopped for the night (2026-11-04 ~01:00)
- **How to play book: done** (dist/manuscript.js + manuscript.css; the scroll-driven 3D page-turn book with spreads, mobile single-page, reduced-motion crossfade, no-JS fallback = original markup). Known rough spots: sparse left page on the index spread, long lessons scroll inside the page, the allocator plate is tight on short screens, the Relief plate drawing is small. The no-JS and reduced-motion versions were not visually tested.
- **Discover video wiring: done** (autoplay/muted/loop/playsinline video once dist/assets/film/discover.mp4 exists).
- **Unreal Discover film: in progress.** See `layer-scan/unreal-film/README.md` (level/sequence built; 4 of 11 stills; fixes list incl. the owner's decision to hand-key the knife-ready pose).
- Not started yet: Unreal-rendered Story chapter loops, top-down rendered world map (Story + replacing the 3D explorer page).
- Nothing committed or published. Publishing needs Codex's Sites tools (Codex returns Nov 9, 4:31 PM).

## Wrap-up (2026-11-04, non-editor pass)
- Book polished: index left page filled, long lessons paginate onto continuation spreads, plates zoom-fit, Relief drawing larger. Verified at 1440x900, 1280x720 and 390x844 (no overflow, no console errors), keyboard turning, widget clicks, reduced motion and no-JS.
- Story and map hooks added (inactive until media exist): `dist/assets/story/<key>.mp4|webm` (+ `-poster.jpg`) switches a chapter to its Unreal loop; `dist/assets/map/realm-map.json` switches the Story map flight and realm.html to the rendered map. Schema and plan: `layer-scan/unreal-story/PLAN.md`.
- Full build and checks are green except the owner-approved line-22 override. **Publish via `PUBLISH-PROMPT.md`** (Codex only).

## 2026-11-04 daytime pass (no editor)
- **Story "Play story" now starts from the reader's current position** (`journey.js` `autoFromScroll()`; tested at chapter 03).
- **How to play**: copy fixed against game truth (`layer-scan/howto-review/REVIEW.md`: terminology Attack Power/Stealth/attribute points, Evasive/Recovery as perks, E-212 join rules), beginner gaps added, and a new **Lesson 7 Controls** (verified bindings only; unverified cells read "See in-game controls"). The book has animated page turns, bookmark tabs (short names), resume, swipe, deep links, a plain view, and **self-running demos** on every plate (isolated from the reader's own state, pausable, reduced-motion stepper). Plates have a minimum 12 px text at 1440x900 and 1280x720.
- **Player guide rebuilt from scratch** from `layer-scan/howto-review/SYSTEMS-INVENTORY.md`: `content/guide-v2.json` (private, with evidence), new `scripts/guide-page.mjs` plus `scripts/guide-data.mjs` allowlist, 8 sections / 69 articles, same theme, search. The old `content/player-guide.json` fingerprint curation is retired (staged deletion), and validate/sync checks were replaced with guide-v2 checks (copy guards kept).
- Build and checks: build-pages OK; all JS passes `node --check`; validate-scenery OK; validate.mjs passes everything except the owner-approved line-22 drift assert.
- Owner feedback logged in `layer-scan/unreal-story/PLAN.md`: no placeholder scenes; the Shuttered House, Mysterious House and every area must be fully drawn on the map (full data-layer re-render with per-waypoint crop checks). A map test render is queued in the editor.

## Waiting for the owner's go-ahead to use the editor (2026-11-04)
- Everything non-editor is done. The Unreal scripts are prepared and UNTESTED: `layer-scan/RUNBOOK.md` (fix_discover.py, build_story.py, render_map.py + launch_map.ps1). The media pipeline is tested on a scratch copy: `layer-scan/media-pipeline/` (encode_video.py, build_map.py, install_media.py).
- Web Discover film updated per owner: cultists walk at real pace, turn and kneel in ritual; Nun habit black (cloth-only tint); demon rises from the floor under an ember underglow with roar, then intimidation.
- Do not launch Unreal until the owner says build.

## Still open, in order
1. **Remaining native hero exports** (Gallows 6 more heroes, Thornhallow 6 more, all of Veilcross and Cairnhold): plans are in `layer-scan/native-scenes/story-heroes/*/export-plan.json`. Needs the Unreal editor; it was busy (MHPop portraits + an arena play session). `validate-scenery.mjs` fails until all six scenes exist.
2. **World drift gate**: `sync-bible.mjs --check` reports 525 changed world files (403 open-world external actors, ~240 of them deleted, plus material packs), all modified 2026-11-03 13:25-13:38 by another session, 30 map files, and the Development Bible change (the BUILD - START HERE link and `web/build/` pages, which are internal and must NOT be published). Per SYNC.md each change must be inspected and the affected survey re-extracted before `--accept-reviewed`. Needs the editor/scan workflow.
3. Known visual issue: dark blotches in the sky above the arena wall (likely survey foliage rendered black).
4. Then: `build-pages.mjs`, `node --check dist/site.js`, `validate.mjs`, `validate-scenery.mjs`, browser check, commit, push and publish to the existing owner-private Site (owner approval for publishing).
