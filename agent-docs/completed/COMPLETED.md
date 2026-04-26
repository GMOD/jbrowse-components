# Completed Work Items

Items moved here from TODO.md once done. Entries are brief; the git log has
the full story.

---

## Canvas

**Drop `regionStart` field; ship absolute genomic uint32.** _Done 2026-04-25._
Removed `regionStart` from `FeatureDataResult`/`RegionRenderData`. Worker now
emits absolute uint32 positions directly (`collectRenderData.ts`). Shaders
updated: removed `regionStart` uniform from `canvasUniforms.slang`, regenerated
all four passes (rect, line, chevron, arrow). Canvas2D and overlay consumers
simplified by removing `+ region.regionStart` recombination. Stale doc comment
in `rpcTypes.ts` deleted. All 176 canvas tests pass.
