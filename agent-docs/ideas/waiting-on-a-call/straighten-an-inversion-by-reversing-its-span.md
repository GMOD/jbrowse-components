---
name: straighten-an-inversion-by-reversing-its-span
description: Right-clicking an inverted synteny band could reverse just that span of the mate panel rather than flip the whole panel, which only moves the crossing to the flanks as an X; splitting the row at the breakpoints keeps every ribbon straight.
---

# Straighten an inversion by reversing its span

MultiWaySyntenyDisplay drew its lanes this way as 9b652a0199 and reverted it on
2026-10-19 (Colin): a straightened span shows the lane in an order its assembly
does not have, and the crossing is what the records state. Weigh that before
building the row version below.

The case for the row version anyway is that the reader asks for it. The lane
layout straightened every inversion on its own, while this is a right-click on
one inverted band. The reversed piece also says what was done: its scalebar
reads right to left, and "Reverse region" on it undoes the change.

## The entry point is the inverted band's menu

On a right-clicked band with strand −1, the menu offers "Reverse the matching
region in the bottom panel", beside the "Move top/bottom panel to the matching
region" items in `LinearSyntenyDisplay/bandMoveTargets.ts`. Flipping the whole
panel stays where it already is, as "Horizontally flip" in the LGV's own menu.
A band-menu copy of that would add an item that turns the crossing into the X
below.

When the inverted block covers the mate's whole visible window, as with a fully
inverted contig or a view zoomed inside the inversion, splitting makes pieces
off screen. The same item then reverses the region whole, so the menu still
has one item.

Questions for the build:

- Whether to offer only the bottom (mate) panel, which matches "Horizontally
  flip inverted targets" in the launch dialog, or name top and bottom as the
  move items do. Reversing either side straightens the band.
- Whether the item belongs on the LGV-embedded synteny track's feature menu
  (`LGVSyntenyDisplay/contextMenuItems.ts`) too, where the mate is a separate
  view.

A whole-row flip turns an inversion's flanks anti-parallel, so the ribbons
either side cross in an X. Reversing only the inverted span keeps every ribbon
straight:

```
before (row flipped)          after (span reversed)

top   [ A ][  INV  ][ C ]     top   [ A ][  INV  ][ C ]
        \    |    /                   |     |     |
          \  |  /                     |     |     |
            X                         |     |     |
          /  |  \                     |     |     |
        /    |    \                   |     |     |
bot   [ C ][  INV  ][ A ]     bot   [ A ][ INV< ][ C ]
```

The inversion stays visible through two existing cues: the reversed region's
scalebar reads right to left, and color-by-strand reads the record's strand
rather than the drawn twist. Nothing else on screen moves, because the reversed
span occupies the pixels it did before.

## The mechanism is a displayed-region list

The mate row's one region becomes three regions of the same contig, the middle
one `reversed: true` — the shape the scalebar's "Reverse region" item and
diagonalize already produce. For an inversion at 1.5-1.8 Mb on a row showing
chr2:1.0-2.3 Mb:

```
[chr2:1,000,000-1,500,000]
[chr2:1,500,000-1,800,000 reversed]
[chr2:1,800,000-2,300,000]
```

Regions lay out contiguously with a seam at each boundary, every track renders
per block, and ribbons map through the view's bp-to-px, which already handles a
reversed region.

## What building it takes

- A sibling of the feature menu's "Move top/bottom panel to the matching
  region", which resolves the mate span from the CIGAR, that reverses the span
  instead of navigating to it.
- The one new helper: split a region into three at two coordinates. The LGV
  already reverses a region by index and replaces the list keeping the centre.
- Undo is "Reverse region" on the middle piece, or a merge item.

## Caveats

- The follow's fallback navigation replaces the list with one forward contig,
  so moving to another contig drops the split.
- Nested or off-screen inversions need the block's full mate extent from the
  record, not the visible window's slice.
- The row's locstring becomes three regions, so share links get longer.

The alternative kept the whole-row flip and de-emphasised crossing ribbons. That
hides the X rather than removing its cause, and adds a rule the reader has to
learn.
