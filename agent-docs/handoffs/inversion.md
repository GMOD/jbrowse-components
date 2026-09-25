the inverted span of the mate row.

What that looks like. The LGV already supports a region list with mixed orientation, and the scalebar's per-region "Reverse region" item produces one. So "read this inversion straight" becomes: split the mate row's region at the inversion's two breakpoints, and reverse only the middle piece.

before (row flipped)          after (span reversed)

top   [ A ][  INV  ][ C ]     top   [ A ][  INV  ][ C ]
        \    |    /                   |     |     |
          \  |  /                     |     |     |
            X                         |     |     |
          /  |  \                     |     |     |
        /    |    \                   |     |     |
bot   [ C ][  INV  ][ A ]     bot   [ A ][ INV< ][ C ]

Every ribbon runs straight and parallel. The inversion stays visible through two existing cues: the reversed region's scalebar reads right to left, and colour-by-strand reads the record's strand rather than the drawn twist, so the block keeps its inversion colour. Geometry says where, colour says which way. Nothing else on screen moves, because the reversed span occupies the same pixels it did before. A whole-row flip scrolls everything.

How it would be built. All the pieces exist:

- The feature context menu already has "Move top/bottom panel to the matching region", which resolves the mate span from the CIGAR. A sibling item, one per row, would reverse that span instead of navigating to it.
- The LGV has the region helpers for reversal and for replacing the list while keeping the centre. The new piece is splitting one region into three at two coordinates.
- Undo is the scalebar's "Reverse region" on the middle piece, or the same menu item again.

Caveats to know going in.

- A straightened row is "mixed" orientation. The follow already declines to orient a mixed row, so it will not fight the split. But the follow's fallback navigation replaces the region list with one forward contig, so a straightened row loses the split if the follow ever moves it to another contig. That is the existing "replaced" branch and it already discards hand-built lists.
- The follow's own "flip rows to match the anchor inside inverted alignments" uses the whole-row flip. Zoom out from inside an inversion with that on and you get exactly the X you describe, since the follow stops deciding once the window is mixed. If the span reversal exists as a primitive, the follow could reverse the block's span instead of the row, and zooming out would show straight flanks.
- Nested or off-screen inversions need the block's full mate extent from the record, not the visible window's slice.

The alternative, which I would not pick. If the whole-row flip stays as the route, the X is real information: the flanks genuinely are anti-parallel now. The only lever is de-emphasis, drawing crossing ribbons behind straight ones at lower opacity. That hides the noise rather than removing its cause, and it adds a rule the reader has to learn.

If you want the span reversal, I can size it against the existing panel-move code befo

✻ Worked for 3m 51s · done 10:41 AM

❯ would it use multiple displayedregions for this?

Yes. That is the whole mechanism. Let me check what the LGV draws at a region boundaryuld look like.

  Searched for 3 patterns, ran 4 shell commands

Yes. The mate row's single displayed region becomes three regions of the same contig, he middle one carrying reversed: true. That is the same shape the scalebar's "Reverseregion" item already produces, and the same shape diagonalize output has.

Concretely, for an inversion at 1.5 Mb to 1.8 Mb on a row showing chr2 from 1.0 Mb to 2.3 Mb:

before:  [chr2:1,000,000-2,300,000]
after:   [chr2:1,000,000-1,500,000]
         [chr2:1,500,000-1,800,000 reversed]
         [chr2:1,800,000-2,300,000]

What follows from that, all of it existing LGV behaviour:

- No gap. Regions lay out contiguously. The row draws a 3px seam at each region's righs get a seam each and nothing else moves. The reversed span occupies the same pixels itdid before the split.
- The scalebar labels each region, and the middle one's coordinates run right to left.he reader sees the inversion once the ribbon runs straight.
- Tracks in that row handle it already. Every track renders per block, and a reversed block is what the whole row was made of after a horizontal flip. So the gene track shows gene order reversed inside
  the span and forward outside it.
- The row's orientation reads as mixed, which is the state the follow already declines to re-orient. So the follow will not flip it back on its own.
- Ribbons map through the view's bp-to-px, which handles per-region reversal, so the se to draw the untwisted ribbon.

The one new piece of code is splitting a region into three at two coordinates. The LGVion by index and to replace the list while keeping the centre, but no split helper. Theundo is the scalebar's "Reverse region" on the middle piece, which leaves the three regions in place but forward, or a merge item if you want the row to go back to one region.
One trade-off to be aware of: the locstring for that row becomes three regions, so a share link or a copied region reads as three pieces. Region lists already survive share links, so nothing breaks, but the URL is longer and a user pasting it elsewhere sees the split.
