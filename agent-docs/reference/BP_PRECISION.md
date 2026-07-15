---
name: bp-precision
description: The absolute-uint32 coordinate convention, hi/lo float32 math, and genome-size limits. Read when writing a Slang shader or a CPU instance packer.
---

# BP precision & coordinate conventions

Genomic positions exceed 3×10⁹ on T2T assemblies. Float32's 24-bit mantissa
can't represent every integer past 2²⁴ ≈ 16.7 Mbp, so a naive float upload loses
~256 bp of precision at 3 Gbp. GPU clip-space is unavoidably float32 — this doc
is how we keep positions exact anyway. Read it when writing a `.slang` shader or
a CPU instance packer.

## The absolute-uint32 rule

**Every position array that crosses the worker boundary is absolute genomic
uint32** — no pixel coordinates, no `regionStart`-relative offsets. That covers
reads, gaps, mismatches, interbase (ins/soft/hardclip), softclip bases,
modifications, SNP/noncov/indicator/modCov segments, sashimi junctions, chain
connecting lines, `coverageStartPos`, `readNextPositions`, and wiggle
`featurePositions`.

Why absolute rather than regionStart-relative:

- **Region boundaries change on zoom-out.** Anything keyed to `regionStart` is
  silently invalidated when the anchor shifts.
- **No signed offsets needed** — genomic positions are always ≥ 0.
- **Reversal is orthogonal.** The drawing layer handles reversed regions
  (`bpToX` on Canvas2D, `flipX` on GPU), not the coordinate convention.
- **Every consumer compares against absolute bp** — SVG export, Canvas2D, hit
  testing, tooltips, `findFeatureInRpcData`, main-thread layout. No `regionStart
  +` arithmetic anywhere.

Uint32 is exact for `[0, 2³²)` = 4.29 Gbp, so absolute storage costs 4 bytes per
vertex and stays valid under any zoom.

## The 0-based half-open convention

JBrowse uses **0-based half-open intervals** `[start, end)` internally for all
genomic features and regions, matching BED/BAM. Adapters that read 1-based
formats (VCF `POS`, GFF `start`) subtract 1 on ingest; exporters that write
1-based formats add 1 on output.

## Two-stage representation: uint32 storage, hi/lo split in shader

Storage is uint32 (exact to 4.29 Gbp). The precision-sensitive step —
converting to float32 clip-space — happens in the shader via a hi/lo split.

The uint32 is split into a **high** half (bits 12..31, aligned to 4096-bp
boundaries) and a **low** half (bits 0..11, values 0..4095):

```wgsl
uint lo = value & 0xFFFu;
uint hi = value - lo;
float2 split = float2(float(hi), float(lo));
```

Both halves are exact in float32 — `hi` is always an exact multiple of 4096,
`lo` is always in `[0, 4096)`.

`clippedBpStart` is split the same way on the CPU (`splitPositionWithFrac`) and
uploaded as `bpHi`/`bpLo`. The shader subtracts hi-from-hi and lo-from-lo
separately, so every subtraction is large-minus-large or small-minus-small — no
catastrophic cancellation:

```wgsl
float dHi = split.x - u.bpHi;  // exact: large - large = small
float dLo = split.y - u.bpLo;  // exact: small - small = small
float clipX = (dHi + dLo) / bpLen * 2.0 - 1.0;
```

That snippet is a **simplification**. The real `hpToClipX` keeps the
subtraction in a `max(…, -inf)` + `dot()` structure and threads an `hpZero`
term, precisely so the compiler can't algebraically collapse `dHi + dLo` back
into one large-magnitude subtraction and destroy the precision the split exists
to preserve. **Read `hpmath.slang`; don't retype this snippet.**

Helpers: `hpmath.slang` provides `hpSplitUint`, `hpToClipX`, `hpScaleLinear`.
`blockClipUtils.clipBlock` emits `[bpStartHi, bpStartLo]` for the visible
window; `splitPositionWithFrac` is the CPU equivalent for UBO fields.

Why both representations: uint32-only would lose precision at the float
conversion (works only below ~16 Mbp); float-hi/lo-only would double per-vertex
memory (8 vs 4 bytes) and push the split onto every CPU packer. Uint32 storage +
in-shader split gets 4 bytes, full precision, and packers that copy absolute
positions unchanged. See ADR-008 for the wiggle-side equality decision.

## How the shaders consume it (alignments/wiggle)

Every shader consumes absolute uint32 and converts via hp-math:

| Shader group | Attribute | Technique |
|---|---|---|
| Point/edge shaders (read, gap, mismatch, insertion, modification, clip, connectingLine, arcLine, coverage, snpCoverage, noncovHistogram, indicator, modCoverage) | `uint position` | `hpToClipX(hpSplitUint(absPos), u)` — hi/lo split against `bpHi`/`bpLo`. Exact at 3 Gbp. |
| arc (paired-end bezier curves) | `uint x1, x2` | `hpScaleLinear(hpSplitUint(absPos), u)` → normalized [0,1]; bezier runs on small floats. Same precision floor. |

