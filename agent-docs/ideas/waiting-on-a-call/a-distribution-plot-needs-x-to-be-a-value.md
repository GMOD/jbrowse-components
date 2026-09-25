---
name: a-distribution-plot-needs-x-to-be-a-value
description: The read cloud already plots insert size on y and the worker already sorts an Int32Array of every insert on screen, yet nothing draws the distribution — because every x in the tree is genomic bp, the encoder's x lane is a Uint32Array and a view's axis is a region list. The affine projection, the value-scale object and the bin/aggregate steps all exist, so the gap is one coordinate host whose x is a value. What it costs, the three distributions waiting on it, and why a dotplot mode and a spreadsheet plot tab are both the wrong place to put it.
---

# A distribution plot needs x to be a value

Colin asked on 2026-09-25 whether the dotplot view could take quantitative
values on its two axes. The question underneath is the one worth filing: the
tree has a value scale for y and none for x.

## What already exists

**A value on y, in the mainstream track.** The read cloud draws each pair as a
flat line at `y = |TLEN|` (`ARC_SHAPE_FLAT` and `plotsOnInsertSizeAxis` in
`plugins/alignments/src/features/arcs/shapes.ts`), and
`computePairedInsertSizeStats` sorts an `Int32Array` of every insert in the
window for the median and MAD its colouring classifies against. Wiggle,
Manhattan and the mark display each put a declared field on y through
`scales.y` (ADR-142), and `ScoreAxisMixin` derives the ticks, the title and the
reference lines from that one object.

**The transform a distribution is made of.** `bin` and `aggregate` are typed
steps in `packages/core/src/util/featureTransforms.ts` and already run in the
worker. A histogram is those two steps and a bar mark.

**The projection.** A dotplot axis is `(v - origin) * invScale`, flipped on y
(`plugins/dotplot-view/src/DotplotDisplay/dotplotProject.ts`), and every 1D
view's is the same affine. Nothing about it is genomic.

## What is missing

One coordinate host whose x is a value. The coordinates row of
[GRAMMAR_OF_GRAPHICS.md](../../reference/GRAMMAR_OF_GRAPHICS.md) says "genomic x
along a strip" plus the circular view's polar resampling (ADR-119), and there is
no third answer. Two things stand in the way:

- **The x lane is genomic.** `encodeFeatures` packs `x` and `x2` as
  `Uint32Array` absolute bp, and `hitIndexOf` indexes those
  (`packages/core/src/util/markEncoding.ts`). A value on x is a Float32 lane
  through the encoder and the payload.
- **A view's axis is a region list.** Every host satisfies `RegionHost`
  (`packages/display-kit/src/regionHost.ts`): blocks, `displayedRegions`,
  `bpPerPx`, `visibleRegions`. Both the ticks and the fetch come off regions,
  and a value axis has neither.

## What it would draw

Insert size first. The worker already holds the sorted array, and "is this
library's insert distribution bimodal here" is the question a reader of the
cloud asks next. Then the score distribution behind a wiggle's autoscale, and an
SV callset's size distribution, which [sv-size-ring](sv-size-ring.md) wants the
same numbers for.

Each of the three is small once a host exists, and none of them justifies the
host alone.

## Two hosts considered and dropped

Recorded so the next session does not re-propose them from the same chat.

**A quantitative mode on the dotplot.** The projection would carry it unchanged,
but `plugins/dotplot-view/src/DotplotView/model.ts` names assemblies on 66
lines, its ticks are refName content blocks, its borders are sized from the
widths of those label strings (`axisBorderPx`), and reorder-chromosomes,
diagonalize (ADR-034), the highlight bands, `navAxisToLoc` and the two-assembly
import form are each meaningless on a value axis. Colin, 2026-09-25: the dotplot
is obscure.

**A plot tab on the spreadsheet view.** Its rows already carry loci and it
already computes derived numeric columns (`svSize.ts`, `svTypeTally.ts`), so the
fetch and the click back to a locus would come free. Colin, 2026-09-25: not
interested in the spreadsheet.

## The call

Whether a distribution is worth a coordinate host at all, and if so where it
lives — a panel off a track menu, a display in a view, or nothing. Nobody has
committed to it; the y half of the picture shipped three times over without the
x half being asked for.
