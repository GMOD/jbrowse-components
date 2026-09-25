---
name: split-view-connectors-take-the-displays-colours
description: The breakpoint split view colours its read connectors from the theme's four pair colours, so a strand-flip split read is RR/LL-coloured there and splitInversion-coloured in the pileup under it, and the view has no legend. Taking the pileup's colours wholesale was built and held back on 2026-09-25: every connector the split view draws is evidence, and the pileup's colours for a concordant pair and a same-strand split are the ones meant to fade.
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

## Built and held back, 2026-09-25

Branch `split-view-connector-colours` does the first two bullets: a
`connectionKind` table in alignments-core that the split view and the display's
`connectionLabel` both read, pinned by a colour-parity test over every stock
theme. A review found the wholesale match is wrong for this view:

- The split view draws only reads `getBadlyPairedAlignments` let through, so an
  LR pair it draws lacks the proper-pair flag — deletion or discordant-pair
  evidence. The pileup's `pairLR` is `#d3d3d3` at 1.50:1 on white, chosen to
  fade (`palette.ts`), and the user guide teaches deletion evidence as red.
- A co-linear split junction went from `text.secondary` (~3.7:1) to
  `colorSupplementary` `#f0b878` (~1.6:1), on a 1 px stroke over white gutters.
- The branch shares labels by construction but not the classifier:
  `classifyPair` never calls `connectionKind`, and `connectionColor` restates
  `swatchPaletteKeys`, which `palettes.ts` names as the thing to derive rather
  than test.

The call is what a mate link means here. Insert size, as the arc band colours it
(`ARC_SLOT_CATEGORY`, where `longInsert` is red), keeps deletion evidence
visible; so does a dark neutral kept for this view alone. Either way
`classifyPair` should compute through the shared kind so the two views agree by
construction, and the key matters more once the colours carry meaning, since the
display's own legend is off by default and lists only what the display drew.
