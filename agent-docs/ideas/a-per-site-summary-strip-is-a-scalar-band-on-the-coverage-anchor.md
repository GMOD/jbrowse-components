---
name: a-per-site-summary-strip-is-a-scalar-band-on-the-coverage-anchor
description: A strip above the genotype rows showing carrier count, allele frequency or call rate per site — the "which sites matter" read the multi-sample displays lack. Every input is already on the wire, so it is render-tier like the variant lane; it is a third Band in the variants fold; and it is a scalar banded against a baseline with reserved insets, which is the exact shape REJECTED_IDEAS names as the trigger for giving the coverage y anchor its second consumer. Read before building it as its own painter, or before proposing any other sharing of that anchor.
---

# A per-site summary strip is a scalar band on the coverage anchor

Moved out of [multi-sample-variant-display](multi-sample-variant-display.md) on
2026-09-02, where it was one paragraph ("mostly a rendering task"). It is a
rendering task, and the rendering it is a task of already exists twice.

## What the reader is missing

A genotype matrix answers "who carries this" per cell and "what is this" per
column (the variant lane, since 2026-08). It does not answer "which columns
matter" — how many samples carry the alt, at what frequency, and how many were
called at all. On a 2504-sample callset the eye cannot count a column, and the
MAF filter that would sort this out is a threshold, not a picture.

The strip is one bar per site above the rows: height is the chosen statistic,
the baseline is zero, the ceiling is the sample count (or 1 for a frequency).
Three statistics, one at a time, chosen from the menu:

- **carrier count** — samples with any alt allele
- **alt allele frequency** — over called alleles, ploidy-aware
- **call rate** — samples with a call, the inverse of missingness

## Everything it needs is already on the wire

`featureGenotypeMap` records every genotype per feature, by reference to the
interned per-feature array (`plugins/variants/src/CLAUDE.md` §"Genotypes"), and
the base model already folds those into `summarizeAlleleCounts` for the MAF
filter and `calculateMissingnessFrequency` for the missingness one
(`shared/minorAlleleFrequencyUtils.ts`) — then discards both. So the strip is a
per-record pass (thousands) over data the worker already shipped, memoized on
the model like `laneRenderDataMap`, and switching it on or changing its
statistic **must not refetch**. That is the property the variant lane was built
to keep, and it is the whole reason the strip is a band and not a hosted
display ([feature-band-consumers](../mechanisms/feature-band-consumers.md)).

Two contracts it inherits from the cell loops, stated so a sixth consumer does
not learn them alone:

- **Mixed ploidy** — a diploid sample has no allele for HP2 in a triploid file,
  and haploid is phased. `readAltDosages` is the ploidy-invariant counter; use it
  rather than splitting the string.
- **`NaN` is the only missing marker.** A call rate that counts a value-scale
  sentinel as a call is the bug the anchored sort had.

## Where it sits in the stack

A third `Band` in `variantTopBandsGeometry`, and it goes **directly above the
rows** — below the lane and below the connector zone — because its x axis is
the plot's, not the genome's:

- the regular display lays columns out at genomic spans, so a bar spans what the
  cells under it span (`variantCellSpanPx`, the same three-geometries rule);
- the matrix lays columns out by feature index at equal widths, so a bar is one
  column wide and the connector zone above it is what ties it back to a
  position.

Putting it above the connector zone would draw an index-space bar over a
genomic-space lane. The fold makes the order one statement, and a sabotage test
in `variantTopBands.test.ts` should pin it the way the lane's does.

Slots live on the shared schema this time, not the regular display's — both
displays can paint it, which is the "`showX` is not `xActive`" rule read the
other way. Height goes on a config slot, clamped through `clampBandHeight`,
with a `BandSeamHandle` at its seam (every band with a height slot drags).

## Why the coverage anchor, and what that buys

The strip is a scalar banded against a baseline with reserved insets at both
ends: a label offset at the top (the y-axis ticks) and a floor at the bottom
(a 1-carrier site must still read as a mark). That is exactly the coverage
band's y anchor — `covEffectiveHeightPx` / `covBottomOffsetPx` /
`normalizeDepthScalar` in `packages/render-core/src/shaders/coverageBand.slang`,
with the CPU twins generated from them (ADR-051) — and it is the shape
[REJECTED_IDEAS](../reference/REJECTED_IDEAS.md) §"Compose a second consumer
onto the shared y scale" names as the reopen condition: _"a second display
banding a scalar against a baseline with reserved insets at both ends is the
shape to watch for, since that would give the coverage anchor its second
consumer."_
[ADR-097](../architecture-decision-records/adr-097-the-y-channel-shares-its-scale-and-not-its-anchor.md)
censused four candidates and every one tripped a kill condition because its
anchor was not really the coverage one. This one is.

So the build is: the strip's bars go through `packCoverageBinsForGpu` +
`drawCoverageBins` (the density band in plugin-canvas already proves a
non-alignments producer can, `shared/densityBand.ts`), the y-axis ticks through
`computeCoverageTicks` as MAF's do, and the domain is `[0, nSamples]` or
`[0, 1]` — linear, since a count over samples has no reason to be log.
Nothing new on the GPU. What is new is ~400 lines of band-consumer glue and the
per-record statistic pass.

**If the strip cannot go through the anchor without a mode flag on it**, that
is ADR-097's verdict standing, and the strip is its own five-line
`scoreToYPx` instead — the decision should be recorded either way, since this
is the one candidate that was supposed to fit.

## What it is not

- **Not a wiggle track alongside.** A bedGraph export of the statistic is a
  separate, cheaper idea ([alignments](alignments.md) has the coverage-band
  form); the strip's point is that it is column-aligned with the rows under it
  and re-derives when the sample filter changes, which a track cannot.
- **Not a per-cell pass.** Per record, or a 2504-sample callset pays 2504× for
  a picture that is one number per column.
- **Not a live number in the menu label.** The statistic's name goes in the
  control; the value goes on the hover.
