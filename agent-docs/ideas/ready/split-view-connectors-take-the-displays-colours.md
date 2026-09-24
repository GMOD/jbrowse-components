---
name: split-view-connectors-take-the-displays-colours
description: The breakpoint split view colours its read connectors from the theme's four pair colours, so a strand-flip split read is RR/LL-coloured there and splitInversion-coloured in the pileup under it, and the view has no legend to say which is which. One connection-colour table in alignments-core, read by both, plus a key in the split view.
---

# Split view connectors take the display's colours

The alignments display colours a connector by meaning: `LINKED_READ_SLOT_CATEGORY`
and `ARC_SLOT_CATEGORY` (`plugins/alignments/src/shaders/palettes.ts`) map each
slot to a `SwatchCategory`, and `swatchPaletteKeys`
(`LinearAlignmentsDisplay/colorUtils.ts`) resolves that category to a palette
colour, the same one the read fills use.

The split view has its own table. `useOrientationColor`
(`plugins/breakpoint-split-view/src/BreakpointSplitView/components/getOrientationColor.tsx`)
reads `theme.palette.alignmentFill`, which holds only the four pair colours and
the unmapped-mate colour. So:

- a strand-flip split read is drawn in `pairRR`/`pairLL` in the split view and
  in `splitInversion`'s colour in the pileup beside it;
- a same-strand split junction falls to `text.secondary` and an
  interchromosomal connection to `text.disabled`, neither of which matches a
  swatch in the display's key.

The split view also draws no legend, so its colours cannot be decoded where
they are drawn.

## The change

- Move the category-to-colour derivation that both overlays need
  (pair orientations, `splitInversion`, `splitDeletion`, `interchrom`) out of
  `plugins/alignments` into `@jbrowse/alignments-core`. The split view already
  depends on that package, and has no dependency on `plugin-alignments`.
- Have `useOrientationColor` resolve through that table, with the display's
  labels (`connectionLabel`, `SPLIT_JUNCTION_LABELS`) for the tooltip reasons.
- Add a key to the split view listing the categories its connectors actually
  drew, built with the same bucket-and-label helper the display's legend uses.
