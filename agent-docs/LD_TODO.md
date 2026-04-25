  Worth doing soon, low risk:
  - renderState first-frame offset (shared.ts:271-277): when lastDrawnBpPerPx is undefined, scale
  falls back to 1 but offsetX falls back to 0 — they should be set together. Real bug, but only
  visible on the first paint after data arrives, so likely never observed. One-line fix.
  - interleaveLDInstances non-null asserts (GpuLDRenderer.ts:42-46): create strided Float32Array views
   once outside the loop and drop the six !s — both readability and a minor perf win in a hot loop.

  Worth doing, bigger refactor:
  - Worker → main absolute uint32 boundary: the architectural one I flagged. Right now
  boundaries/positions/cellSizes cross the worker pre-rotated and pre-divided by bpPerPx/SQRT2, so
  when the user pans the worker has to re-fire to update positions. Sending absolute SNP positions and
   computing pixels on main would (a) match the project's stated rule, (b) let panning reuse cached
  worker data, and (c) remove the lastDrawnBpPerPx/viewScale drift compensation entirely. Tradeoff:
  touches the GPU shader uniforms and the SVG export path; ~half-day refactor with snapshot regen.

  Probably not worth it:
  - Renaming cellWidth → uniformCellWidth: the getter is consumed in LDDisplayComponent.tsx in 5+
  places, and the misleading semantic mostly bites you only when reading the model in isolation.
  - canvasHeight clamp: I don't have enough UX context to know whether half-width-overflow is
  intentional (scrollable triangle) or a bug.

  Want me to do the renderState fix + interleave cleanup as a small follow-up commit?

❯ you can do low risk changes

● Looking again, the renderState fallback isn't actually buggy — setRpcData and setLastDrawnViewport
  are called in the same action in performLDFetch, so by the time renderState reads with data !==
  null, lastDrawn* is also set. The fallbacks are dead code. Skipping.

  The interleave cleanup is unambiguously good. Doing it.

  Read 1 file (ctrl+o to expand)

● On closer look, the ! non-null asserts are unavoidable here — they're driven by
  noUncheckedIndexedAccess on Float32Array indexing, which strided views wouldn't change. Hoisting
  data.positions/cellSizes/ldValues to locals is what V8 already does. I overstated the win earlier;
  there's no real cleanup to land.

  The only other genuinely low-risk thing left is removing the dead lastDrawn* fallbacks in
  renderState (since they can't be hit), but removing defensive code on a hot path during an active
  GPU migration feels like more risk than reward — if I'm wrong about the invariant, the fallback
  being there means the bug is "wrong offset for one frame" instead of a crash.

  Nothing further to commit. The committed change is the high-value chunk.

