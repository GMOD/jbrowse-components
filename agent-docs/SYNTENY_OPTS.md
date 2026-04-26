# Synteny Optimization Tracking

Tracks the linear synteny RPC / display perf work. Path covered:
`plugins/comparative-adapters/src/` → `LinearSyntenyRPC/` →
`LinearSyntenyDisplay/` → GPU/Canvas2D renderers.

## Done

Worker / RPC contract:
- Drop dead `drawRef.ts` path (-470 lines); also drops `cigars: string[]`
  field on `SyntenyFeatureData` and the `parsedCigars` getter on the model.
- Fix `estimateInstanceCount` over-allocation that caused multi-GB
  pre-allocations on whole-genome PAF at low zoom. Pre-pass now also computes
  `maxIndelLens` for the CIGAR short-circuit.
- Split `SyntenyInstanceData` into `SyntenyGeometry` (worker output) and
  `SyntenyInstanceData = SyntenyGeometry & { colors }` (renderer input). Worker
  no longer calls `computeSyntenyColors` — main thread always overwrites via
  `computedColors`. See ADR-012.
- Drop `featureIds: Float32Array` from worker output; derive
  `instanceFeatureIdx[i] + 1` at consumer (interleave / Canvas2D / hover).
- Replace `bpPerPxs/viewOffsets/level` array params on
  `buildSyntenyGeometry` with scalar `bpPerPx0/bpPerPx1/viewOff0/viewOff1`.
- Pack `mates: object[]` as parallel `mateStarts/mateEnds` (Uint32) +
  `mateRefNames/mateAssemblyNames` (string[]). Drop dead `mate.name` field.
- bp coords (`starts`, `ends`, `mateStarts`, `mateEnds`) → `Uint32Array`
  (matches the rest of the codebase). Pixel offsets stay Float64 since they
  accumulate × 1/bpPerPx and exceed 2^32 at low zoom.
- `identitiesArray`: Float64 → Float32 (0–1 fractions).
- Pre-cull features by `refName` (`v1Index.entries.has(refName) &&
  v2Index.entries.has(mate.refName)`) before the four `bpToPxFromIndex`
  calls. Saves 4 Map.get + 4 result-object allocs per culled feature.

Hot-loop micro-cleanups in `executeSyntenyFeaturesAndPositions`:
- Strand swap: `[f1e, f1s] = [f1s, f1e]` (per-feature 2-element array alloc) →
  `const f1s = strand === -1 ? end : start`.
- Hoist `-bufferPx` and `viewWidth + bufferPx` out of the off-screen check.
- Drop duplicate `v0`/`v1Snap` aliases; reuse `v1`/`v2`.

Dead-code sweep (all leftover from `drawRef.ts`):
- `LinearSyntenyDisplayModel.queryTotalLengths` getter
- `components/util.ts`: `draw`, `drawLocationMarkers`, `drawBox`,
  `drawBezierBox`, inner `CanvasLike`
- `drawSyntenyUtils.ts`: `lineLimit`, `oobLimit`, `OP_TO_CIGAR_KEY` + their
  CIGAR_* imports

## Next steps — measure before doing

We've taken the clearly-good wins. Each remaining item below is real but
either speculative or bounded; do it after profiling a known-slow workload
identifies it as the bottleneck.

### Phase 2b: string-intern shared dictionary for refNames / assemblyNames / mate*RefNames

- Replace four `string[]` arrays of length N with `(stringTable: string[]; …Idx: Uint16Array)`.
- Whole-genome PAF: ~10–15MB transfer savings per RPC. Bound by `postMessage`
  serialization speed (modern systems are fast).
- Cascades through `getFeatureAtIndex`, `getTooltip`, `syriClassification`,
  `computeSyriTypes`, `DiagonalizationProgressDialog`, possibly more.
- **Trigger**: profile shows postMessage / structured-clone in worker→main as
  >50ms in a typical zoom on a real PAF.

### Phase 3 (revised): per-instance color recompute skip

- I previously thought this would also skip the GPU re-upload. It won't —
  the interleaved buffer contains both geometry (`x1..x4`) and color, and
  geometry changes every zoom, so the upload happens regardless.
- Net savings = ~30ms of CPU color-loop per RPC for ~3M instances. Marginal.
- **Trigger**: skip unless profile specifically points at `computeSyntenyColors`.

### CIGAR cache across RPCs

- Worker-level `WeakMap<adapter, Map<featureId, parsedCigar>>` so re-zoom
  doesn't re-parse the same CIGARs.
- Useful for long-read PAFs (50+ ops per feature).
- Risk: unbounded memory growth without eviction. Need an LRU cap, plus a
  story for invalidation on adapter change (WeakMap helps but doesn't bound
  the inner Map's size).
- **Trigger**: profile shows `parseCigar2` >100ms on re-zoom of a long-read
  PAF. Without that signal, the eviction-policy work isn't justified.

### Phase 4: lazy `getWeightedMeans`

- Currently runs at `setupPre` for `PAFAdapter` / `MashMapAdapter` /
  `ChainAdapter` / `DeltaAdapter`. The `meanScore` it computes is read only
  by the dotplot view. Linear-synteny ignores it.
- Move to a lazy getter so adapters used only by linear-synteny skip the
  ~100–300ms two-pass setup.
- One-shot saving (cached via `setupP`), not per-RPC.
- **Trigger**: small enough that "feels worth it" suffices — or skip if no
  user complaint about adapter setup time.

### Canvas2D inner-loop allocations

- `projectCorners` and `widenCorners` allocate fresh `ProjectedCorners`
  objects per instance in `drawInstances`. ~200K allocs/frame at typical
  visible counts.
- Only matters when the GPU path isn't available (no WebGL/WebGPU, SVG
  export, certain tests). Niche.
- **Trigger**: only if Canvas2D path becomes user-facing for a non-niche
  audience.

## Open ideas (not on the plan, parking lot)

- **Adapter-time CIGAR pre-parse**: would require adapter contract change
  (Feature shape gains a `parsedCIGAR: number[]` field). User flagged adapter
  changes as "may not be acceptable". Would have to coordinate with dotplot
  and other consumers.
- **Streaming feature collection in the worker**: blocked by
  `chainCollinearAlignments` which needs the full set.
- **`featureId` shader attribute uint conversion**: already analyzed in
  ADR-012; the picking framebuffer is RGB888 (24-bit), so Float32's mantissa
  already covers the practical range. Not worth touching three shaders.

## Methodology note

These items got deferred specifically because their payoff vs. effort is
hard to predict without numbers. The next genuine optimization step is
**measurement**, not more code. Profile a representative slow workload
(e.g., a known-large PAF at low zoom) with the browser's performance tab,
and let the longest bars decide which item above to pull off the shelf.
