## Resolved

- **Unify installPerRegionWiggleLifecycle into installPerRegionRenderLifecycle.**
  Done — the core helper now caches encoded outputs per region and exposes
  the cache as a second arg to the `render` callback. Wiggle (both Linear
  and Multi) now calls `installPerRegionRenderLifecycle` directly; the
  wiggle-specific lifecycle file is gone. The five other per-region
  callers (manhattan, MAF, two variants displays) ignore the second arg —
  TS arity-tolerance means no signature churn for them.

- **MonolithicGpuRenderingBackend extracted.** HiC, LD, and MultiVariantMatrix all
  extend `Canvas2DGlobalRenderingBackend` / `GpuGlobalRenderingBackend` from
  `@jbrowse/core/gpu/globalRenderingBackend`.

## Not worth doing

- **Migrate Dotplot to PerRegionGpuRenderingBackend.** Dotplot's backend is
  per-track aggregate, not per-region streamed: keys are display indices
  (one per track) collected into a view-level `geometryByTrackIndex` map,
  there is no `rpcDataMap` keyed by `displayedRegionIndex`, the renderer
  takes ordered `displayKeys` not `RenderBlock[]`, and the shader does its
  own viewport transform (no per-block clip). It already shares
  `GpuRenderingBackendLifecycleSlotMixin` — the reusable primitive that matters.
  Coercing the rest through PerRegionGpuRenderingBackend would fabricate fake
  "regions" purely to satisfy a type, with zero deduplication payoff.

## Open

- **Lift `startGpuRenderingBackendLifecycle` action into a helper.** Manhattan /
  MAF / variants × 2 / wiggle × 2 all have nearly identical bodies now —
  `installPerRegionRenderLifecycle(self, self.rpcDataMap, backend, encode,
  (b, encoded) => ...)`. A `startPerRegionLifecycle(self, backend,
  { encode, getRenderState, renderBlocks })` wrapper would collapse each
  call site to one line. Trade-off: one more layer of indirection over a
  helper that already exists. Probably worth it if a 7th plugin shows up;
  premature today.

- **Fix LD `rpcData` casts.** Done — `as LDDataResult | undefined` was
  bogus (the field is already typed `LDDataResult | null`). Removed.

- **Reconsider the `@jbrowse/wiggle-core` package boundary.** Assessed —
  keep it. GWAS / variants / alignments / linear-comparative-view all
  genuinely depend on the shared scale / normalize / YScaleBar
  primitives, so wiggle-core is the right shared library. Did kill the
  `WiggleRenderBlock` re-export (it was an alias of
  `@jbrowse/core/gpu/renderBlock`'s `RenderBlock` — dead weight). 13
  files now import `RenderBlock` directly; ~225 LOC of indirection
  removed.
