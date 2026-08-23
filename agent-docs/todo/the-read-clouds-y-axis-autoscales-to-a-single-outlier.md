---
name: the-read-clouds-y-axis-autoscales-to-a-single-outlier
description: needs a measurement on deep data, not a chosen statistic
metadata:
  area: alignments
  category: ready
---

# The read cloud's Y axis autoscales to a single outlier

`arcsYDomainBp` is `max(1000, maxFlatArcSpanBp)` with no upper bound, and every
lane shares it. One off-screen mate 50 Mb away on the SAME chromosome therefore
sets the axis for the whole display and `insertSizeTickSections` prints "50Mb" at
the top of it. Verified with two arcs: `maxFlatArcSpanBp: 50000000`.

This is the failure the interchromosomal exclusion was written to prevent
(`resolveArcs`: "one connection would rescale the whole read cloud to a 107 Mb
'insert size' and label it"), reached by the identical route from a
same-chromosome connection — and `drawLongRange` defaults true, so it is the
default path. **Note the part that is NOT a defect**: a split junction plotting at
its breakpoint gap is deliberate (`computeArcShape`, "so a split-supported SV
lands on the same ruler height as the equivalent-span discordant pair"), so
excluding `ARC_SHAPE_FLAT_SPLIT` from the domain is the wrong fix — it would put
an unpaired long-read cloud entirely on the ceiling.

The log axis limits the damage to roughly a 1.6x compression of the interesting
range rather than a collapse, which is why this is filed rather than fixed. What
it needs is a measurement, not a chosen statistic: a percentile domain is the
standard answer and is a no-op at the sample sizes where the outlier is most
visible (p99 IS the max below ~100 arcs), so picking one without deep data would
be shipping an unmeasured change to the picture. Read the span distribution off a
real 300x read cloud first. `arcYOffsetPx` already clamps over-domain arcs to the
ceiling, so whatever bound wins needs nothing downstream.
