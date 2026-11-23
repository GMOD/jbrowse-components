---
name: the-alignments-key-follows-what-is-drawn
description: With `legend.show` on, the alignments key covers the first section's coverage ticks when reads are grouped. A small fix to an opt-in-only defect.
---

# The alignments key follows what is drawn

The defect shows only with `legend.show` on, which is off by default.

## The key covers the first section's coverage axis when reads are grouped

Grouping moves the coverage scale to the right (`side: self.showsGroupLabels ?
'right' : 'left'`, `LinearAlignmentsDisplay/model.ts`), and `FloatingLegend`
(display-ui) is pinned to the top right, so the key hides the first section's
tick labels: a capture of NA12878 faceted by `mapq` shows it. The fix: the key
sits left of the axis gutter while the scale is on the right.
