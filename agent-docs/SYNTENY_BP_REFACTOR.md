# Synteny bp-coordinate refactor (Phase 2 + 3)

Status: **Phase 1 landed. Phase 2+3 code-complete on `webgl-poc` (uncommitted).
Typechecks clean across the workspace. Not yet exercised in a browser;
straddler split deferred. Dotplot follow-up not started.**

## Current state (implementation log)

- `executeSyntenyFeaturesAndPositions.ts` emits `p11_bp..p22_bp` (Uint32) +
  `topRegionIdx`/`botRegionIdx` (Uint8). Viewport culling / `padTop` /
  `padBottom` / `v.offsetPx` / `v.width` dependencies removed.
- `buildSyntenyGeometry.ts` outputs `x1..x4: Uint32` + per-instance
  `topRegionIdx`/`botRegionIdx: Uint8`. CIGAR accumulator runs in integer bp.
  Dropped `viewOffsets`/`viewWidth`/marker emission/`geometryBpPerPx`/
  `refOffset`. **Region-boundary straddler split NOT implemented** — CIGAR
  walks keep the initial instance's (topReg, botReg) even if bp overflows.
  Correct iff an alignment stays within one region per side, which is the
  common case; misrenders at inter-region padding when it doesn't. See
  "Follow-up: straddler split" below.
- `syntenyTypes.slang`: Instance reshaped (x1..x4 → uint, add
  topRegionIdx/botRegionIdx, drop padTop/padBottom). Uniforms: add
  `bpPerPx0/1`, 32 scalar `regionOffsetA0..15`/`regionOffsetB0..15`,
  `hpZero`; drop `adjOff0/1`/`scale0/1`. `computeCorners` uses `hpSplitUint`
  + `hpScaleLinear` + `regionOffsetA(u, idx)` lookup. Individual scalars
  instead of slang arrays — the codegen reflection only supports scalars +
  vectors, and its palette-group detector already bundles them into
  `UNIFORM_SLOT_ARRAYS.regionOffsetA`/`regionOffsetB` for TS consumers.
- `instanceInterleave.ts`: stride is now `36` bytes (9 × 4), all of
  x1..x4/topRegionIdx/botRegionIdx/color packed as uint32; featureId and
  queryTotalLength as float32.
- `GpuSyntenyRenderer.ts`: `RegionMeta` trimmed to
  `{instanceCount, nonCigarInstanceCount}`. `writeUniforms` walks
  `SLOTS.regionOffsetA`/`B` to pack `proj.regionOffsetPx[]` into the uniform
  scalars; `MAX_REGIONS = SLOTS.regionOffsetA.length` (= 16). No
  re-upload on zoom/pan.
- `Canvas2DSyntenyRenderer.ts` and `drawRef.ts` use
  `buildViewProjection(view)` + `projectBpToScreenPx` per frame.
- `syntenyBackendTypes.ts`: `SyntenyTrackRenderParams` now carries
  `projTop`/`projBot` (ViewProjection). `offset0/1`/`bpPerPx0/1` dropped.
- `model.ts`: `SyntenyFeatureData` renamed to bp+regionIdx shape.
  `renderParams` builds the ViewProjection pair via `buildViewProjection`.
- Tests: `executeSyntenyFeaturesAndPositions.test.ts` deleted (tested
  removed exports; `syntenyProjection.test.ts` covers the replacement).
  Renderer test fixtures updated to the new shape (no new tests yet).

## Follow-up: straddler split (deferred)

The plan called for splitting CIGAR walks at region boundaries so a
straddling alignment renders as N fragments sharing `featureId`. This
landing keeps the simpler "use initial region for all fragments" approach.
Symptoms when the shortcut bites:
- Alignment spans two displayed regions with the same refName ⇒ bp >
  region.end ⇒ `hpScaleLinear(bp, bpPerPx)` over-shoots, misrendering across
  the inter-region pad.

