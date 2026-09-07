---
name: overlay-subfeature-labels-as-the-compact-mode-replacement-for-below
description: `overlay` subfeature labels as the compact-mode replacement for `below`
area: rendering-and-displays
---

# `overlay` subfeature labels as the compact-mode replacement for `below`

—
rejected 2026-08-11 on measurement. It looks free (overlay reserves no
vertical space), but overlay puts the label's top at the box's top and the two
shrink on different curves, so in superCompact a 7.15px label sits on a 3px box
and spills ~4px onto the transcript below. It trades a fixed overlap for an
unfixed one. The overlap itself is a live question —
[ideas/overlay-subfeature-labels-swallow-the-row-below-them-in-compact-modes.md](../ideas/overlay-subfeature-labels-swallow-the-row-below-them-in-compact-modes.md).
