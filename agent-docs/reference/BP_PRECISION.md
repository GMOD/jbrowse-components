---
name: bp-precision
description: The absolute-uint32 coordinate convention, the three coordinate families the GPU renderers use, and genome-size limits. Read when writing a Slang shader or a CPU instance packer.
---

# BP precision & coordinate conventions

Genomic positions exceed 3×10⁹ on T2T assemblies. Float32's 24-bit mantissa
can't represent every integer past 2²⁴ ≈ 16.7 Mbp, so a naive float upload loses
~256 bp of precision at 3 Gbp. GPU clip-space is unavoidably float32 — this doc
is how we keep positions exact anyway.

## TL;DR

- **Every position array crossing the worker boundary is absolute genomic
  uint32.** No pixel coordinates, no `regionStart`-relative offsets, no
  `regionStart +` arithmetic downstream.
- Intervals are **0-based half-open** `[start, end)`, matching BED/BAM.
- In an LGV-family shader you write `bpToClipX(bp, u)` and stop thinking about
  precision. The hi/lo split lives inside that one wrapper.
- Synteny and dotplot use a different scheme: cumulative-bp stored
  **window-relative** as a single Float32 against a per-axis fetch-time base
  (ADR-067).
- Limits: one chromosome must be `< 2³²` (the one hard assumption);
  whole-assembly cumulative bp has **no** GPU ceiling.

## The absolute-uint32 rule

**Every position array that crosses the worker boundary is absolute genomic
uint32** — reads, gaps, mismatches, interbase (ins/soft/hardclip), softclip
bases, modifications, SNP/noncov/indicator/modCov segments, sashimi junctions,
chain connecting lines, `coverageStartPos`, `readNextPositions`, wiggle
`featurePositions`.

Why absolute rather than regionStart-relative:

- **Region boundaries change on zoom-out.** Anything keyed to `regionStart` is
  silently invalidated when the anchor shifts.
- **No signed offsets needed** — genomic positions are always ≥ 0.
- **Reversal is orthogonal.** The drawing layer handles reversed regions
  (`bpToX` on Canvas2D, `flipX` on GPU), not the coordinate convention.
- **Every consumer compares against absolute bp** — SVG export, Canvas2D, hit
  testing, tooltips, `findFeatureInRpcData`, main-thread layout.

Uint32 is exact for `[0, 2³²)` = 4.29 Gbp, so absolute storage costs 4 bytes per
vertex and stays valid under any zoom.

## The 0-based half-open convention

JBrowse uses **0-based half-open intervals** `[start, end)` internally for all
genomic features and regions, matching BED/BAM. Adapters that read 1-based
formats (VCF `POS`, GFF `start`) subtract 1 on ingest; exporters that write
1-based formats add 1 on output.

## Three coordinate families

| Family | Displays | Vertex attribute | Conversion |
|---|---|---|---|
| **LGV bp** | alignments, canvas basic + multi-row, wiggle, variants, MAF, GWAS | absolute genomic `uint` | `bpToClipX(bp, u)` (hi/lo split, below) |
| **Window-relative cumulative bp** | synteny, dotplot | `float bpRel = cumBp − base` | `bpRel * bpPerPxInv + panPx`, then `screenToClip` |
| **Screen space** | Hi-C, LD (both passes), variant matrix | CSS px, computed on the CPU | `screenToClip(px, resolution)` |

`hpmath.slang` hosts all three families' helpers plus generic ones
(`quadLocal`, `extendToMinWidthX`, the pixel-snap functions), so `import hpmath`
does not by itself mean a shader does hi/lo math.

## LGV family: what you actually write

Each LGV plugin defines the same one-line wrapper next to its uniform struct:

```slang
float bpToClipX(uint bp, Uniforms u) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero);
}
```

Call that (and `bpToLinear` where a normalized [0,1] is wanted). Alignments and
the canvas feature-glyph passes ship theirs in `alignmentsUniforms.slang` and
`featureGlyphUniforms.slang`; wiggle, MAF, GWAS, variants, multi-row and
`score-example` each carry a local copy. **Don't call `hpToClipX` /
`hpSplitUint` directly from a draw shader** — the wrapper takes a `uint`, so it
can't be handed an already-converted float. (A shader that only calls
`bpToClipX` doesn't need `import hpmath` at all; see
`plugins/alignments/src/LinearAlignmentsDisplay/CLAUDE.md`.)

The copies are deliberate. Hoisting the wrapper into `hpmath.slang` would need a
Slang interface every plugin's `Uniforms` had to conform to, leaking render-core
UBO shape into every plugin struct — and external plugin authors copy a
self-contained uniforms module out of the GPU-display guide. One duplicated line
is the cheaper trade.

