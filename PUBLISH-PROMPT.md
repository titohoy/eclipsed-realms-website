# Paste this into Codex (ChatGPT app) to publish

> Publish the current local checkout `C:\Users\tevin\Documents\ChatGPT\Complete 2\EclipsedRealms-ScrollStory` to my existing Eclipsed Realms Official Website Site (`appgprj_6acbfb9507248191abe66c5b3b7a5598`), keeping its owner-private audience. Use the Sites workflow (get_site, source write credential, source helper, then deploy). Do not create a new Site.
>
> I approve a one-time override of the world/Bible drift gate. `scripts/validate.mjs` fails only at line 22 ("Bible is unhealthy") because of my own finished open-world water edit (2026-11-03 13:25-13:38) and an internal Development Bible build link. Publish anyway, on the current reviewed world survey. Do **not** run `sync-bible.mjs --accept-reviewed`, refresh world or survey hashes, re-extract anything, or change content to make that check pass. Review the world edit in a later update.
>
> Before packaging, run `node scripts/build-pages.mjs`, `node scripts/validate-scenery.mjs` (must pass) and `node scripts/validate.mjs` (only the line-22 failure is acceptable). Do not change site files beyond what packaging requires. Read `HANDOFF-2026-11-03-Claude.md` for what changed. After a successful deploy, write `../official-site-sync-state.json` per SYNC.md and tell me the live URL and version.

## State this publishes (verified 2026-11-04 by Claude Code)
- `build-pages.mjs` OK. `node --check` OK on site.js, advert.js, manuscript.js, journey.js, world-flight.js and realm-map.js. `validate-scenery.mjs` OK (6 scenes, 115 models, 1,666 instances). `validate.mjs` passes every check except the line-22 drift assert (verified with that line disabled: 163 player articles, 1,568 reviewed 3D assets, private metadata and developer copy excluded).
- Headless-Chrome page checks: Discover, How to play, Story and the 3D explorer load with no console errors.
- Changes: the Discover film camera fixes and the poster; Story scenery packs for Gallows, Thornhallow, Veilcross and Cairnhold (partial); the How to play page-turning book; video and rendered-map hooks that stay inactive until the Unreal media exist; a bug fix in validate-scenery.
- Not included yet (pending Unreal work): the Unreal-rendered Discover film, the Story loops and the rendered map.
