---
name: bp-precision
description: The absolute-uint32 coordinate convention, the three coordinate families the GPU renderers use, and genome-size limits. Read when writing a Slang shader or a CPU instance packer.
kind: spec
---

# BP precision & coordinate conventions

Genomic positions exceed 3×10⁹ on T2T assemblies. Float32's 24-bit mantissa
cannot represent every integer past 2²⁴ ≈ 16.7 Mbp, so a naive float upload loses
~256 bp at 3 Gbp. GPU clip-space is float32 regardless; this doc is how positions
stay exact anyway.

## The absolute-uint32 rule

**Every position array that crosses the worker boundary is absolute genomic
uint32** (reads, gaps, mismatches, interbase, modifications, coverage and
junction segments, wiggle `featurePositions`, and the rest). Absolute rather than
`regionStart`-relative because:

- Region boundaries change on zoom-out, silently invalidating anything keyed to
  `regionStart`.
- Genomic positions are always ≥ 0, so no signed offsets.
- Reversal is the drawing layer's job (`bpToX` on Canvas2D, `flipX` on GPU), not
  the coordinate convention's.
- Every consumer compares against absolute bp (SVG export, hit testing, tooltips,
  `findFeatureInRpcData`, main-thread layout).

Uint32 is exact on `[0, 2³²)` = 4.29 Gbp at 4 bytes per vertex under any zoom.
Internally all features and regions are **0-based half-open** `[start, end)`;
adapters for 1-based formats subtract 1 on ingest, exporters add 1.

## The coordinate families

| Family | Displays | Vertex attribute | Conversion |
|---|---|---|---|
| **LGV bp** | alignments, canvas basic + multi-row, wiggle, variants, MAF, GWAS | absolute genomic `uint` | `bpToClipX(bp, u)` (hi/lo split) |
| **Window-relative cumulative bp** | synteny, dotplot | `float bpRel = cumBp − base` | `bpRel * bpPerPxInv + panPx`, then `screenToClip` |
| **Origin-relative diagonal bp** | Hi-C, LD | bp/√2 off the payload's own `originBp` | `diagonalCellToClip(...)` |
| **Screen space** | variant matrix | CSS px, computed on the CPU | `screenToClip(px, resolution)` |

`hpmath.slang` hosts the hi/lo helpers plus the generic ones every family lands on
(`screenToClip`, `quadLocal`, `extendToMinWidthX`, pixel snapping), so `import
hpmath` does not imply hi/lo math. `diagonalGrid.slang` is shared by Hi-C and both
LD variants so the plugins cannot spell one transform differently.

## LGV family: what you write

Each LGV plugin defines the same wrapper next to its uniform struct:

```slang
float bpToClipX(uint bp, Uniforms u) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero);
}
```

**Don't call `hpToClipX` / `hpSplitUint` directly from a draw shader**: the
wrapper takes a `uint`, so it cannot be handed an already-converted float. The
copies are deliberate. Hoisting the wrapper into `hpmath.slang` needs a Slang
interface every plugin's `Uniforms` must conform to, leaking render-core UBO shape
into plugin structs, and external authors copy a self-contained uniforms module
from the GPU-display guide.

The uniform side is `bpRangeX = [bpStartHi, bpStartLo, ±clippedLengthBp]`, written
by `blockClipUtils.clipBlock` (or `splitPositionWithFrac` for one UBO field).
Length is negated for reversed blocks, which flips clip-x inside `hpToClipX`;
alignments calls `flipX(sx, u)` after conversion instead. The alignments UBO has no
`regionStart` and no `domainStart`/`domainEnd`.

## How the hi/lo split works

Read this when debugging a precision artifact or writing a new uniform module. The
uint32 is cut into a **high** half (bits 12..31, a multiple of 4096) and a **low**
half (bits 0..11), both exact in float32. The CPU splits the viewport start the
same way; the shader subtracts hi-from-hi and lo-from-lo, so every subtraction is
large-minus-large or small-minus-small, with no catastrophic cancellation.

The real `hpToClipX` threads an `hpZero` term and `max(…, -inf)` + `dot()` so the
compiler cannot algebraically collapse `dHi + dLo` into one large subtraction.
**Read `hpmath.slang`; don't retype a simplified copy.**

Uint32-only would lose precision at the float conversion past ~16 Mbp;
float-hi/lo attributes would double per-vertex bytes and push the split onto every
CPU packer. Uint32 storage plus in-shader split gives 4 bytes, full precision and
packers that copy absolute positions unchanged. ADR-008 holds the wiggle-side
equality decision.

## Synteny + dotplot: window-relative Float32 cumulative-bp

A synteny ribbon corner is **cumulative bp across all regions of its view**
(dotplot: its axis), up to Gbp and past uint32 on large assemblies. Both store each
corner relative to a per-axis fetch-time base (`base = offsetPx * bpPerPx`):