To implement correctly:
- Track `(cx1_bp, topRegIdx)` and `(cx2_bp, botRegIdx)` as the CIGAR walk
  accumulator advances.
- When cx crosses out of `[0, regionLen]` on a step, clamp to the boundary,
  emit the partial, compute the absolute genomic coord at the boundary
  (`region.start + cx_bp` forward / `region.end - cx_bp` reversed), re-look
  up via `bpInRegionFromIndex`, reset accumulator in the new region.
- Drop the feature if the lookup fails.
- Unit test: PAF alignment crossing a displayed-region boundary yields N
  instances with the same `featureId`.

## Follow-up: browser testing

Not yet run. The whole point of this refactor is Float32 drift at deep
zoom; needs pixel-exact regression at 1×/4×/16×/256× of initial `bpPerPx`
on T2T-scale data. Straddler hover should resolve to a single logical
alignment once the split above is in place.

## Motivation

The synteny worker currently emits **pixel offsets computed at the fetch-time
`bpPerPx`**. That conflates two concerns into one data stream:

- Genomic features (stable, what the worker actually knows)
- Viewport state (transient, what the renderer actually needs)

Consequences:

- `Float32Array` precision drift past ~2× the worker's geometry `bpPerPx`
  (visible at deep zoom on T2T-scale data).
- Zoom changes invalidate the pixel buffer — today that's papered over by
  re-projection uniforms (`scale`/`adjOff`) that compensate, plus an autorun
  that refetches on `bpPerPx` change (this part Phase 1 already softened).
- Dotplot uses `Float64Array` for `p11..p22` specifically to paper over
  float32 limits — a symptom of the same confusion.

The fix: **worker emits bp, shader projects bp → clip via `hpmath` against
per-view uniforms.** This is the same pattern the alignments plugin adopted
(see `agent-docs/ARCHITECTURE.md` §"Coordinate convention"). Canvas2D does
the same projection on the CPU per frame.

## Phase 1 (done)

- `chainMergeLodBucket` computed getter — value-memoized by mobx, so zoom
  that doesn't cross the LOD bucket doesn't propagate through the autorun.
- Fetch source switched from `staticBlocks.contentBlocks` → `displayedRegions`.
  Zoom-invariant: displayedRegions doesn't change on zoom/pan.
- Dropped redundant `regions` RPC argument (worker derives it from
  `viewSnaps[level].displayedRegions`).
- Replaced `SyntenyViewDuck` with type-only import of `LinearSyntenyViewModel`.
- Added `syntenyProjection.ts` with the bp→pixel helper + 14 unit tests.

Phase 1 does **not** claim "zoom doesn't refetch" — the worker still outputs
pixel-space data, so `bpPerPx`/`offsetPx`/`width` are still legitimate
dependencies of the fetch. `untracked` was considered, flagged as hiding
real dependencies, and removed.

## Phase 2 + 3 (do together — not separately)

The original plan had Phase 2 as "worker emits bp, GPU still reads F32" and
Phase 3 as "shader hpmath." Attempting Phase 2 in isolation hit a problem:

The existing shader formula is `sx = (x - adjOff) * scale - pad * (scale - 1)`
which assumes `x` is a pixel with **padding baked in at geometryBpPerPx**.
The `-pad*(scale-1)` term is the zoom-compensation for that baked-in padding.
If `x` is bp instead, the correct formula becomes
`sx = x/bpPerPx + pad - offsetPx`, which **cannot** be rewritten into the old
shader's form because it needs `pad` inside the uniform `adjOff` — and `pad`
varies per instance.

So Phase 2 standalone would either (a) regress zoom performance by
re-uploading the whole instance buffer on every `bpPerPx` change, or
(b) keep an intermediate shader that's throwaway code. Neither is worth
shipping. Do the full thing as one PR.

## Design: bp + regionIdx per corner

**Do not** use a "virtualBp concat" across displayedRegions. Simpler:

