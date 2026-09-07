---
name: three-designs-for-softening-the-synteny-thin-fade-s-transition
description: Three designs for softening the synteny thin-fade's transition
area: comparative-and-pangenome
---

# Three designs for softening the synteny thin-fade's transition

, measured
2026-08-21 and declined in favour of leaving it a snap
([ADR-085](../architecture-decision-records/adr-085-the-thin-fade-decision-snaps.md)).
The complaint is real on paper: the fade is one view-wide boolean over a 0.15
floor, so the decision changing moves every sub-pixel ribbon by up to 0.85 at
once. Swept over both shipped files — every chromosome, 24 zooms, panned end to
end, each flip weighted by what it repaints — **no flip repaints 50 ribbons at
twice the ink**, and the loudest anywhere is 57 ribbons at 1.67x. **A strength
ramp** replacing the boolean cannot be built on `cappedMeanWidthPx` at all: a
capped mean cannot exceed its cap, so the signal tops out below
`FADE_WIDE_BLOCK_PX` = 2 (1.909 px is the largest either file produces) and the
strength never reaches 0, leaving every view permanently faded and every golden
fetch-window dependent. **Easing the uniform over ~200 ms** needs a clock in a
render path that has none, and `data-display-drawn` would have to treat an
easing display as unsettled or every screenshot races. **A deadband on the
ten-block count bar** was built and reverted: it halves the flips that move
on-screen ink 2x or more (204 → 106), but all 11,247 positions where it
disagrees with the plain bar are `full` → `faded` at a median of **two visible
ribbons**, so it buys stability by leaving a near-empty view's hairlines at 15%
alpha — the thing the count bar exists to prevent.
