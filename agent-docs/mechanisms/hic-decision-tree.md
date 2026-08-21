---
name: hic-decision-tree
description: What a contact-matrix track decides — what a fetch asks for when the answer is a resolution rather than a refusal, how a bin becomes a cell in a rotated triangle and a cursor becomes a bin again, and what colour a count takes — as three rendered decision graphs, with the failures behind the odd-looking branches kept to a tail. Read before touching the binsize ladder, the normalization names, the packed instance layout or the colour saturation point.
audience: internal
---

# The contact-matrix decision tree

Hi-C is the display that does not have a too-large gate. Every other track type
answers "this region is more data than the budget" with a banner; a `.hic` file
carries the same region at half a dozen binsizes, so this one answers by asking
for a coarser one. That single difference reshapes the rest: the resolution is
zoom-derived rather than a setting, the payload is a screen-space geometry
rather than a feature list, and the display has to say which of three
normalization names it means at any moment.

Three questions:

- **the request** — which binsize, and which matrix balancing.
- **the geometry** — where a contact lands, and how a cursor gets back to it.
- **the colour** — what a raw count saturates against.

The GPU lifecycle these sit inside is
[reference/GPU_RENDERING.md](../reference/GPU_RENDERING.md); the triangle's
coordinate transform is shared with the LD heatmap and lives in
`plugins/linear-genome-view/src/BaseLinearDisplay/models/renderTransform.ts`.

## The request

![How a Hi-C fetch picks a binsize and a normalization](diagrams/hic-request.svg)

- The binsize list and the normalization list come from one `CoreGetInfo` read
  at attach. Every contact fetch is gated on it, so a failure there is terminal
  rather than a degradation — and so is an **empty** binsize list, for the same
  reason: a resting state that never fetches and never errors leaves `svgReady`
  unsettled and hangs the whole view's export.
- Auto-pick is the largest binsize at or under `2 * bpPerPx`, which floors a bin
  at about half a screen pixel. `resolutionBias` is stored as an **offset from
  that pick**, not as an absolute binsize, so a locked choice keeps tracking
  zoom instead of pinning the file's finest matrix at whole-genome scale.
- `effectiveResolution` is an explicit per-call argument, never part of
  `rpcProps()`: it is a function of the viewport, and a viewport change already
  refetches.
- Normalization is three names, not one. `selectedNormalization` is what the
  user persisted, `activeNormalization` resolves it against what the file
  offers, and `appliedNormalization` is what the matrix actually came back
  carrying. Vectors are stored per (type, chromosome, unit, binsize), so a file
  offering KR at 5 kb can have nothing at 2.5 Mb — the track menu ticks the
  applied one, so the radios describe the data on screen.
- The resolution step is a `.hic`-shaped answer to a question every format has.
  Where the file offers no tier, the display's answer is the ordinary banner —
  see [region-too-large](../reference/REGION_TOO_LARGE.md).

## The geometry

![How a contact becomes a packed cell, and a cursor becomes a contact](diagrams/hic-pack.svg)

- A multi-region view fetches every pair `(i, j)` with `i <= j`, six at a time.
  The bound is not a throughput guess: it is what the block cache is sized
  against, and reading every pair at once evicts a fetch's own earlier blocks
  before it finishes.
- A pair the file has no matrix for at this binsize contributes nothing rather
  than failing the fetch. Inter-chromosomal pairs commonly carry only coarse
  binsizes, so on a whole-genome view this is the ordinary case.
- Every layout term — the region's combined offset, its span, its orientation —
  is resolved **once per pair** and hoisted out of the per-contact loop. Region
  membership is a property of the query, so it travels as a run table rather
  than as two more per-contact columns.
- A reversed displayed region is mirrored **within its own span**, in the
  worker. That map is its own inverse, so hover un-mirrors with the same call;
  it never moves a region, so mixed orientations compose; and reflecting a
  same-region pair can invert `u1 <= u2`, which is why the packer
  re-canonicalizes.
- What leaves the worker is one `Float32Array` in the shader's own instance
  layout, written through the shader's generated setters. It transfers
  zero-copy and uploads zero-copy, and the Canvas2D and SVG paths read the same
  buffer at stride.
- The payload carries **no per-contact bin columns**. `(bin + combinedOffset) *
  binWidth` cancels the chromosome-absolute term before the float32 cast, so
  what is stored is a small on-screen coordinate and the inverse recovers the
  bin to within 1.4e-3 of it.

## The colour

![How a contact count becomes a colour](diagrams/hic-colour.svg)

| setting | saturates at | why |
| --- | --- | --- |
| percentile on | `percentile95` | the principled fix for the skew |
| log scale | `maxScore` | the log already compresses the tail |
| neither | `maxScore / 20` | a handful of hot bins near the diagonal would otherwise leave everything else at the bottom of the ramp |

- Both saturation candidates are scored off the **finite** subset of the counts.
  NaN is the dense-block "no value" marker and a tiny normalization divisor
  yields Infinity; either one reaching `colorMaxScore` turns every bin's colour
  into NaN and makes the legend silently vanish.
- `0` is the "nothing to scale against" sentinel, and `hasLegendData` is the one
  place it is interpreted.