The alignments UBO has **no `regionStart`**, **no `domainStart`/`domainEnd`**.

**Reversed regions:** both shader families call `flipX(sx, u)` after computing
clip-space x. `flipX(x) = lerp(x, -x, u.reversed)` maps left-edge = `region.end`,
right-edge = `region.start`.

## Synteny + dotplot: window-relative Float32 cumulative-bp

Synteny and dotplot corner storage takes a different shape than the LGV-family
uint32 attributes above. A synteny ribbon connects two views (dotplot: two axes)
with independent `bpPerPx`; per-corner positions are **cumulative-bp across all
regions of the corner's view/axis**, not single-region absolute bp — genome
scale, up to Gbp, past Float32's 24-bit mantissa.

Rather than the hi/lo split the LGV path uses, both store each corner
**relative to a per-axis fetch-time base** (`base = offsetPx * bpPerPx`, the
viewport-start cumBp captured when the geometry is built):

- The vertex attribute is a single Float32 `bpRel = cumBp − base`. The shader
  reconstructs screen X as `bpRel * bpPerPxInv + panPx`, where `panPx = (base −
  viewBp) / bpPerPx` is folded on the CPU in float64 from a SMALL delta (the pan
  since fetch — see `GpuSyntenyRenderer` / `GpuDotplotRenderer`). Because the
  base cancels the genome-scale magnitude, both `bpRel*inv` (small for on-screen
  corners) and `panPx` (small for realistic pans) stay sub-pixel in a single
  Float32 — no hi/lo pair, half the position bytes. The per-instance layout is
  the four corners (`bp{1..4}` / `x1,y1,x2,y2`) plus `color` etc.
  (`syntenyTypes.slang` / `dotplot.slang`).
- Synteny bakes the window-relative value into its geometry buffers, so the CPU
  pick path reads it directly (`buildSyntenyGeometry` returns `base0`/`base1`).
  Dotplot keeps **absolute** cumBp `Float64Array`s in geometry — the Canvas2D /
  SVG renderers consume them unchanged — and subtracts the base only at GPU
  upload; `buildLineSegments` carries `baseH`/`baseV` alongside for the GPU path.

This is viable because the fetch is scoped per window and re-runs when the
window moves (synteny: both views refetch on pan; dotplot: the h-axis refetches,
and a zoom on either axis rebuilds geometry), so the base stays near the view.
Far-off-screen corners — a distant-mate ribbon/segment on another chromosome —
lose absolute precision but only on the clipped-away sliver; visible error stays
~`panDistancePx · 2⁻²³`. Storing cumBp instead of regional bp + region index
avoids the per-region uniform table / per-(region-pair) draw-call concerns that
ruled out earlier hp-math attempts; no `MAX_REGIONS` cap. See ADR-010 for the
rejected per-region-table alternatives and ADR-018 for the earlier hi/lo shape
this replaced.

## Genome-size limits (what must fit where)

Two distinct thresholds — one hard, one not a real limit:

- **A single reference sequence (one chromosome/contig) must be `< 2³²` =
  4.29 Gbp.** This is the one hard assumption. Every `uint32` position attribute
  (LGV-family, split in-shader via `hpSplitUint`) and every per-feature
  `starts`/`ends`/`mateStarts`/`mateEnds` array in the synteny RPC
  (`executeSyntenyFeaturesAndPositions.ts`) stores *chromosome-local*
  coordinates and assumes this. We accept it: real chromosomes clear it
  comfortably (human chr1 ≈ 250 Mbp, hexaploid wheat's chr3B ≈ 830 Mbp). It
  would only wrap for a single reference exceeding 4.29 Gbp (certain
  lungfish/amphibian chromosomes) — out of scope.

- **Whole-assembly cumulative-bp is NOT bounded by uint32 and has no fixed GPU
  size ceiling.** The sum across all chromosomes — what a synteny ribbon corner
  or dotplot segment spans — is Float64 on the CPU (exact to 2⁵³). On the GPU it
  is stored **window-relative** as a single Float32, so on-screen precision is
  ~`panDistancePx · 2⁻²³` — sub-pixel for all realistic navigation regardless of
  assembly size (16 Gbp hexaploid wheat, or 100+ Gbp genomes like *Tmesipteris
  oblanceolata* ≈ 160 Gbp all render correctly), because a zoom recaptures the
  base near the view. `Region.start`/`end` are Float64 throughout with no bitwise
  coordinate ops.

- **Soft, non-bp ceiling:** the synteny per-instance `featureId`
  (`instanceInterleave.ts`) is a Float32, exact only to 2²⁴ ≈ 16.7M *rendered
  instances* — a density limit on a single whole-genome PAF, not a coordinate
  limit. Overview-zoom culling keeps counts well below it.

The window-relative scheme retired a former ~68.7 Gbp ceiling; see
[HISTORICAL.md](HISTORICAL.md).
