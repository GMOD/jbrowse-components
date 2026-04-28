# Plan: split linked-reads-as-beziers into GPU straight lines + SVG curves

## Background grounding (verified symbols)

GPU connecting-line pipeline already in place for chain mode (`renderingMode === 'linkedRead'`):

- Shader: `plugins/alignments/src/LinearAlignmentsDisplay/components/shaders/slang/connectingLine.slang` — instanced 6-vert quad with `Instance { uint startOff, uint endOff, float y }`, hard-coded color `(0,0,0,0.45)`. Snaps to integer Y for crisp 1px stroke.
- Generated module: `connectingLine.generated.ts` (do not edit; regen via `pnpm gen:shaders`).
- Pass id: `PASS_CONN_LINE`, declared in `ALIGNMENTS_PASSES` at `GpuAlignmentsRenderer.ts` ~line 486.
- Upload: `GpuAlignmentsRenderer.uploadConnectingLines` packs via `packConnectingLines` and is gated in `sync()` by `data.connectingLinePositions.length > 0`.
- Draw gate: in `renderBlocks` at line ~865, only fires when `mode === 'linkedRead'` (not `'linkedReadBezier'`).
- Canvas2D parity: `Canvas2DAlignmentsRenderer.drawConnectingLines` (line 1015) — same gating via the same fields on `Canvas2DRegionData`.
- Layout/build: `computeChainLayout.ts` `buildChainConnectingData` produces `connectingLinePositions/connectingLineYs`. `cloneWithChainLayout` layers them on top of `cloneWithLayout` and is wired through `buildLaidOutChainMap`.

Source-of-truth for the bezier overlay:
- `components/computePileupArcs.ts` — pair grouping by readName, normal-vs-aberrant classification, color tables `PAIRED_STROKE` and `splitStroke()`, `connectionBp()` for 3'-end / split-junction selection.
- `components/PileupArcsOverlay.tsx` — single SVG with one `<path>` per arc, hover/click handlers driving `setMouseoverExtraInformation` / `selectFeatureById`.

The model's `renderingMode` getter at `model.ts:301` collapses both flags into three strings: `pileup | linkedRead | linkedReadBezier`. `linkedReadBezier` currently routes through `buildLaidOutChainMap` (so it already has `connectingLinePositions/Ys` available), but the GPU draw call at `GpuAlignmentsRenderer.ts:865` and the Canvas2D draw at `Canvas2DAlignmentsRenderer.ts:588` are gated to `'linkedRead'` only — so chain-line pipeline is already there, just suppressed in bezier mode.

## Differences to reconcile

The chain-mode connecting-line builder uses `chainAbsMinStarts` / `chainAbsMaxEnds` (whole-chain span, indexed by chain). The bezier builder uses 3'-ends per-read joined pairwise within readsByName, with strand-dependent endpoint selection. Geometry inputs are **incompatible**: the chain shader ignores strand, draws min→max of the whole chain, and uses one Y per chain; the bezier convention is per-read endpoint pairs.

Color: chain shader is hard-coded black 0.45 alpha. Bezier straight lines need `PAIRED_STROKE[orientNum]` or `splitStroke(s1,p2Strand)` — at minimum five distinct paired colors plus three split colors. This is a real shader change, not a flag flip.

**Decision: parallel arrays, not extending chain-mode lines.** The geometry and color requirements diverge enough that bolting a `mode` flag onto `connectingLine.slang` would muddle the simple "chain span" semantics it currently has. Add a sibling pass with its own parallel arrays (`linkedReadLinePositions/linkedReadLineYs/linkedReadLineColorTypes`) and a small `linkedReadLine.slang`. Color via UBO palette index (1 byte per instance), not packed RGBA, to mirror how the rest of the alignments pipeline does palette lookup.

---

## Step 1 — Extract `computeLinkedReadLines` as a pure function

**Layer:** main thread (no worker change). **Files:** `components/computePileupArcs.ts` (split), or new sibling `components/computeLinkedReadLines.ts`.

Refactor the inner loop of `computePileupArcs` so the read-pair grouping (`readsByName` + filtering + `connectionBp` + `isNormalOrientation` + orient/strand classification) becomes a single shared traversal that emits **two** outputs:

