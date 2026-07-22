---
name: todo
description: Action items to build or fix, the current backlog. Read when picking up work.
---

## Alignments / canvas

- Group by strand, `plugins/canvas`.
- Toggle off tooltips for `LinearMultiSampleVariantDisplay`.
- Add a "hide this feature" option to `LinearMultiSampleVariantDisplay` (and similar displays).
- Quick/copy consensus, a separate quantitative splice-junction track, and sample/library (SM/LB) grouping.

## more accurate cgiab

look at wakhan, pycnv


## add extra large text svg mode for pub ready figures



## autofit height for lineargenomeview example-site demo


## review release process




## LD reversed regions

The LD triangle renders **unflipped** on a reversed displayed region — it lays
out by forward genomic position while the ruler runs right-to-left. Architectural,
not the 1bp-cell class. Purely visual (hover inverts the same forward transform)
and niche: needs a flipped region over an LD track.

Copy hic: it mirrors each contact within its own region's span when the worker
builds `positions[]` (`hic/regionOffsets.ts` `mirrorUInRegion`), so every
renderer stays orientation-agnostic and `computeRenderTransform` stays
forward-only. Don't mirror via a negative ctx scale — `SvgCanvas` gets that wrong
under rotation, and the SVG export shares the draw.

LD differs in blast radius (call sites enumerated at
`LDDisplay/components/LinesConnectingMatrixToGenomicPosition.tsx:20`): it's
all-or-nothing, and its index positioning mode mirrors over indices rather than
genomic px.
