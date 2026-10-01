---
name: bp-precision
description: What is the absolute-uint32 coordinate convention, how do synteny and dotplot stay exact at genome scale, and what are the genome-size limits? Read when writing a Slang shader or a CPU instance packer.
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

## Synteny + dotplot: window-relative Float32 cumulative-bp

A synteny ribbon corner is **cumulative bp across all regions of its view**
(dotplot: its axis), up to Gbp and past uint32 on large assemblies. Both store each
corner relative to a per-axis fetch-time base (`base = offsetPx * bpPerPx`):

- The vertex attribute is one Float32 `bpRel = cumBp − base`; the shader computes
  screen X as `bpRel * bpPerPxInv + panPx`, with `panPx` folded on the CPU in
  float64 (`computeTransform` is the single implementation).

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

`basePaintedAt` (`@jbrowse/core/util/Base1DUtils`) is already exact and must not
be "fixed" to match: `pxToBp` goes to bp in one multiply.

## Genome-size limits

- **A single reference sequence must be `< 2³²` = 4.29 Gbp.** The one hard
  assumption: every LGV-family `uint32` attribute and every
  `starts`/`ends`/`mateStarts`/`mateEnds` array in the synteny RPC stores
  chromosome-local coordinates. Only a single reference past 4.29 Gbp (certain
  lungfish/amphibian chromosomes) would wrap; out of scope.
