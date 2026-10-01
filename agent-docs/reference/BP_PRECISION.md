---
name: bp-precision
description: The absolute-uint32 coordinate convention, the three coordinate families the GPU renderers use, and genome-size limits. Read when writing a Slang shader or a CPU instance packer.
kind: spec
---

# BP precision & coordinate conventions

Float32's 24-bit mantissa loses ~256 bp at 3 Gbp, and clip-space is float32
regardless; Uint32-only positions lose precision past ~16 Mbp at the float
conversion. This doc is how positions stay exact anyway.

## The absolute-uint32 rule

**Every position array that crosses the worker boundary is absolute genomic
uint32.** Absolute rather than `regionStart`-relative because region boundaries
change on zoom-out, and every consumer (SVG export, hit testing, tooltips,
`findFeatureInRpcData`, main-thread layout) compares against absolute bp.
Reversal is the drawing layer's job (`bpToX` on Canvas2D, `flipX` on GPU).

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

`hpmath.slang` hosts the hi/lo helpers plus the generic ones every family lands
on, so `import hpmath` does not imply hi/lo math. `diagonalGrid.slang` is shared
by Hi-C and both LD variants.

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

The uniform side is `bpRangeX = [bpStartHi, bpStartLo, ±clippedLengthBp]`,
written by `blockClipUtils.clipBlock`. Length is negated for reversed blocks;
alignments calls `flipX(sx, u)` after conversion instead.

## How the hi/lo split works

The uint32 is cut into a high half (a multiple of 4096) and a low half, both
exact in float32; the CPU splits the viewport start the same way and the shader
subtracts hi-from-hi and lo-from-lo. The real `hpToClipX` threads an `hpZero` term
so the compiler cannot collapse `dHi + dLo` into one large subtraction. **Read
`hpmath.slang`; don't retype a simplified copy.** Float-hi/lo attributes would
double per-vertex bytes and push the split onto every CPU packer; ADR-008 holds
the wiggle-side equality decision.

## Synteny + dotplot: window-relative Float32 cumulative-bp

A synteny ribbon corner is **cumulative bp across all regions of its view**
(dotplot: its axis), up to Gbp and past uint32 on large assemblies. Both store each
corner relative to a per-axis fetch-time base (`base = offsetPx * bpPerPx`):

- The vertex attribute is one Float32 `bpRel = cumBp − base`; the shader computes
  screen X as `bpRel * bpPerPxInv + panPx`, with `panPx` folded on the CPU in
  float64 (`computeTransform` is the single implementation).
- Synteny bakes the relative value into its geometry buffers
  (`buildSyntenyGeometry` returns `base0`/`base1`). Dotplot keeps absolute
  cumBp `Float64Array`s because Canvas2D and SVG consume them unchanged, and
  subtracts the base only at GPU upload (`buildLineSegments` carries
  `baseH`/`baseV`).