1. Straight-line records: `{ bp1, bp2, refName1, refName2, y1Row, y2Row, colorType }` where `colorType` is a small enum (paired LR/RL/RR/LL/unknown + split RF/FR/same → 8 values, fits a `Uint8`).
2. Bezier records: the existing `PileupArc[]` shape, restricted to `!isNormal` cases.

`computePileupArcs` becomes a thin wrapper that drops the straight-line emit. Rename it `computePileupBezierArcs` for clarity. The new sibling `computeLinkedReadLines(opts)` returns the straight-line array.

Because the straight-line consumer is the GPU encoder (which wants absolute genomic uint32, not screen pixels), `computeLinkedReadLines` must NOT take `bpToScreenX` — it must emit absolute genomic positions and per-read row indices. The bezier path keeps using screen-pixel `bpToScreenX` like today.

**Subtle issue — multi-region cross-region pairs.** A pair where mates fall in two different `displayedRegions` cannot be drawn by the GPU pass, which uniforms-bind one block at a time and one region per buffer. There is no equivalent of "connecting line that spans two regions" in the existing chain pass either — `chainAbsMinStarts/MaxEnds` are per-region. Filter cross-region pairs out of the straight-line emit and either (a) drop them, or (b) keep them in the SVG bezier list rendered as straight `M…L…` paths so the existing per-region pair rendering doesn't regress for split-region BAMs. Option (b) is what the current code does implicitly. Recommend (b); cross-region count is bounded.

## Step 2 — Add fields to `PileupDataResult` and the chain-layout builder

**Layer:** types + main-thread layout. **Files:**
- `plugins/alignments/src/RenderPileupDataRPC/types.ts` (add optional fields).
- `plugins/alignments/src/LinearAlignmentsDisplay/computeChainLayout.ts` (populate them in `cloneWithChainLayout`).

**Data-shape additions to `PileupDataResult` (FLAGGED EXPLICITLY):**

```ts
// Straight-line GPU-renderable connections for linkedReadBezier mode.
// Absolute genomic uint32 like all worker output (per ARCHITECTURE.md
// coord convention).
linkedReadLinePositions?: Uint32Array  // [bp1,bp2,bp1,bp2,...]
linkedReadLineYs?: Uint16Array         // [y1,y2,y1,y2,...] paired per line
linkedReadLineColorTypes?: Uint8Array  // [colorType,colorType,...] one per line
numLinkedReadLines?: number
```

Note Y is paired-per-endpoint (not single-Y like chain mode) because mates can sit on different rows when `sortedBy` is in effect. The existing chain-line pass assumes one Y per line — another reason the shader has to be a sibling, not a flag.

`buildChainConnectingData`-style work is needed only for the chain-mode bookkeeping, not for these. The new arrays get filled by calling `computeLinkedReadLines(...)` from inside `cloneWithChainLayout` for the **single-region** case, and from `buildLaidOutChainMap`'s multi-region branch after Y assignment is finalized. Pure: input is `(data, readYs)`, output is the three arrays.

But `computeLinkedReadLines` traverses by `readName` across regions. The current per-region traversal in `buildLaidOutChainMap` runs after `readYsFromRowMap` returns per-region Ys. Either:
- **(2a) Hoist the linked-read line pass out of `cloneWithChainLayout`** into a multi-region step that joins entries by `readName` across all `withReads` regions (mirroring the `mergeChains` pattern). It returns a `Map<displayedRegionIndex, { positions, ys, colorTypes }>` where each entry is the lines wholly contained in that region. Cross-region pairs become bezier-overlay straight lines (Step 1 option b).

This is the right shape because chain-line builder already works at the multi-region level for the same reason (mates spanning region boundaries).

**Cache key.** The model's `laidOutPileupMap` getter recomputes when `rpcDataMap | sortedBy | showSoftClipping | renderingMode` changes — the new arrays piggyback on this without adding new MobX deps.

## Step 3 — Add the `linkedReadLine` shader and pass

**Layer:** GPU/shader. **Files:**
- `plugins/alignments/src/LinearAlignmentsDisplay/components/shaders/slang/linkedReadLine.slang` (new).
- Run `pnpm gen:shaders` → emits `linkedReadLine.generated.ts`.