- Each corner of each instance is stored as **`(bp_in_region, regionIdx)`**
  — `Uint32Array` of bp-offset-within-one-region plus `Uint8Array` of
  region index. `bp_in_region` accounts for reversed regions at worker
  time (`reversed ? end - coord : coord - start`).
- Straddlers (features crossing a region boundary) are split at worker time
  into multiple instances that share the same `featureId` for hover/click.
- Per-view, main thread precomputes a **`ViewProjection`** table:
  `regionOffsetPx[regionIdx]` = screen pixel where the region's `bp=0`
  lands, with non-elided inter-region padding folded in and `offsetPx`
  already subtracted. See `syntenyProjection.ts` (already landed in Phase 1).

### Main-thread projection

```ts
px = regionOffsetPx[regionIdx] + bp_in_region / bpPerPx
```

Used by `Canvas2DSyntenyRenderer` per frame.

### Shader projection (hpmath)

`hpScaleLinear(splitPos, float3(0, 0, bpPerPx), hpZero)` returns
`bp_in_region / bpPerPx` with hi/lo precision preserved. Add the
`regionOffsetPx[regionIdx]` from a uniform array:

```
float2 split = hpSplitUint(inst.x1);
float3 bpRange = float3(0, 0, u.bpPerPx0);
float px_in_region = hpScaleLinear(split, bpRange, u.hpZero);
c.x1 = u.regionOffsetPx0[inst.topRegionIdx] + px_in_region;
```

`regionOffsetPx[]` changes on pan/zoom but is a uniform array (not per-vertex),
so updates are cheap. Feature data buffer never re-uploads on pan/zoom — zoom
becomes a uniform write.

### Uniform shape

Per-view (suffix `0` = top view, `1` = bottom view):

- `bpPerPx0: f32`, `bpPerPx1: f32`
- `regionOffsetPx0[MAX_REGIONS]: f32[]`, `regionOffsetPx1[MAX_REGIONS]: f32[]`
- `hpZero: f32` (always `0.0` — `hpmath` sentinel)

Drop: `adjOff0`, `adjOff1`, `scale0`, `scale1`. They don't map cleanly to the
new formula and the `pad*(scale-1)` zoom-compensation term is gone entirely.

**`MAX_REGIONS = 16`**: generous for pairwise synteny. If we hit the cap,
fall back to per-region-pair draw calls (texture-backed table deferred).

## File-by-file change list

### New files

- `syntenyProjection.ts` — **already landed** in Phase 1.
- `syntenyProjection.test.ts` — **already landed** in Phase 1.
- (Maybe) ADR `agent-docs/architecture-decision-records/adr-NNN-synteny-bp-coordinates.md`
  — one-paragraph ADR pointing at this doc.

### Worker (`plugins/linear-comparative-view/src/LinearSyntenyRPC/`)

**`executeSyntenyFeaturesAndPositions.ts`**

- Drop `bpToPx`, `buildBpToPxIndex`, `bpToPxFromIndex`. Replace with
  `buildBpInRegionIndex` + `bpInRegionFromIndex` from `syntenyProjection.ts`.
- Emit `p11_bp..p22_bp` as `Uint32Array` of bp-in-region, plus
  `p11_regionIdx..p22_regionIdx` as `Uint8Array`.
- Drop `padTop`/`padBottom` (main-thread concern now).
- Drop viewport culling entirely — shader's `isCulled` + Canvas2D's
  `isEdgeCulled` already handle it post-projection. The worker no longer
  reads `v.offsetPx`, `v.width`.
- Worker still reads `v.bpPerPx` only for adapter LOD (`getFeaturesInMultipleRegions(..., { bpPerPx })`).
- Drop `viewSnaps[i].width` / `offsetPx` / `staticBlocks` from the RPC
  payload — they're no longer consumed. Narrow the `ViewSnap` type for
  this worker to just `{ bpPerPx, displayedRegions, interRegionPaddingWidth, minimumBlockWidth }`
  (or: keep `ViewSnap` as-is; worker just ignores extra fields).

