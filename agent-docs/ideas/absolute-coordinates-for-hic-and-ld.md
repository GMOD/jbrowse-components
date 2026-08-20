---
name: absolute-coordinates-for-hic-and-ld
description: HiC and LD are the only two displays whose worker output is fetch-time pixel space, and that one decision is what keeps StaleViewportRescaleMixin, renderTransform.ts, a whole staleness axis and two hand-written reversal mirrors alive. What it would take to retire them, and the one binsize question to answer before starting.
---

# Absolute coordinates, with no exceptions

Two of the architecture's four headline claims are exceptionless and two are
not, and the exception in both cases is the same pair of displays:

| claim | today |
| --- | --- |
| Worker output is absolute genomic uint32 | **not HiC, not LD** — fetch-time pixel space |
| Pan and zoom are a redraw, not a refetch | **not HiC, not LD** — every pan refetches |

HiC sends `viewBlocks` (`calcViewBlocks(contentBlocks, offsetPx)`) plus
`bpPerPx`, and hands `commitDrawnViewport` the `captureViewport()` snapshot its
`prepare` took, after committing
(`plugins/hic/src/LinearHicDisplay/model.ts`). Its worker output is,
in `renderTransform.ts`' own words, "fetch-time pixel space relative to the
first visible block's start". LD is the same shape.

## What that one decision is currently costing, all of it deletable

- `StaleViewportRescaleMixin`
  (`plugins/linear-genome-view/src/BaseLinearDisplay/models/`) — a cross-cutting
  mixin no other display composes.
- `renderTransform.ts` beside it — a correction consumed by the GPU render, the
  mouse hit test and the SVG export alike, three consumers of a transform that
  would otherwise be the identity.
- **One of the three staleness mechanisms.**
  [ARCHITECTURAL_LIMITS.md](../reference/ARCHITECTURAL_LIMITS.md)
  §"Three staleness mechanisms behind one name" lists spatial coverage, viewport
  snapshot and signature compare, and notes each has independently shipped a
  stale-capture bug. The viewport snapshot exists for these two displays and
  nothing else.
- **Two hand-written reversal mirrors.** `computeRenderTransform` is
  FORWARD-ONLY by construction — "one linear map can't express a reversed axis"
  — so orientation is baked worker-side twice, in `hic/regionOffsets.ts`'s
  `mirrorU` and `variants/RenderLDDataRPC/reversedRegions.ts`.
- A refetch on every pan and every zoom, on the display whose data volume argues
  hardest for the GPU in the first place.

## Why it looks tractable

A Hi-C contact is `(bin1, bin2, count)` at a known binsize — absolute genomic
coordinates already — and `diagonalGrid.slang` already owns the rotation. Moving
the projection into the shader is the same move that made pan-a-redraw true for
the rest of the tree. LD's axis is SNP index rather than bp, but every SNP
carries an absolute position, so the same applies with a position array beside
the matrix.

## The one question to answer before starting

**Can the binsize decision stay viewport-derived while the coordinates go
absolute?** It reads `effectiveResolution`, which `CoreGetInfo` supplies. If it
can, the fetch stops being viewport-keyed and a `regionFetchKey` handles the
resolution axis the way wiggle handles BigWig zoom levels
([ADR-008](../architecture-decision-records/adr-008-wiggle-strict-bpperpx-equality.md)).

That is load-bearing for the whole item and it is one afternoon's reading. It is
also unverified today, so do not scope the work before answering it.

## Where this sits

Now the first of two remaining render-path simplifications: two contained
display rewrites that delete a mixin, a transform module and a staleness axis.
The upload-model collapse that used to come first is done (ADR-078, ADR-079)
bar one piece,
[retain-region-is-a-fifth-upload-mechanism](retain-region-is-a-fifth-upload-mechanism.md),
which is smaller than this and answerable by reading;
[one-mark-declaration-per-feature](one-mark-declaration-per-feature.md) last,
because it touches 46 files.