Shader is structurally close to `connectingLine.slang` but:
- `Instance { uint bp1; uint bp2; float y1; float y2; uint colorType; }` (stride 20 bytes).
- Compute `sx1 = hpClipX(hpSplitUint(bp1), u)`, `sx2 = hpClipX(hpSplitUint(bp2), u)`.
- Compute `rowCenter1` and `rowCenter2` from `y1` and `y2` separately (mates can be on different rows).
- For each vertex of the 6-vert quad, lerp X and Y between (sx1,sy1) and (sx2,sy2) along the quad's local-X parameter; thicken via the existing 1-px snap pattern but generalized — pick a perpendicular thickness in CSS px so a slanted line still draws as a 1.5px stroke (mirroring the bezier's `strokeWidth={1.5}`). Either: (a) extrude perpendicular to the segment (cleanest, fragment-shader-free) or (b) draw a `line-list` with `verticesPerInstance: 2` like `arcLine` and rely on driver line rasterization. Option (b) is a single-vertex change away from the existing `arcLine.slang`; recommend (b) for simplicity.
- Color: lookup `u.linkedReadColor[colorType]` — 8 palette slots added to the alignments UBO, populated in `writePaletteToUbo` from a new palette table that mirrors `PAIRED_STROKE` + `splitStroke` outputs.

**Uniform additions (FLAGGED):** 8 ABGR uint32 slots in the alignments UBO. These need byte-offset entries in the UBO layout struct; `pnpm gen:shaders` regenerates `alignmentsUniforms.slang` derived offsets, but the JS-side `U`/`USLOTS` index table in `GpuAlignmentsRenderer.ts` must mirror the new slots.

Add `PASS_LINKED_READ_LINE` to the pass id list and to `ALIGNMENTS_PASSES`. Verify `verticesPerInstance` matches the topology choice (2 for `line-list`, 6 for triangle quad).

## Step 4 — Wire upload in `GpuAlignmentsRenderer`

**Layer:** GPU renderer (main thread). **File:** `components/GpuAlignmentsRenderer.ts`.

- Add `packLinkedReadLines(data: PileupDataResult): ArrayBuffer` next to `packConnectingLines`.
- Add `uploadLinkedReadLines(idx, data)` next to `uploadConnectingLines`.
- In `sync()`, gate on `(data.numLinkedReadLines ?? 0) > 0` and call `uploadLinkedReadLines`. The `ensureRegion(this.regions, idx, emptyRegion)` pattern already covers the region-not-yet-uploaded race.
- In `renderBlocks` add a draw call: `if (mode === 'linkedReadBezier') this.hal.drawPass(PASS_LINKED_READ_LINE, block.displayedRegionIndex)`. Place it **before** `PASS_READ` so reads paint over the connecting lines (matches the chain-mode order at line 866).

## Step 5 — Wire Canvas2D parity

**Layer:** Canvas2D renderer (and SVG export). **File:** `components/Canvas2DAlignmentsRenderer.ts`.

Mirror Step 4 in `Canvas2DRegionData` (sibling fields to `connectingLinePositions/Ys`) and add `drawLinkedReadLines(ctx, region, block, ...)` modeled on `drawConnectingLines` but per-line color from a JS palette parallel to the shader uniform palette, and per-endpoint Y. Gate on `state.renderingMode === 'linkedReadBezier'`. Call site: just below the existing `drawConnectingLines` invocation around line 588. Required so SVG export (`renderSvg.tsx` → `drawAlignmentsToCtx`) gets the lines for free, no parallel SVG-only path (matches the CLAUDE.md prohibition on parallel SVG draw functions).

## Step 6 — Strip straight lines out of the SVG overlay

**Layer:** React. **File:** `components/PileupArcsOverlay.tsx`.

