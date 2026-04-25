# ADR-010: Synteny and dotplot keep pre-projected pixel offsets

## Status

Accepted

## Context

LGV plugins (wiggle, alignments) emit absolute uint32 genomic positions
from the worker and project to screen pixels at draw time, with one
draw call per visible block carrying that block's `bpRange` uniform.
This works because each LGV display is 1D — every primitive lives on
one coordinate axis, and the per-block draw IS the per-region
projection.

We attempted the same pattern for synteny and dotplot:

- Worker emits `(bp_in_region, regionIdx)` per corner.
- Main thread builds a per-view `regionOffsetPx[]` projection table.
- Shader reads bp + regionIdx attrs, looks up the offset, projects via
  `hpmath` (`hpSplitUint` + `hpScaleLinear`).

Motivation was to eliminate the Float32 precision drift that occurs at
deep zoom past ~2× the worker's fetch-time `bpPerPx` on T2T-scale
data, and to align with the LGV plugins' "bp at the data layer"
convention.

The implementation hit problems unique to synteny/dotplot's shape:

- **Each primitive spans two independent coordinate axes.** A synteny
  ribbon connects (top_bp, top_region) on the top view to (bot_bp,
  bot_region) on the bottom view — the two axes have independent
  `bpPerPx` and independent region offsets. A dotplot line goes
  (x_bp, x_region) → (y_bp, y_region). The LGV pattern's per-block
  draw doesn't naturally apply: we'd need per-(top_region, bot_region)
  pair draw calls, scaling as O(N×M) with region counts. Fragmented
  contig assemblies in the wild reach 1000×1000 region pairs.
- **The shader-side region table alternative is ugly.** The codegen
  (`scripts/shader-codegen/codegen.ts`) only knows `scalar` and
  `vector` field kinds, no arrays. To get a table indexed by
  `regionIdx`, we declared 32 individual scalar uniforms
  (`regionOffsetA0..15`, `regionOffsetB0..15`) and a switch-statement
  lookup. Hard `MAX_REGIONS = 16` cap (doesn't fit hg38 + alts at
  ~50). Either fix the codegen for arrays (still capped, just
  generously) or use a 1D-texture indirection (parallel data path,
  texture binding overhead, WebGPU `texture_1d` is patchy support).
- **The "zoom doesn't refetch" benefit was partial.**
  `chainMergeLodBucket` (synteny) and `MIN_CIGAR_PX_WIDTH` gating
  (dotplot) still depend on view `bpPerPx`, so geometry refetches
  still occur. We didn't escape the refetch dependency we set out to
  remove.
- **The precision win was narrow.** Float32 drift only manifests when
  zooming 2-32× without crossing a refetch threshold. The existing
  autorun-based refetch already fires on `bpPerPx` change, debounced.
  Not a problem the user actually saw at deep zoom on T2T-scale data.
- **We dropped working features.** CIGAR segment merging,
  `ensureMinExtent` (dotplot), straddler rendering — all small but
  real regressions.

The bp+regionIdx refactor was landed across several commits, then
reverted. ~250 LOC net growth from the refactor disappeared with the
revert.

## Decision

Synteny and dotplot stay on **pre-projected pixel offsets** at the
worker boundary:

- Worker emits Float32/Float64 pixel offsets computed at
  fetch-time `bpPerPx`.
- Shader is a linear `sx = x * scale - offsetX` transform; zoom
  changes update `scale`/`offsetX` uniforms only.
- Zoom changes that drift past 2× the geometry `bpPerPx` trigger a
  refetch via the existing autorun. The autorun's debounce coalesces
  smooth zoom into one refetch after the gesture settles.

This is the original, pre-refactor shape. We accept the Float32
deep-zoom drift case (narrow window between refetches) as a known
limitation, not worth the architectural overhead to eliminate.

Phase 1 of the refactor is kept (it's useful standalone):

- `chainMergeLodBucket` getter — value-memoized so non-bucket-crossing
  zoom doesn't refetch
- Fetch source switched from `staticBlocks.contentBlocks` to
  `displayedRegions` (zoom-invariant)
- Dropped redundant `regions` RPC arg
- `SyntenyViewDuck` replaced with type-only import

The dead `syntenyProjection.ts` helper added in Phase 1 (only used by
its own test) was deleted.

## Rejected alternatives

**Per-(region-pair) draw calls (true LGV pattern).** One draw per
`(topRegionIdx, botRegionIdx)` synteny pair or `(xRegionIdx,
yRegionIdx)` dotplot pair, each with simple `bpRange` uniforms — same
shape as wiggle. Clean shader, no MAX_REGIONS, no codegen changes.
Rejected because it scales O(N×M); fragmented contig assemblies hit
1000×1000 pairs which dominates draw-call submission.

**Per-region uniform table with codegen array support.** Fix
`scripts/shader-codegen/codegen.ts` to emit `array<f32, 64>` from
slang declarations. Cleaner shader (`u.regionOffsetA[idx]`), no
unrolled scalars, generous cap. Rejected because the codegen change
is invasive (slang reflection, WGSL/GLSL emitters, byte-offset
calculator, TS interface emitter all need an `array` kind). Could
revisit if uniform arrays become useful elsewhere — see "Revisit if".

**Per-region uniform table via 1D texture.** Region offsets stored in
a small 1D texture, shader does `texelFetch` per vertex. No cap.
Rejected because it adds a parallel data path (texture binding,
upload, sampler) for what is fundamentally a uniform write; WebGPU
`texture_1d` support is patchy (most uses fall back to `texture_2d`
with height=1, itself a workaround). Cost outweighs benefit when the
uniform-write path already works.

**Worker-side integer-bp CIGAR walk + Float32 pixel output.** Keep
the entire shader/uniform shape unchanged, but do the worker-side
CIGAR accumulator in integer bp (avoiding Float64→Float32 conversion
loss in dotplot specifically), converting to pixel offsets only at
instance-buffer build time. Gets ~80% of the precision win for ~5%
of the complexity. Not implemented yet — see "Revisit if".

## Consequences

- Synteny ribbons and dotplot lines drift slightly when zoomed
  >2× past the geometry `bpPerPx` until the autorun refetch fires
  (debounced, ~300 ms after gesture). On T2T-scale data this is
  visible at extreme zoom; for typical genomes it isn't.
- The shader stays trivially readable: `sx = x * scale - offsetX`.
- No `MAX_REGIONS` cap. No region-count surprises in fragmented
  assembly views.
- Pan/zoom updates are uniform writes; geometry buffer is reuploaded
  only when the worker refetches.
- The `wiggle/alignments` and `synteny/dotplot` plugins look
  superficially inconsistent (uint genomic vs. Float pixels at the
  worker boundary). The architectural reason — 1D vs. 2D-with-
  independent-axes — is documented in this ADR.

## Revisit if

- A user reports visible drift in normal interactive use of synteny
  or dotplot on T2T-scale data → implement the worker-side
  integer-bp CIGAR walk fix (the "alternative #4" above). This
  is contained to `buildSyntenyGeometry.ts` and
  `drawDotplotWebGL.ts`, no shader/uniform changes.
- The codegen gains uniform-array support for unrelated reasons →
  revisit the per-region uniform table approach for synteny only
  (dotplot's 1000×1000 case still rules it out). Bumping
  `MAX_REGIONS` to 64+ would make synteny tractable.
- Draw-call submission stops being the bottleneck for very
  high-region-count views (e.g. via WebGPU bundles or instanced
  draws across pairs) → revisit the per-(region-pair) draw call
  approach. As of 2026 this is not a realistic option.
