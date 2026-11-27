---
name: a-read-count-floor-replaces-the-low-frequency-depth-ramp
description: The pileup's low-frequency threshold zeroes a heterozygote's marks below 22x; a floor of two supporting reads and 25% of depth keeps hets at every depth and drops the same errors, but it changes every alignments track at zoom-out.
---

# A read-count floor replaces the low-frequency depth ramp

`featureFrequencyThreshold`
(`plugins/alignments/src/LinearAlignmentsDisplay/constants.ts`) is a depth
ramp: 0.8 under 10x, linear to 0.3 at 30x. A 50% allele first clears it at
22x, so below that a heterozygote's pileup marks are zeroed and fade to
`pxPerBp` when zoomed out. What separates a sequencing error from a het at low
depth is the read count, not the fraction: one read at 6x is 17% and three
reads is 50%, and only the count tells them apart.

- `≥ 2 supporting reads AND ≥ 25% of depth` suppresses every error case the
  ramp does (a singleton at 500x is 0.2%, a singleton at 6x fails the count)
  while keeping hets at every depth. It is the shape the indicator triangles
  already use, a depth floor plus a flat fraction, so the pileup ramp is the
  outlier among the rules in
  [DEEP_COVERAGE.md](../../reference/DEEP_COVERAGE.md).
- The fade then double-counts what is left. The number of rows painting a mark
  at a position is the supporting-read count, so allele fraction is already in
  the picture linearly, and `frequencyAlpha` multiplies alpha by that fraction
  again. Total ink goes as count²/depth: at 40x a hom column measures 40.0 and a
  het 10.1, a 4x gap from a 2x difference in support. Making the alpha a step on
  the already-thresholded byte rather than a lerp on it is the other half.

The call is default or setting. It moves what every alignments track shows at
zoom-out, so it wants a measurement against the real-read fixtures and a golden
refresh, and `pileup.fadeLowFrequency` already keeps the old behaviour
reachable.