**`buildSyntenyGeometry.ts`**

- CIGAR accumulator runs in integer bp. `d1 = len`, `d2 = len` (no
  `bpPerPxInv` multiply). The sub-pixel indel merge (`relevantPx < 1`)
  becomes an LOD-bucket decision consulting `chainMergeLodBucket`-style
  quantization — or deferred until the GPU can tell us it's visually
  pointless (Phase 2 keeps the current merge at whatever bpPerPx the
  worker sees, document as LOD-approximate).
- Drop `viewOffsets`/`viewWidth` culling entirely.
- Drop marker emission — move to main-thread Canvas2D (markers are
  viewport-dependent pixel spacings, and they're cheap to generate per
  frame for the currently-visible features).
- Output `x1..x4` as `Uint32Array`, plus `topRegionIdx: Uint8Array` and
  `botRegionIdx: Uint8Array`. Drop `padTops`/`padBottoms`,
  `geometryBpPerPx0/1`, `refOffset0/1`.
- Region-boundary splitting: when `cx1` (or `cx2`) crosses out of its
  current region during the CIGAR walk, emit the partial instance, advance
  `topRegionIdx` (or `botRegionIdx`), continue. All fragments share the
  same `featureId` (used only for hover/click identity).

**`SyntenyGetFeaturesAndPositions.ts`** (RPC glue) — interface changes only
to match the new payload.

### GPU (`plugins/linear-comparative-view/src/LinearSyntenyDisplay/shaders/`)

**`syntenyTypes.slang`**

- `Instance`: `x1..x4` → `uint`. Add `topRegionIdx: uint`, `botRegionIdx: uint`.
  Drop `padTop`, `padBottom`.
- `Uniforms`: add `bpPerPx0`, `bpPerPx1`, `regionOffsetPx0[16]`,
  `regionOffsetPx1[16]`, `hpZero`. Drop `adjOff0/1`, `scale0/1`.
- `computeCorners`: `hpSplitUint` per corner → `hpScaleLinear(split, float3(0, 0, bpPerPxN), u.hpZero)` →
  add `regionOffsetPxN[regionIdx]`. Top two use `topRegionIdx`; bottom two use `botRegionIdx`.
- `isCulled`: unchanged (still pixel-space post-projection).
- `import hpmath;`

**`syntenyFill.slang` / `syntenyEdge.slang` / `syntenyPicking.slang`** —
no logic changes beyond consuming the new Instance struct. `computeCorners`
call site unchanged.

**Regenerate**: `pnpm gen:shaders`. Verify the three `.generated.ts` files
update and that WGSL + GLSL paths compile.

**`instanceInterleave.ts`**

- Instance stride changes (x* become 4-byte uints, regionIdx attrs added,
  padTop/padBottom dropped). Regenerate the offsets via `gen:shaders`.
- Pack x1..x4 via `dv.setUint32(...)`; pack region indices as uint.

**`GpuSyntenyRenderer.ts`**

- Kill `TrackState.scale*`/`adjOff*`/`geometryBpPerPx*`/`refOffset*`.
  `makeTrackState` becomes `{ key, params, maxOffScreenPx }`.
- `writeUniforms`: build per-view `regionOffsetPx[]` arrays from
  `buildViewProjection(view)` and write to uniform array slots.
- `RegionMeta` shrinks to `{ instanceCount, nonCigarInstanceCount }`.
- `uploadGeometry` no longer re-uploads on bpPerPx change — but the
  existing autorun-driven upload will fire once per RPC payload. Same
  behavior.

### Canvas2D (`plugins/linear-comparative-view/src/LinearSyntenyDisplay/`)

**`Canvas2DSyntenyRenderer.ts`**

- Delete `ComputedTransform`, `computeTransform`. Replace with a
  `ViewProjection` pair built from `buildViewProjection(view)` for
  level and level+1.