- The vertex attribute is one Float32 `bpRel = cumBp − base`. The shader computes
  screen X as `bpRel * bpPerPxInv + panPx`, with `panPx = (base − viewBp) /
  bpPerPx` folded on the CPU in float64 from the small pan since fetch
  (`syntenyRibbonMarks` / `segmentMark`; `computeTransform` is the single
  implementation). Both terms stay sub-pixel in one Float32.
- Synteny bakes the relative value into its geometry buffers (the worker geometry
  **is** the RPC payload; `buildSyntenyGeometry` returns `base0`/`base1`). Dotplot
  builds on the main thread and keeps absolute cumBp `Float64Array`s in geometry,
  because Canvas2D and SVG consume them unchanged; it subtracts the base only at
  GPU upload (`buildLineSegments` carries `baseH`/`baseV`).
- Each plugin's `instanceInterleave.ts` owns a hand-written pack loop (a per-element
  transform a flat packer cannot express), exports it as `interleaveInstances` plus
  an `InstanceCacheOpts` descriptor, and `createInstanceCache` drives it
  ([the recolor fast path](FETCH_KEYS.md#gpuprops-and-derived-region-maps--re-upload-without-refetch)).
  Offsets and stride come from the shader's generated interface.

It works because the fetch re-runs when the window moves, so the base stays near
the view; far-off-screen corners lose absolute precision only on the clipped-away
sliver, with visible error ~`panDistancePx · 2⁻²³`. Storing cumBp avoids the
per-region uniform table that ruled out earlier hp-math attempts and imposes no
`MAX_REGIONS` cap. **ADR-067** is the decision; ADR-010 holds the rejected
per-region tables and ADR-018 the earlier hi/lo shape. Dotplot's v axis does not
refetch on pan, so `panPxV` grows until a zoom recaptures `baseV`; the error bound
still holds (~8.4M px of vertical pan to reach 1 px).

### The Float64 stage is a precision requirement

Narrowing cumBp to Float32 before subtracting rounds at genome scale (~256 bp at 3
Gbp), so `cumBp − base` returns a small number that is precisely wrong. Subtract
in Float64 and narrow the result. uint32 is not the alternative: the `< 2³²` rule
is per chromosome, while cumBp is whole-assembly. `dotplotPrecision.test.ts` and
`buildSyntenyGeometry.precision.test.ts` pin both halves.

| | absolute Float64 cumBp | subtracts the base |
| --- | --- | --- |
| synteny | `executeSyntenyFeaturesAndPositions` → `p11_cumBp`…`p22_cumBp` | `buildSyntenyGeometry`, into Float32 `bp1`…`bp4` |
| dotplot | `buildLineSegments` → `x1`/`y1`/`x2`/`y2` | `instanceInterleave`, at GPU upload only |

**The trap next door:** the `Uint32Array`s beside synteny's Float64 corners
(`starts` / `ends` / `mateStarts` / `mateEnds`) are chromosome-local feature
coords for the detail panel and min-length cull, not the drawn positions.

### Synteny adopting dotplot's shape: declined on bytes

Absolute cumBp across the RPC would be Float64: 16 bytes/instance of corners
becomes 32, roughly +8 MB per region at the plugin's 500k-instance whole-genome
PAF target, and it undoes the "half the position bytes" win. It would also move
the CPU pick path (`projectCorners`), which reads relative values today. The
residual cost is that `base0`/`base1` are a correctness dependency riding with the
data; the one hand-written twin is `bpRel * inv + panPx` in `projectCorners` (TS)
against `computeCorners` (Slang), which ADR-051's scalar-only codegen makes
unavoidable. Don't split the difference by converting on arrival (current cost
plus a copy). Revisit only if one coordinate story across the fleet is worth the
bytes, or a third consumer needs absolute cumBp on the main thread.

### `FeatPos` is absolute and is not what the ribbon is drawn from

`starts`/`ends`/`mateStarts`/`mateEnds` in `SyntenyFeatureData` (handed out as
`FeatPos`) are the original block extent, written before geometry.
`clipLargeBlockToWindow` and `clampBlockToRegions`
(`executeSyntenyFeaturesAndPositions.ts`) then re-anchor the drawn ribbon to its
visible slice, CIGAR-accurately; `startsArray[validCount] = start` stores the
pre-clip value on purpose for the detail panel. Main-thread code reasoning about
what the user sees from `FeatPos` is wrong wherever a block was clipped, which is
the liftOver chain case. Interpolating a mate position across `start..end` was
shipped once and reverted (`8981347686`). Use the worker round trip
`SyntenyResolveMatchingRegion`, which walks the real CIGAR, gated on
`featureData.hasCigar`.

### The same hazard on the CSS side: `staticBlocksTranslateX`

`view.offsetPx` is a whole-genome pixel coordinate (past 1e10 at base resolution on
hg38 chr1). CSS cannot carry it: transforms are float32 at the compositor (~1024px
steps at 1e10) and Blink's `LayoutUnit` saturates at ±33.5M px. So overlay chrome
(gridlines, labels, region seams) is laid out in the *staticBlocks frame*, spanning
only the displayed regions on screen, shifted into the viewport by one transform:
`LinearGenomeView.staticBlocksTranslateX`, a getter so the large-minus-large
subtraction happens in float64. `translateX(-view.offsetPx)` over an
absolutely-placed overlay puts the row somewhere else entirely on large assemblies
at high zoom. `paddingSpans`, `gridlineTicks` and `scalebarLabels` publish `x` in
that frame; `scalebarRefNameLabels` is the exception (screen x, since a sticky label
follows scroll). It is a published surface: `products/jbrowse-build-your-own`
teaches hosts to draw these overlays.

### Hi-C and LD: the origin is why precision is not a problem

`triangleAxis` (display-kit) picks `originBp`, the leading edge of the fetched
block set, and every instance position ships relative to it (bp/√2 on the rotated
axis), so a Float32 attribute carries a span, not a coordinate. The CPU folds the
origin back per frame in double precision: `viewOffsetX = originBp / bpPerPx -
offsetPx` (`viewTransform` from `TriangleMatrixMixin`; maps in `triangleTransform.ts`).
LD lays columns out the same way, in index and genomic mode. `bpPerPx` is absent
from the payload, so pan and zoom are live arithmetic over `viewScale = 1 /
bpPerPx` and a stale matrix draws at its genomic position during a refetch
(ARCHITECTURAL_LIMITS.md §"Staleness mechanisms behind one name").

**A uniform scale that small must stay out of the SVG ctx matrix.** The export
rounds serialized transforms to 2 decimals, so `viewScale` rounds to zero past ~200
bp/px. Hi-C multiplies it onto the coordinates and keeps only rotation and
y-squash on the ctx stack (SVG_EXPORT.md).

## The readout direction: a pixel back to a base

The inverse, a cursor pixel to the base under it, is float64 and still goes wrong
at base boundaries at base-level zoom. **Multiply before dividing, and never form
the fraction.** `bpAtPx` is

```ts
const offset = Math.floor(((px - screenStartPx) * (end - start)) / blockWidth)
return reversed ? end - 1 - offset : start + offset
```

`(px - screenStartPx) * span` is exact (dyadic operands, product ~3e12 against a
2⁵³ budget), so the single division is the only rounding, and its quotient is
either an exact integer or ≥ `1 / blockWidth` from one. Spelling it `frac = (px -
s) / blockWidth` then flooring `frac * span` rounds twice and lands on the wrong
base (wiggle's old local copy, and `bpAtPx` before the fix, each did it
independently). Against an exact rational oracle over 11.6M samples the
multiply-first spelling was wrong 0 times; the two fraction spellings thousands.
Example: 90 bp over 800 px puts base 63's edge at px 560, and the old form reported
62.

**A genome-scale `start` hides this in a sweep**: `floor(start + frac * span)` adds
an addend whose ULP swamps the drift, so a test with realistic starts passes both
spellings. The `canvas2dUtils.test.ts` sweep pins `start: 0` for this reason.

`basePaintedAt` (`@jbrowse/core/util/Base1DUtils`) is already exact and must not be
"fixed" to match: `pxToBp` goes straight to genome-scale bp in one multiply,
`(offsetPx + px) * bpPerPx`, and never forms a normalized fraction whose error would
be amplified by the span.

## Genome-size limits

- **A single reference sequence must be `< 2³²` = 4.29 Gbp.** The one hard
  assumption: every LGV-family `uint32` attribute and every
  `starts`/`ends`/`mateStarts`/`mateEnds` array in the synteny RPC stores
  chromosome-local coordinates. Only a single reference past 4.29 Gbp (certain
  lungfish/amphibian chromosomes) would wrap; out of scope.
- **Whole-assembly cumulative bp has no GPU ceiling.** It is Float64 on the CPU
  (exact to 2⁵³) and window-relative Float32 on the GPU, sub-pixel at any assembly
  size because a zoom recaptures the base. `Region.start`/`end` are Float64
  throughout, with no bitwise coordinate ops.
- **Soft, non-bp ceiling:** synteny's per-instance `featureId`
  (`instanceInterleave.ts`) is a Float32, exact to 2²⁴ ≈ 16.7M rendered instances,
  a density limit on a single whole-genome PAF. Overview-zoom culling keeps counts
  below it.
