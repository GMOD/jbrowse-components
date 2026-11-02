---
name: one-spelling-for-the-drawn-row-count
description: The count of drawn rows is spelled `nrow`, `numRows` and `rowCount` across the row displays, and the mark display carries two getters for it. Separately, alignments' `rowHeight` is a pitch (feature height plus spacing), where every other `rowHeight` is a row's height. The call is which spelling wins.
---

# One spelling for the drawn-row count

The number of rows a display draws has three names:

- `rowCount`: the mark display's getter and its facet layout, synteny, MAF
  and sequence (about 50 files).
- `numRows`: wiggle's getter and the props its separators, hit test and SVG
  export take (about 27 files, 18 in wiggle).
- `nrow`: what `applyRowResizeWheel` (packages/core) and
  `useRowVirtualScroll` divide the plot by (about 17 files, a few of them R's
  own `nrow()` in generated scripts). The mark display
  keeps a second getter, `nrow`, that only returns `rowCount` under this name.

One spelling removes the mark display's alias and lets a reader grep one word
for every site that sizes or scrolls by row count. `rowCount` is the most
used and reads as English; `nrow` matches R and ggplot's `facet_wrap(nrow =)`.

## Alignments' rowHeight is a pitch

In plugins/alignments, `rowHeight` is `featureHeight + featureSpacing`
(`alignmentComponentUtils.ts`, `computeVisibleLabels.ts`, `groupLayout.ts`),
the distance from one row's top to the next. Every other display's
`rowHeight`, including the `rows.rowHeight` config slot, is a row's own
height. Calling the alignments value `rowPitch` (about 15 files) keeps a
reader from adding spacing to it twice.
