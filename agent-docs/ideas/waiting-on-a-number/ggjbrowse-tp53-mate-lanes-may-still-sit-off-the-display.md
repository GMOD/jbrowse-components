---
name: ggjbrowse-tp53-mate-lanes-may-still-sit-off-the-display
description: On ggjbrowse's TP53 gallery stack each jb2export mate lane started tens to about two thousand bp from the engine's. Both causes found since are fixed, but the parity suite would have passed before either fix; re-run the TP53 comparison to know.
---

# ggjbrowse's TP53 mate lanes may still sit off the display

On ggjbrowse's TP53 gallery stack (hg38 over panTro6, gorGor6 and ponAbe3),
each lane jb2export drew started tens to about two thousand bp from the
engine's at the same 250 bp/px view, up to about 8 px.

Both causes found since are fixed:

- the engine fetches the view's static blocks as the display does
  (5ef07e9985)
- a mate is cut at the viewport edge along its record's alignment ops
  (`placementMateInterval`), not in proportion to the record's length, so a
  record carrying an indel and clipped at a different fetch edge gives the same
  mate span

The parity suite's "4 kb just past the deletion" case agrees within its 1 px,
but both sides fetch the same blocks there, so it would have agreed before
either fix.

## The number

Re-run the TP53 comparison: each mate lane's start in jb2export against the
display's, at 250 bp/px. Within 1 px closes this; more reopens the hunt.
