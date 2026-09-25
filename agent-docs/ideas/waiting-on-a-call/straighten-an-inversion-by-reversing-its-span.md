---
name: straighten-an-inversion-by-reversing-its-span
description: In a linear synteny view, read an inversion straight by splitting the mate row's region at the breakpoints and reversing only the middle piece, instead of flipping the whole row into an X. Every piece exists but a region split helper. Colin deferred it on 2026-09-24.
---

# Straighten an inversion by reversing its span

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
scalebar reads right to left, and colour-by-strand reads the record's strand
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

- A straightened row reads as mixed orientation, which the follow already
  declines to re-orient. The follow's fallback navigation replaces the list with
  one forward contig, so moving to another contig drops the split.
- The follow's "flip rows to match the anchor inside inverted alignments" uses
  the whole-row flip; with this primitive it could reverse the block's span
  instead, and zooming out would keep straight flanks.
- Nested or off-screen inversions need the block's full mate extent from the
  record, not the visible window's slice.
- The row's locstring becomes three regions, so share links get longer.

The alternative kept the whole-row flip and de-emphasised crossing ribbons. That
hides the X rather than removing its cause, and adds a rule the reader has to
learn.