- `projectCorners(data, i, projTop, projBot)` uses
  `projectBpToScreenPx(data.x1[i], data.topRegionIdx[i], projTop)` etc.
- `widenCorners`, `isEdgeCulled`, `buildFeaturePath` unchanged (they're
  pixel-space post-projection).
- `render(state)` needs the two `ViewProjection` tables per track. Either:
  - (a) State carries them (render-state augmentation), or
  - (b) Canvas2D stores them per `key` like it stores `SyntenyInstanceData`.
  - (a) is cleaner; aligns with how GpuSyntenyRenderer gets viewport info
    through `state.perTrack[key].params`.

**`drawRef.ts`** — same projection swap as Canvas2D. It shares the same
CIGAR decomposition approach, so the projection helpers apply verbatim.

**`renderSvg.tsx`** — consumes `CanvasLike` via `SvgCanvas`. Update the
wrapper to pass the new projections through.

### Model (`plugins/linear-comparative-view/src/LinearSyntenyDisplay/`)

**`model.ts`**

- `SyntenyFeatureData` — rename `p11_offsetPx` → `p11_bp`, add
  `p11_regionIdx` etc. Drop `padTop`/`padBottom`. Existing consumers of
  `featureData.p11..p22` (just `drawRef.ts`) already covered.
- `renderParams` — stays the same shape unless Canvas2D chooses (a) above,
  in which case add `viewProjections: [ViewProjection, ViewProjection]`.

### Tests (known to break)

- `executeSyntenyFeaturesAndPositions.test.ts` — currently asserts pixel
  shapes; rewrite against bp+regionIdx shapes.
- `Canvas2DSyntenyRenderer.test.ts` — projection test needs new inputs.
- `GpuSyntenyRenderer.test.ts` — uniform writes changed.
- `syntenyBounds.test.ts` — unrelated to coordinates, should still pass.
- Add: region-boundary splitter test (straddler produces N fragments with
  same featureId).
- Add: shader-compile test (both WGSL + GLSL) for the new uniform array
  syntax.

### Browser tests (mandatory)

- Pixel-exact visual regression at 1×/4×/16×/256× of initial `bpPerPx`.
  The 256× case shows drift today; it should disappear after the refactor.
- Straddler hover: feature crossing a region boundary must resolve to
  a single logical alignment on hover.

## Dotplot (follow-up PR — not started)

Dotplot has the same problem (`Float64Array p11..p22` + `scaleX`/`scaleY`
papered over Float32 drift). The synteny-side pattern carries over directly:

**Worker** (`executeDotplotFeaturesAndPositions.ts`):
- Reuse `buildBpInRegionIndex` / `bpInRegionFromIndex` from
  `plugins/linear-comparative-view/src/LinearSyntenyDisplay/syntenyProjection.ts`.
  Either extract to a shared location (e.g. `packages/core/src/util/`) or
  import cross-plugin — the helper is deliberately view-agnostic.
- Replace `p11_offsetPx..p22_offsetPx: Float64Array` with `p11_bp..p22_bp:
  Uint32Array` + `p11_xRegionIdx..p22_xRegionIdx`/`...yRegionIdx: Uint8Array`
  (dotplot corners are on two orthogonal axes — x uses H regions, y uses V).
- Drop the file-local `buildBpToPxIndex` copy (lines 11–71 today) — delete
  the 73-77 sub-pixel-rounding comment along with it.
- Drop `bpPerPxH`/`bpPerPxV` from the RPC payload; the renderer reads them
  from the live view.

**Geometry** (`drawDotplotWebGL.ts`):
- `buildLineSegments` and `decomposeCigar` currently run in pixel space —
  port to bp space. The per-op accumulator becomes integer bp advancement,
  same pattern as `buildSyntenyGeometry`. Emit `x1s/y1s/x2s/y2s: Uint32Array`
  + `xRegionIdx`/`yRegionIdx: Uint8Array` instead of Float32 pixels.
