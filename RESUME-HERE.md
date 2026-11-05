# RESUME HERE: Eclipsed Realms official website (handoff 2026-11-04)

Start a new session by reading this file, then `HANDOFF-2026-11-03-Claude.md` (detailed history) and `..\layer-scan\RUNBOOK.md` (Unreal steps).

## State
- **Local site is fully built and checked:** build-pages OK, every dist JS passes `node --check`, validate-scenery OK (6 scenes), and validate.mjs passes everything except the owner-approved line-22 world/Bible drift assert (the owner's finished water edit plus the internal Development Bible build link). About 61 uncommitted changes; nothing is committed or published.
- **Done:** Discover web film (camera fixes, poster, cultist ritual, black Nun habit, demon summoning rise with ember glow; autoplay/loop video switch ready); Story (Play continues from the current position; partial native scenery packs; video-loop and rendered-map switches ready); How to play (page-turning book, animated turns, self-running demos, accuracy fixes, 7th Controls lesson); Player guide (rebuilt from scratch: `content/guide-v2.json`, 8 sections / 69 articles); realm.html (switches to a pan/zoom rendered map when `dist/assets/map/realm-map.json` exists).
- **Owner direction:** no placeholder assets anywhere. The Discover film, Story chapter loops and the world map (every area fully drawn, incl. the Shuttered House and Mysterious House) are rendered in Unreal from `/Game/Cinematics/Website/`.

## Waiting on the owner
1. **The owner said do not use the Unreal editor until they say "build".** Then follow `..\layer-scan\RUNBOOK.md`: map test (two houses), full map, Discover fixes + stills + full render, Story loops. All launches go through `D:\Unreal Projects\EclipsedRealms\.claude\eclipsed\bin\Invoke-Locked.ps1`; save only under /Game/Cinematics/Website/; the scripts are UNTESTED (run dry/test modes first). Then `..\layer-scan\media-pipeline\` (encode_video.py, build_map.py with waypoint crop checks, install_media.py).
2. **Publishing** is Codex-only (ChatGPT Sites tools). Paste the prompt in `PUBLISH-PROMPT.md` into Codex. Recommended: publish after the Unreal media are installed. Codex credits return on Nov 9, 4:31 PM.

## Rules that bit us
- Low-memory guard: background jobs killed this way are not restarted without asking the owner.
- Preview: serve dist with `python -m http.server 4300 --bind 127.0.0.1` from Bash (PowerShell Start-Process python exits immediately here). Headless review tools (copied): `..\layer-scan\review-tools\` (page-shot.mjs = page screenshots; driver.mjs + review.html + server.py = film frame renders; their output paths point at the old scratchpad, so edit `out` before use).
- Coordinate with the "Handoff execution with subagents" session for editor slots (first come, first served).
