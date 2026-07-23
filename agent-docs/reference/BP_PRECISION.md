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
  **window-relative** as a single Float32 against a per-axis fetch-time base.
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
`plugins/alignments/src/LinearAlignmentsDisplay/shaders/CLAUDE.md`.)

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

This works because the fetch is scoped per window and re-runs when the window
moves (synteny: both views refetch on pan; dotplot: the h-axis refetches, and a
zoom on either axis rebuilds geometry), so the base stays near the view.
Far-off-screen corners — a distant-mate ribbon on another chromosome — lose
absolute precision, but only on the clipped-away sliver; visible error stays
~`panDistancePx · 2⁻²³`. Storing cumBp instead of regional bp + region index
avoids the per-region uniform table and per-region-pair draw calls that ruled
out earlier hp-math attempts, and imposes no `MAX_REGIONS` cap. See ADR-010 for
the rejected per-region-table alternatives and ADR-018 for the earlier hi/lo
shape this replaced.

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
