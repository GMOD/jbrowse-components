---
name: the-alignments-key-follows-what-is-drawn
description: With `legend.show` on, the alignments key covers the first section's coverage ticks when reads are grouped, and lists read colors while the pileup is hidden. Two small fixes, both opt-in-only defects.
---

# The alignments key follows what is drawn

Both defects show only with `legend.show` on, which is off by default.

## The key covers the first section's coverage axis when reads are grouped

Grouping moves the coverage scale to the right (`side: self.showsGroupLabels ?
'right' : 'left'`, `LinearAlignmentsDisplay/model.ts`), and `FloatingLegend`
(display-ui) is pinned to the top right, so the key hides the first section's
tick labels: a capture of NA12878 faceted by `mapq` shows it. The fix: the key
sits left of the axis gutter while the scale is on the right.

## The key lists the read colors while the pileup is hidden

With `pileup.show` off, the key lists the levels of `encoding.color` though the
display draws no read (the same NA12878 track, colored by `mapq`). The read
connections paint `insertSizeAndOrientation` in the reads' colors, so the fix
is that the rows go when no drawn mark paints the field.
