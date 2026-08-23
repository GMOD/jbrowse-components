---
name: does-a-base-quality-floor-still-buy-anything-on-the-coverage-band
description: measure the sub-Q20 share that SURVIVES the frequency floor
metadata:
  area: alignments
  category: measure-first
---

# Does a base-quality floor still buy anything on the coverage band

`mismatchQuals` ships per mismatch and drives the pileup's per-base fade
(`qualityFade`, `features/mismatch/drawCanvas.ts`); `computeSNPCoverage` ignores
it entirely, so a Q10 base and a Q40 base contribute equally to the band's
allele counts. Excluding, or down-weighting, sub-Q20 bases is the obvious other
half of the noise story and needs no new payload.

**What is unconfirmed is whether it is still worth anything.**
`coverageSnpMinFrequency` now hides an allele below a fraction of the position's
depth, and low-quality bases are most of what that already removes — the two
filters may be reading the same reads. So measure before building: on the
HG002 300x windows in
[reference/DEEP_COVERAGE.md](../reference/DEEP_COVERAGE.md), what share of the
band's allele counts comes from sub-Q20 bases, and how much of THAT share
survives a 1% allele-fraction floor? If the answer is "almost none", the entry
closes.

If it survives, the design decision is exclude vs down-weight, and they are not
the same statement: excluding changes the denominator's meaning (the bar's depth
still counts the read, so the fractions stop summing to the mismatch rate),
while down-weighting keeps a fractional count the tooltip then has to render.

**Either way this is a worker-side setting, and that is the part to decide
first.** `segHeight` is baked in `computeSNPCoverage`, so a quality threshold
changes the packed buffer and every change of it costs a refetch — where
`coverageSnpMinFrequency` is free to move because the fraction it tests IS
`segHeight`, already in the instance. A quality floor gets the same freedom only
by shipping a second per-segment field (the high-quality count beside the total),
which is 4 bytes a segment for a setting most users will never touch. A config
slot with no menu entry is the honest middle, and it is what to reach for unless
the measurement says people will move it.