- Switch from `computePileupArcs` to the bezier-only function (Step 1's `computePileupBezierArcs`).
- Drop or relax `MAX_ARCS`. Keep a curve-only safety cap of ~500 (the original pre-bump value) — curves are the SV count, which is bounded by definition. Add a one-line comment that the previous 5000 cap was for normal-pair lines now on GPU.
- Keep all hover/click/selection logic intact — only the input source changed.
- Remove the `console.log` left in `computePileupArcs.ts` while you're there.

## Step 7 — Tests

- `computeChainLayout.test.ts` — extend with linked-read-line emit cases. Cover: paired-LR, paired-RR (excluded — bezier-only), split-FR, split-same-strand, cross-region pair (excluded).
- New `computeLinkedReadLines.test.ts` — pure function table tests for `connectionBp`, `isNormalOrientation`, color-type assignment.
- `coverageParity.test.ts` is for coverage; not relevant. But add a minimal Canvas2D-vs-GPU parity check or rely on the existing browser tests that already exercise `linkedRead` mode chain lines (the new path is structurally the same).

---

## Migration path for the React overlay

| Currently emitted | After | Notes |
|---|---|---|
| Straight `M…L…` paths for normal pairs | Removed — drawn by GPU + Canvas2D | Volume drop is the whole point |
| Bezier `C…` paths for SV pairs | Unchanged | Same hover/click |
| Cross-region pair straight `M…L…` | Kept (small count) | GPU pass can't span regions |
| `MAX_ARCS = 5000` | `MAX_BEZIER_ARCS = 500` (or drop) | SV count is bounded |

`PileupArcsOverlay` continues to mount only when `showLinkedReads && showLinkedReadsAsBeziers`. The GPU pass is also gated on `mode === 'linkedReadBezier'` in `renderBlocks`. They turn on together via `renderingMode`; no new model flag.

---

## Risks / things to check during review

1. **SVG export coverage.** `renderSvg.tsx` calls `drawAlignmentsToCtx` exactly once and the bezier overlay is **not** drawn in SVG export today (PileupArcsOverlay is React-only and `renderSvg.tsx` doesn't render it). Step 5 means GPU/canvas straight lines start flowing into SVG export — that is a behavior change (lines now appear in exports). Curves still won't be in exports unless we add a sibling sashimi-style branch in `renderSvg.tsx` that runs `computePileupBezierArcs` and emits `<path>` per arc. Recommend doing that as a 4-line addition mirroring the sashimi block (lines 89-119 of `renderSvg.tsx`) to maintain export parity now that the on-screen rendering is split. Reviewers should explicitly check whether bezier curves should appear in SVG export — the spec is ambiguous.

2. **UBO layout sync.** Adding 8 palette uint32 slots changes `UNIFORMS_SIZE_BYTES` and shifts every offset constant. The CLAUDE.md note about "byte offsets in `GpuCanvasFeatureRenderer.ts`" applies here to `GpuAlignmentsRenderer.ts` — verify after shader regen.

3. **Per-endpoint Y means line cannot share `connectingLine.slang`.** Don't be tempted to reuse the existing `Instance` schema with `y1=y2`; mates do diverge in row when sorting is enabled.

4. **Color palette consistency.** `PAIRED_STROKE` strings are CSS names (`'lightgrey'`, `'teal'`). The GPU palette wants `RGBColor` (`[r,g,b]` 0..1). Add explicit RGB constants in `shaders/colors.ts` (`colorPairLR/RL/RR/LL` already exist! reuse them) and `colorLongreadFwdRev/RevFwd/Same` (likely also already exist in palettes; verify). The Canvas2D draw must read from the same palette table to stay color-identical to the SVG bezier curves drawn next to it — otherwise normal-pair grey lines and aberrant-pair colored beziers won't visually match a partial-overlap edge case.

5. **Hit testing / picking.** Today the SVG `<path>` gets `onMouseEnter` and `onClick`. After the split, the straight lines (the dominant volume) lose hover. The product trade-off was stated; reviewers should confirm by testing whether users currently rely on hovering normal-pair connecting lines (likely no — they're de-emphasized lightgrey already, and normal pairs are the `color_pair_lr` "uninteresting" case).

6. **Rendering order.** GPU connecting lines draw before reads. Verify `linkedReadBezier` mode draws lines before reads too (Step 4) so reads occlude line endpoints inside the read rectangle, matching chain mode and matching the SVG overlay's `pointerEvents: 'none'` default look.

7. **Y conventions.** The current SVG pass adds `pileupTopOffset - rangeY[0] + readCenterDy` in screen space. The shader does `u.covOffset + y*rowH + featHeight*0.5 - u.scrollTop`. These already match for the existing chain-line pass, but eyeball-verify the linked-read shader uses `featHeight*0.5` so straight-line endpoints land mid-read like the bezier endpoints did.

8. **Cross-region pairs in the bezier overlay.** When a pair straddles displayedRegions, `bpToScreenX` succeeds for both endpoints (as today), so straight-line rendering by the SVG fallback works. Confirm `computeLinkedReadLines` correctly excludes those (test case in Step 7) — otherwise they'd be drawn twice.