- `ensureMinExtent` moves to the main-thread projection step (it's a
  pixel-space concern).
- `MIN_CIGAR_PX_WIDTH` gating becomes an LOD-approximate bucket at the
  worker's fetch-time bpPerPx (same compromise as synteny).

**Shader** (`dotplot.slang`):
- Instance: `x1/y1/x2/y2` → `uint`, add `xRegionIdx`/`yRegionIdx` uint.
- Uniforms: add `bpPerPxH`, `bpPerPxV`, `regionOffsetH0..15`,
  `regionOffsetV0..15`, `hpZero`. Drop `scaleX`, `scaleY`, `offsetX`,
  `offsetY` (pad becomes unneeded — per-region offsets fold it in).
- Vertex shader:
  ```
  float sx1 = regionOffsetH(u, inst.xRegionIdx)
            + hpScaleLinear(hpSplitUint(inst.x1), float3(0,0,u.bpPerPxH), u.hpZero);
  float sy1 = u.resolution.y
            - (regionOffsetV(u, inst.yRegionIdx)
               + hpScaleLinear(hpSplitUint(inst.y1), float3(0,0,u.bpPerPxV), u.hpZero));
  ```
- Two helper functions `regionOffsetH/V(u, idx)` — same switch pattern as
  `regionOffsetA/B` in `syntenyTypes.slang`.

**Renderers** (`GpuDotplotRenderer.ts`, `Canvas2DDotplotRenderer.ts`,
`renderSvg.tsx`):
- `DotplotRenderState` carries per-track `{displayKey, projH, projV}`
  instead of `{displayKey, scaleX, scaleY}`. `offsetX`/`offsetY` drop out
  (folded into `ViewProjection.regionOffsetPx`).
- `Canvas2DDotplotRenderer.render` projects via `projectBpToScreenPx` per
  segment corner. `this.height - (...)` y-flip stays.
- `GpuDotplotRenderer.render` writes `regionOffsetH/V` arrays with
  `SLOTS.regionOffsetH/V` (auto-emitted by the shader codegen once the
  slang palette fields exist).
- `renderSvg.tsx` drops the `transform=translate...scale...translate`
  trick — the bp-to-pixel projection happens per line now.
- `DotplotView/model.ts` ~line 394: the trackScales block becomes
  per-track `{displayKey, projH, projV}` built via `buildViewProjection`
  against `hview`/`vview`.
- `types.ts` / `dotplotBackendTypes.ts` updated alongside.

**Suggested order**: worker → geometry → shader (+ gen:shaders) →
renderers → types/model. Landed synteny is the reference implementation.
Size estimate ~400-800 LOC across ~8 files.

Ship synteny first; dotplot as a follow-up PR. They share no rendering
code but would benefit from extracting `syntenyProjection.ts`'s
`buildBpInRegionIndex`/`bpInRegionFromIndex`/`ViewProjection`/
`buildViewProjection`/`projectBpToScreenPx` to
`packages/core/src/util/bpProjection.ts` before dotplot lands, since
dotplot will consume them too.

## Risks

- **>16 regions per view**: fall back to per-region-pair draw calls, warn.
  Defer texture-backed table.
- **Shader uniform array compilation**: WGSL and GLSL both support uniform
  arrays; verify both paths compile after `gen:shaders`.
- **Straddler splitter correctness**: cover with a unit test that exercises
  a PAF alignment crossing a displayed-region boundary.
- **Precision at T2T scale**: the whole point. Covered by browser tests at
  deep zoom.

## Suggested PR split

1. **PR 1 (this work)**: everything synteny-side in one PR. Big but
   coherent — intermediate states have no value.
2. **PR 2**: dotplot mechanical port.
3. **PR 3** (optional): texture-backed region tables if >16 regions
   turns out to matter in practice.

## Estimated size

~800–1500 LOC changed across ~12 files (synteny PR). Shader regen adds
more line count but isn't hand-authored.