The uniform side is `bpRangeX = [bpStartHi, bpStartLo, ±clippedLengthBp]`,
written by `blockClipUtils.clipBlock` (or `splitPositionWithFrac` for a single
UBO field). Length is negated for reversed blocks, which flips clip-x inside
`hpToClipX`; alignments instead calls `flipX(sx, u)` after the conversion.
Either way, reversal never touches the stored coordinate. The alignments UBO has
**no `regionStart`**, **no `domainStart`/`domainEnd`**.

## How the hi/lo split works

Rarely relevant — read this when debugging a precision artifact or writing a new
uniform module, not when writing a draw shader.

Storage is uint32 (exact to 4.29 Gbp); the precision-sensitive step is the
float32 conversion, so that is where the split happens. The uint32 is cut into a
**high** half (bits 12..31, an exact multiple of 4096) and a **low** half (bits
0..11, values 0..4095) — both exact in float32:

```slang
uint lo = value & 0xFFFu;
uint hi = value - lo;
float2 split = float2(float(hi), float(lo));
```

The viewport start is split the same way on the CPU. The shader then subtracts
hi-from-hi and lo-from-lo separately, so every subtraction is large-minus-large
or small-minus-small — no catastrophic cancellation:

```slang
float dHi = split.x - u.bpHi;  // large - large = small, exact
float dLo = split.y - u.bpLo;  // small - small = small, exact
float clipX = (dHi + dLo) / bpLen * 2.0 - 1.0;
```

That snippet is a simplification of the real `hpToClipX`, which wraps the
subtractions in `max(…, -inf)` + `dot()` and threads an `hpZero` term precisely
so the compiler can't algebraically collapse `dHi + dLo` back into one
large-magnitude subtraction and destroy the precision the split exists to
preserve. **Read `hpmath.slang`; don't retype this snippet.**

Why two representations rather than one: uint32-only would lose precision at the
float conversion (fine only below ~16 Mbp); float-hi/lo attributes would double
per-vertex position memory (8 vs 4 bytes) and push the split onto every CPU
packer. Uint32 storage + in-shader split gets 4 bytes, full precision, and
packers that copy absolute positions unchanged. See ADR-008 for the wiggle-side
equality decision.

## Synteny + dotplot: window-relative Float32 cumulative-bp

A synteny ribbon connects two views (dotplot: two axes) with independent
`bpPerPx`, so a corner is **cumulative bp across all regions of its view/axis**,
not single-region absolute bp — genome scale, up to Gbp, past Float32's mantissa
and past uint32 on large assemblies.

Instead of the hi/lo split, both store each corner **relative to a per-axis
fetch-time base** (`base = offsetPx * bpPerPx`, the viewport-start cumBp
captured when the geometry is built):

- The vertex attribute is a single Float32 `bpRel = cumBp − base`. The shader
  reconstructs screen X as `bpRel * bpPerPxInv + panPx`, where `panPx = (base −
  viewBp) / bpPerPx` is folded on the CPU in float64 from a SMALL delta — the
  pan since fetch (`GpuSyntenyRenderer` / `GpuDotplotRenderer`). The base
  cancels the genome-scale magnitude, so both terms stay sub-pixel in one
  Float32: no hi/lo pair, half the position bytes. Per-instance layout is the
  four corners (`bp{1..4}` / `x1,y1,x2,y2`) plus color etc.
  (`syntenyTypes.slang` / `dotplot.slang`).
- Synteny bakes the window-relative value into its geometry buffers, so the CPU
  pick path reads it directly (`buildSyntenyGeometry` returns `base0`/`base1`).
  Dotplot keeps **absolute** cumBp `Float64Array`s in geometry — the Canvas2D
  and SVG renderers consume them unchanged — and subtracts the base only at GPU
  upload; `buildLineSegments` carries `baseH`/`baseV` for the GPU path.