- The count-to-ramp mapping is authored in `hic.slang` and lifted into JS by
  `//! js-export`
  ([ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)),
  so the fragment shader, the Canvas2D LUT and the SVG export land on the same
  one of 256 ramp entries.
- `MIN_VISIBLE_ALPHA` is exported from the shader for the same reason, and it is
  a **boundary rather than an optimization**: the fragment discards below it and
  the LUT returns `undefined`, so the bins missing from the picture are exactly
  the bins missing from the export.

## Why the odd-looking branches are there

- **The linear branch divides by a twentieth of the max.** Contact counts are
  heavily skewed, so scaling to the true max painted everything off-diagonal at
  the bottom of the ramp. `useColorPercentile` is the same fix done properly;
  the `/20` is what a file gets without it.
- **The 95th percentile is an exact order statistic, by quickselect.** The
  obvious cheaper answer — a histogram estimate — is wrong for this data:
  linear buckets over `[min, max]` drop nearly every value into bucket 0 and
  collapse the percentile toward zero, which is the one number the ramp
  saturates against. Median-of-three pivoting is not decoration either, since
  contacts arrive in bin order and counts correlate with distance from the
  diagonal.
- **`appliedNormalization` is kept out of `rpcProps()`.** It is fetch-derived,
  so keying the request on it flips the key on every load and throws away the
  matrix that just arrived.
- **Only a pair that contributed contacts may downgrade the applied name.** An
  empty pair reports `NONE` whenever the file has no vector for one of its
  chromosomes at this binsize — routine for small scaffolds — and letting it
  speak ticked `NONE` in the menu while every contact on screen was KR
  normalized.
- **`activeNormalization` is a pure getter, not a write.** Opening a file that
  lacks the selected scheme falls back without marking the track edited; only an
  explicit user pick persists.
- **The view's block layout travels beside the regions, not on them.** The RPC
  framework rewrites `regions[].refName` into the adapter's naming scheme and
  knows nothing of screen layout, and `dynamicBlocks` elides any region narrower
  than three pixels while the ruler still gives it its width. A running sum of
  region widths in the worker therefore slid every region after an elided one
  leftward, and echoing the renamed refName back labelled a hover `1:…` under a
  ruler reading `chr1:…`.
- **The apex height is measured without the borders, the canvas with them.** The
  triangle's base is the span the worker can put contacts on; the canvas covers
  the scrolled content including the boundary padding blocks. They agree except
  when scrolled past an end.
- **The rotation is applied before the squash.** A fit-to-height triangle's bins
  are parallelograms, not rectangles, and the Canvas2D transform stack and the
  SVG export's CTM compose in that same order — otherwise a squashed export
  lands off the diagonal.
- **The hover table confirms geometrically rather than by key.** Cells tile the
  space, so at most one can contain a point; the hash keys on bins only because
  that is the one thing a cursor and a stored cell can both be reduced to. A
  collision costs a step, which is what makes a non-injective scatter safe where
  packing the tuple into one number is not — bins are absolute chromosome
  indices and the packed key stops being an exact integer.
- **The table is built lazily and held in a `WeakMap`.** It costs 20 ms at 300k
  contacts and 350 ms at 4.5M, so building it on fetch would charge every user
  for a hover that may never happen; keying it on the result object releases it
  when the next fetch lands.

## What transfers

**Where the data has tiers, a budget question becomes a resolution question.**
The generic answer to "too much for the budget" is refusal, and it is generic
because most formats have nothing else to offer. A format that stores the same
region at several granularities can answer with a coarser one instead, and the
part worth copying is how the user's control over it is stored: as an **offset
from the automatic pick**, so a deliberate choice still moves with the viewport
rather than becoming an absolute the user has to re-set at every zoom.

**A setting that a file can decline needs three names, and the UI reads the
third.** What the user chose, what the request resolved to, and what actually
came back are three different facts, and collapsing them means either the menu
lies about the data on screen or the fallback silently rewrites the user's
saved choice. The resolution step must be a pure read — the moment it writes,
opening a file that lacks the selection edits the document.

**Orientation belongs in the data, not in the transform.** One linear map cannot
express a reversed axis, let alone a mixed-orientation one, so the reflection is
applied per region where the data is built. Choosing a reflection that maps a
region **onto itself** is what makes it compose: layout is untouched, cross-
region pairs keep their order for free, and the map is its own inverse, so the
hit test un-mirrors with the same call the packer mirrored with.

**Ship the consumer's own struct.** Packing the result in the shader's declared
instance layout, through the shader's generated setters, means the payload
transfers zero-copy and uploads zero-copy, a field added to the struct is a
compile error at the packer rather than a silently mis-strided buffer, and the
fallback painters read one cache line per record instead of walking two parallel
streams. The coupling is the point, not a leak.

**Cancel the large term before the cast and the exact column becomes
unnecessary.** Two per-contact index columns were shipped on the reasoning that
a chromosome-absolute index does not survive float32 — true of the index, false
of what was actually stored, because the offset subtracted the large part
first. Deriving the bound rather than assuming it removed 36 MB from a
viewport-lifetime payload.

**An invisibility threshold is a boundary between surfaces, not a local
optimization.** The moment one painter skips a mark below a cutoff, every other
painter of the same scene has to skip the same marks or the export disagrees
with the figure. Exporting the constant from wherever the decision is authored
is what makes that structural.
