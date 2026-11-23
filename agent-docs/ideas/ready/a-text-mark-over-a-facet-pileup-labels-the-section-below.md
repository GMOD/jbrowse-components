---
name: a-text-mark-over-a-facet-pileup-labels-the-section-below
description: A `text` mark beside a `rect` in a LinearMarkDisplay whose `facet` runs a `pileup` draws each section's labels one section low, where their halo covers the next section's rects. Seen on the AlphaGenome 2 per-gene effect tracks, which dropped the text mark to ship.
---

# A text mark over a facet pileup labels the section below

## Trigger

The AlphaGenome 2 per-gene effect track before `00b7b20510`: a BED with a
`cell_type` column, one display, rects colored by `score`, gene names as text.

```js
{
  type: 'LinearMarkDisplay',
  facet: { field: 'cell_type', transform: [{ type: 'pileup' }] },
  encoding: { color: { field: 'score', scale: { type: 'linear', scheme: 'redblue' } } },
  marks: [
    { mark: 'rect' },
    { mark: 'text', encoding: { text: 'name', color: { value: '#222222' } } },
  ],
}
```

At chr21:38,790,000-39,330,000 with seven sections, the first section drew its
rects and no labels, and every later section drew the labels of the section
above it over its own rects, so the white halo hid them. The last section's
labels fell past the plot.

## Where to look

With no `y` and no link on the same feet, `placeTextMarks`
(`plugins/marks/src/LinearMarkDisplay/textMarks.ts`) centres a label in the
band `rowSlot(row, i, state.rowTable)` names
(`packages/render-core/src/marks/rowLane.ts`). The rect lands in the right
section, so the text layer's `row` lane, or the table it is read through,
disagrees with the rect's under a facet `pileup`: likely the section offset is
added twice, or the label reads a lane index the rect reads as section-relative.

## Done when

The config above labels each gene inside its own section, and a capture of the
AlphaGenome 2 tracks with the text mark restored shows it.