- That is the *only* place the two diverge. Each plugin's
  `DisplayName/instanceInterleave.ts` owns its pack loop (hand-written, not the
  generated `packInstances`, because both apply a per-element transform a flat
  ArrayLike packer can't express: synteny's `featureId = instanceFeatureIdx + 1`,
  dotplot's `cumBp − base`), and each exports the same
  `interleaveInstances` / `patchInstanceColors` pair — see [the recolor fast
  path](../ARCHITECTURE.md#gpuprops-and-derived-region-maps--re-upload-without-refetch).
  Offsets and stride always come from the shader's generated interface, so only
  the loop is local.

This works because the fetch is scoped per window and re-runs when the window
moves (synteny: both views refetch on pan; dotplot: the h-axis refetches, and a
zoom on either axis rebuilds geometry), so the base stays near the view.
Far-off-screen corners — a distant-mate ribbon on another chromosome — lose
absolute precision, but only on the clipped-away sliver; visible error stays
~`panDistancePx · 2⁻²³`. Storing cumBp instead of regional bp + region index
avoids the per-region uniform table and per-region-pair draw calls that ruled
out earlier hp-math attempts, and imposes no `MAX_REGIONS` cap. **ADR-067** is
the decision; ADR-010 holds the rejected per-region-table alternatives and
ADR-018 the earlier hi/lo shape this replaced.

**Dotplot's v axis is the exception.** Its fetch is h-axis-scoped and the
geometry autorun reads `offsetPx` untracked, so a v-axis pan neither refetches
nor rebuilds — only a zoom recaptures `baseV`, and `panPxV` grows unbounded
until then. The error bound above still holds (~8.4M px of vertical pan to reach
1 px), so it is recorded, not fixed.

The two plugins differ on *where* the subtraction happens because of where they
build geometry: dotplot builds on the main thread, so it has a seam between the
data and the vertex buffer; synteny builds in the worker, where the geometry
object **is** the RPC payload and no seam exists. ADR-067 has the reasoning.

### Should synteny adopt dotplot's shape? Asked, declined on bytes

Synteny is the one that puts relative coordinates into the data model and across
the RPC boundary, which brushes against the repo `CLAUDE.md` rule that worker
output is absolute genomic uint32. It does not straightforwardly violate it —
synteny's base is a **viewport** base rather than a regionStart, it is refetched
when the window moves, and `base0`/`base1` travel with the data so no consumer
has to guess it — but the inconsistency is real and the question has been asked.

The departure is bounded: the rule holds in full for the *feature* payload
(`starts`/`ends`/`mateStarts`/`mateEnds` are absolute chromosome-local uint32),
and a corner is cumBp anyway, so even an "absolute" version would be Float64
cumBp rather than the uint32 family the rule describes.

It was declined, so it can be argued with rather than re-derived:

- Corners are synteny's largest per-instance array, and absolute means Float64:
  **16 bytes/instance of corners becomes 32**. The plugin sizes its target at
  500k instances on whole-genome PAF (`instanceInterleave.ts`,
  `syntenyPickEngine.ts`), so roughly **+8 MB per region**, across the RPC and
  then resident in `SyntenyGeometryCache`, per level.
- "Half the position bytes" is a stated goal of the refactor that introduced the
  scheme. Undoing it buys consistency and spends a measured win.
- It is not a buffer-format change. The CPU pick path (`syntenyPickEngine.ts` /
  `projectCorners`) reads the relative values today, so it moves too.

The residual cost is that `base0`/`base1` are a correctness dependency riding
with the data, which dotplot's shape avoids. It is smaller than it sounds:
`computeTransform` is the single implementation of `panPx`/`bpPerPxInv`, and the
GPU renderer imports it rather than re-spelling it. The one hand-written twin is
`bpRel * inv + panPx` — `projectCorners` (TS) against `computeCorners` (Slang) —
which ADR-051's scalar-only codegen makes unavoidable, and which no test
compares. `getCigarOpAtInstance` is the only reader relying on the base
*cancelling* rather than being applied.

**What would change the verdict:** a decision that one coordinate story across
the fleet is worth the bytes regardless (a legitimate call, and not the
implementer's); evidence the 500k-instance case is not the one to optimize for;
or a third consumer arriving that needs absolute cumBp on the main thread, at
which point synteny is paying the conversion anyway.

**Do not** split the difference by leaving the worker relative and converting on
arrival — that is the current cost plus a copy.

### `FeatPos` is absolute, and is *not* what the ribbon is drawn from

The band's main-thread feature data obeys the absolute-uint32 rule:
`starts`/`ends`/`mateStarts`/`mateEnds` in `SyntenyFeatureData` are absolute
chromosome-local bp, and `getFeatureAtIndex` hands them out as `FeatPos`. Nothing
relative is in there. That is the good news and also the trap.

Those numbers are the **original block extent**, written before the geometry
stage. The ribbon on screen is not: `clipLargeBlockToWindow` re-anchors a
chain-sized block to just its visible slice, CIGAR-accurately, and
`clampBlockToRegions` trims it again to what both axes can show
(`executeSyntenyFeaturesAndPositions.ts`). Only the geometry sees the result;
`startsArray[validCount] = start` stores the pre-clip value on purpose, because
the detail panel and the min-length cull want the whole block.

So main-thread code that reads `FeatPos` coordinates and reasons about *what the
user is looking at* is wrong wherever the block was clipped — which is precisely
the liftOver-style chain, the case such code is usually written for. In
particular, interpolating a mate position across `start..end` is not "the
geometry the picture is drawn with", however reasonable that sounds: the picture
followed the CIGAR and the interpolation did not. This has been shipped once and
reverted (`8981347686`).

The correct route for anything needing a position correspondence is a worker
round trip that walks the real CIGAR and returns absolute bp —
`SyntenyResolveMatchingRegion`, which is what the band's "Move … panel to the
matching region" items use, gated on `featureData.hasCigar` so a CIGAR-less tier
gets no answer rather than a guessed one.

### The same hazard on the CSS side: `staticBlocksTranslateX`

Everything above is about the worker and the GPU. The DOM has the identical
problem and it is easy to miss, because nothing in CSS reports a range error.

`view.offsetPx` is a **whole-genome** pixel coordinate: hg38 chr1 at base
resolution is already past 1e10, and a whole-genome view of a large assembly
sits above that again. A number that size does not survive the trip through CSS.
The transform matrix is float32 by the time it reaches the compositor — at 1e10
consecutive representable values are ~1024px apart — and layout saturates
sooner, since Blink's `LayoutUnit` is an int32 at 1/64px, i.e. ±33.5M px.

So the chrome that overlays the row — gridlines, coordinate labels, region seams
— is **not** laid out in absolute genome pixels. It is laid out in the
*staticBlocks frame*, which spans only the displayed regions currently on
screen plus an overhang of a block or two, and the whole frame is shifted into
the viewport by one transform. That shift is
`LinearGenomeView.staticBlocksTranslateX`, and the reason it is a getter rather
than an expression at each call site is this section: the subtraction is
large-minus-large in float64 and only its small difference reaches CSS. Writing
`translateX(-view.offsetPx)` over an absolutely-placed overlay is the shape that
looks obvious, and it does not lose a subpixel — it puts the row somewhere else
entirely, on large assemblies at high zoom, which is not where anyone tests.

`paddingSpans`, `gridlineTicks` and `scalebarLabels` all publish `x` in that
frame for the same reason. `scalebarRefNameLabels` is the deliberate exception:
its `transform` is a screen x (already net of `offsetPx`, and therefore also
small), because a sticky label's position is a function of the scroll rather
than of block geometry.

This is a published surface, not an internal one — `products/jbrowse-build-your-own`
teaches hosts to draw exactly these overlays.

### Hi-C is not a precision problem

`diagonalGrid.slang` says its grid units are "genomic bp for Hi-C", which reads
like the Gbp-scale Float32 hazard synteny and dotplot both had to solve. It is
not. Positions are built as `u = (contactBin + off) * w` with
`w = res / (bpPerPx * √2)` (`executeRenderHicData.ts`), so they are
viewport-pixel-scale. Float32 is fine and no base/pan scheme is wanted.

## Genome-size limits

- **A single reference sequence must be `< 2³²` = 4.29 Gbp.** The one hard
  assumption. Every LGV-family `uint32` position attribute and every
  `starts`/`ends`/`mateStarts`/`mateEnds` array in the synteny RPC
  (`executeSyntenyFeaturesAndPositions.ts`) stores *chromosome-local*
  coordinates and relies on it. Real chromosomes clear it comfortably (human
  chr1 ≈ 250 Mbp, hexaploid wheat chr3B ≈ 830 Mbp); only a single reference past
  4.29 Gbp (certain lungfish/amphibian chromosomes) would wrap — out of scope.

- **Whole-assembly cumulative bp has no GPU ceiling.** The sum across all
  chromosomes — what a synteny ribbon corner or dotplot segment spans — is
  Float64 on the CPU (exact to 2⁵³) and window-relative Float32 on the GPU, so
  on-screen precision is ~`panDistancePx · 2⁻²³`: sub-pixel for realistic
  navigation at any assembly size (16 Gbp hexaploid wheat, 160 Gbp
  *Tmesipteris oblanceolata*), because a zoom recaptures the base near the view.
  `Region.start`/`end` are Float64 throughout, with no bitwise coordinate ops.

- **Soft, non-bp ceiling:** the synteny per-instance `featureId`
  (`instanceInterleave.ts`) is a Float32, exact only to 2²⁴ ≈ 16.7M *rendered
  instances* — a density limit on a single whole-genome PAF, not a coordinate
  limit. Overview-zoom culling keeps counts well below it.

The window-relative scheme retired a former ~68.7 Gbp ceiling; see
[HISTORICAL.md](HISTORICAL.md).
