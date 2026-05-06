# ADR-018: Synteny corner storage moves to cumulative-bp hi/lo Float32

## Status

Accepted (supersedes ADR-010 for the synteny path; dotplot still on
pre-projected pixel offsets per ADR-010).

## Context

ADR-010 documented why synteny and dotplot kept pre-projected Float32 pixel
offsets at the worker boundary: the per-(region-pair) draw-call alternative
scales O(N×M) (1000×1000 fragmented assemblies), the per-region uniform-table
alternative needs codegen array support and runs into a `MAX_REGIONS` cap,
and the precision drift it would have fixed only manifests at deep zoom
between refetches — a narrow window the user usually doesn't see.

ADR-010 left a "revisit if" hook for the worker-side integer-bp CIGAR walk
fix (alternative #4). What ended up landing is a different shape, broad
enough to deserve its own record.

The cross-chromosome off-screen-mate scenario surfaced a stronger version
of the precision problem: a synteny ribbon's top corner ~10 kbp into chr1,
its mate at ~800 Mbp cumulative on a distant chromosome. The mate corner
stored as a Float32 pixel position around 8e8 px has ~64 px ULP, and the
shader's `* scale` zoom compensation amplifies that quantization error
across the full canvas span. Refetching on zoom doesn't help — the ULP
floor is in the storage format itself.

## Decision

Synteny corner positions are stored on the GPU as **cumulative-bp hi/lo
Float32 pairs**, not pixel offsets:

```
worker-side per corner:
  cumBp = (offsetPx - paddingPx) * bpPerPx           // exact in Float64
  hi    = cumBp - (cumBp mod 4096)                   // 4096-multiple
  lo    = (cumBp mod 4096) + frac(cumBp)             // sub-4096 + fraction
```

Both halves fit in Float32 losslessly: `hi` is always an exact multiple of
4096 (≪ 2²⁴ even at 10s of Gbp); `lo` is in `[0, 4096)`.

The view origin is a single per-view uniform (no per-region table):

```
viewBp = offsetPx * bpPerPx       // padded-bp at canvas left
```

split into hi/lo the same way and uploaded as `viewBp{0,1}{Hi,Lo}`.

Per-instance padding survives **as a Float32 pixel offset** (`padTop`,
`padBottom`) — the inter-region gap accumulated up to the corner's region.

The shader reconstructs LGV-aligned screen-X with one helper per corner:

```
screenX = (cumBp - viewBp) * bpPerPxInv + pad
       = ((cumBp - viewBp_hi) + (cumBp_lo_diff)) * bpPerPxInv + pad
```

The `max(diff, -inf)` barrier (lifted from `hpmath.slang`) prevents the
shader compiler from collapsing the hi/lo terms before the multiply, which
is what preserves the extra mantissa bits.

## Why padding stays in pixel space

Padding is the **inter-region gap accumulated up to the corner's region**,
in CSS pixels. Encoding it as bp would force conversion at every shader
invocation; encoding it as a per-instance pixel attribute means the shader
adds a Float32 already in the right space. The padding origin uniform that
would otherwise be needed (`viewPad`) collapses out of the math because
`viewBp = offsetPx * bpPerPx` is the **padded-bp** at canvas-left, so the
per-instance `pad` term subtracts the right amount on its own.

Math derivation (in `syntenyTypes.slang` comment on `hpCornerScreenX`):

```
With viewBp = offsetPx * bpPerPx,
  (cumBp − viewBp)/bpPerPx + pad
    = cumBp/bpPerPx − offsetPx + pad
    = featurePx_padded − offsetPx
```

— exactly the LGV's render position, with no `viewPad` companion uniform.

## Why no per-region table is needed

The two ADR-010 concerns about per-region addressing don't apply here:

1. **`MAX_REGIONS` cap**: no per-region uniform table exists. Every corner
   carries its own `cumBp` (genomic) and `pad` (inter-region pixels) — both
   per-instance attributes, no region-index lookup.
2. **O(N×M) per-(region-pair) draw calls**: synteny still draws one pass
   per track (covering all instance buffers). The per-region projection is
   baked into each instance at fetch time.

## What did not change

- **CIGAR walker** (`visitCigarRenderedSegments`) still operates in pixel
  space. The `< 1 px` indel-merge threshold is fundamentally a pixel
  decision; converting it to `bpDelta * bpPerPxInv < 1` gives identical
  semantics but the visitor is shared with SVG export and the conversion
  isn't worth the cross-cutting touch. The worker-side CIGAR loop still
  emits pixel positions; `pxArrayToBpHiLo` converts them to cumBp at the
  end via `(px − pad) × bpPerPx` (exact in Float64). See TODO.md for the
  bp-space rewrite that would eliminate the roundtrip.
- **Fetch-time off-screen culling** still runs in pixel space at viewport-
  width margin; segments outside that window are not emitted.
- **Per-feature `padTop` / `padBottom`** is the same pixel-padding value
  for all corners on the same view, computed once via `bpToPxFromIndex`
  and reused for the top edge (corners 1, 2) and bottom edge (corners 3,
  4). Synteny matches don't span regions; CIGAR sub-segments inherit the
  parent feature's padding.
- **Dotplot stays on pre-projected pixel offsets** per ADR-010. The same
  hi/lo cumBp approach would apply, but dotplot's geometry buffer shape is
  different (line endpoints, not parallelogram corners); migration would
  be a separate ADR.

## Consequences

- Cross-chromosome ribbons render exactly at any zoom — the 64 px ULP
  jitter at 8e8-px positions is gone. Re-fetched geometry at a different
  `bpPerPx` produces identical hi/lo pairs.
- Synteny no longer drifts past the ADR-010 "~2× geometry bpPerPx"
  threshold between refetches. The autorun-debounced refetch is still
  there for zoom-dependent content (chain merging, CIGAR detail), but
  precision no longer gates correctness.
- Removed two uniforms (`viewPad0`, `viewPad1`) and the worker helper
  `viewBpAndPadAtOrigin` that used to compute the cum-bp and padding at
  the canvas-left edge by walking the region table.
- Six Float64Arrays (`p11..p22_offsetPx`, `padTop`, `padBottom`) no longer
  cross the worker→main-thread RPC boundary — they were intermediates
  read only inside the worker, never by the main thread.

## Rejected alternatives

(Carried over from ADR-010, plus one new one.)

**Per-(region-pair) draw calls.** Still rejected: O(N×M) at scale.

**Per-region uniform table (codegen array support).** Still rejected: same
codegen invasiveness as ADR-010 documented; sidestepped entirely by
encoding padding per-instance.

**Per-region uniform table via 1D texture.** Still rejected: parallel data
path for what reduces to a per-instance scalar.

**Worker-side integer-bp CIGAR walk + Float32 pixel output** (ADR-010
alternative #4). Subsumed by this decision: we changed the storage format
itself (cumBp hi/lo, not pixels) rather than just fixing the CIGAR
accumulator's precision floor.

**Storing cumBp as a single Float32**. Tried implicitly by storing pixel
offsets at `bpPerPx`=1 — same precision floor (Float32 ULP at 8e8 is ~64
units regardless of whether the unit is "bp" or "px"). The hi/lo split is
the actual fix.

## Revisit if

- The CIGAR visitor gets touched for unrelated reasons → take the bp-space
  rewrite at the same time (TODO.md entry; eliminates the
  `pxArrayToBpHiLo` roundtrip).
- Dotplot precision becomes a user-visible problem → migrate dotplot to
  the same hi/lo cumBp shape; geometry buffer layout differs but the
  shader-side hp-math helper is reusable.