- Each plugin's `instanceInterleave.ts` owns the hand-written pack loop that
  `createInstanceCache` drives
  ([the recolor fast path](FETCH_KEYS.md#gpuprops-and-derived-region-maps--re-upload-without-refetch)).

The fetch re-runs when the window moves, so the base stays near the view.
**ADR-067** is the decision; ADR-010 holds the rejected per-region tables and
ADR-018 the earlier hi/lo shape. Dotplot's v axis does not refetch on pan, so
`panPxV` grows until a zoom recaptures `baseV`; the error bound still holds.

### The Float64 stage is a precision requirement

Narrowing cumBp to Float32 before subtracting rounds at genome scale (~256 bp at 3
Gbp), so `cumBp − base` returns a small number that is precisely wrong. Subtract
in Float64 and narrow the result. uint32 is not the alternative: the `< 2³²` rule
is per chromosome, while cumBp is whole-assembly. `dotplotPrecision.test.ts` and
`buildSyntenyGeometry.precision.test.ts` pin both halves.

**The trap next door:** the `Uint32Array`s beside synteny's Float64 corners
(`starts` / `ends` / `mateStarts` / `mateEnds`) are chromosome-local feature
coords for the detail panel and min-length cull, not the drawn positions.

### Synteny adopting dotplot's shape: declined on bytes

Absolute Float64 cumBp across the RPC doubles the corner bytes (roughly +8 MB per
region at the 500k-instance whole-genome PAF target) and moves the CPU pick path
(`projectCorners`). The one hand-written twin, `bpRel * inv + panPx` in
`projectCorners` against `computeCorners` (Slang), is unavoidable under ADR-051.
Converting on arrival splits the difference at the cost of both.

### `FeatPos` is absolute and is not what the ribbon is drawn from

`starts`/`ends`/`mateStarts`/`mateEnds` in `SyntenyFeatureData` are the original
block extent, written before `clipLargeBlockToWindow` and `clampBlockToRegions`
re-anchor the drawn ribbon to its visible slice. Main-thread code reasoning about
what the user sees from `FeatPos` is wrong wherever a block was clipped (the
liftOver chain case); interpolating a mate position across `start..end` shipped
once and was reverted. Use the worker round trip `SyntenyResolveMatchingRegion`,
gated on `featureData.hasCigar`.

### The same hazard on the CSS side: `staticBlocksTranslateX`

`view.offsetPx` is a whole-genome pixel coordinate (past 1e10 on hg38 chr1), and
CSS cannot carry it: compositor transforms are float32 and Blink's `LayoutUnit`
saturates at ±33.5M px. Overlay chrome is laid out in the *staticBlocks frame*
and shifted by `LinearGenomeView.staticBlocksTranslateX`, a getter so the
subtraction happens in float64. `translateX(-view.offsetPx)` over an
absolutely-placed overlay lands somewhere else entirely. `paddingSpans`,
`gridlineTicks` and `scalebarLabels` publish `x` in that frame;
`scalebarRefNameLabels` publishes screen x. `products/jbrowse-build-your-own`
teaches hosts to draw these overlays.

### Hi-C and LD: the origin is why precision is not a problem

`triangleAxis` (display-kit) picks `originBp` and every instance position ships
relative to it, so a Float32 attribute carries a span, not a coordinate. The CPU
folds the origin back per frame in double precision (`viewTransform` from
`TriangleMatrixMixin`). `bpPerPx` is absent from the payload, so a stale matrix
draws at its genomic position during a refetch (ARCHITECTURAL_LIMITS.md
§"Staleness mechanisms behind one name").

**A uniform scale that small must stay out of the SVG ctx matrix.** The export
rounds serialized transforms to 2 decimals, so `viewScale` rounds to zero past ~200
bp/px. Hi-C multiplies it onto the coordinates and keeps only rotation and
y-squash on the ctx stack (SVG_EXPORT.md).

## The readout direction: a pixel back to a base

The inverse, a cursor pixel to the base under it, is float64 and still goes wrong
at base boundaries. **Multiply before dividing, and never form the fraction.**
`bpAtPx` is

```ts
const offset = Math.floor(((px - screenStartPx) * (end - start)) / blockWidth)
return reversed ? end - 1 - offset : start + offset
```

The product is exact, so the single division is the only rounding. Flooring
`frac * span` after `frac = (px - s) / blockWidth` rounds twice and lands on the
wrong base (90 bp over 800 px puts base 63's edge at px 560; the fraction form
reported 62).

**A genome-scale `start` hides this in a sweep**: `floor(start + frac * span)` adds
an addend whose ULP swamps the drift, so a test with realistic starts passes both
spellings. The `canvas2dUtils.test.ts` sweep pins `start: 0` for this reason.

`basePaintedAt` (`@jbrowse/core/util/Base1DUtils`) is already exact and must not
be "fixed" to match: `pxToBp` goes to bp in one multiply.

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
