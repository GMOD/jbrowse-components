---
name: a-sashimi-lane-above-coverage
description: The alignments display draws sashimi arcs over the coverage band by default and in a strip below it once coverage is hidden; ggjbrowse draws its junctions as a lane above coverage. Whether the display should offer that lane, or default to it, is Colin's call.
---

# A sashimi lane above coverage

The alignments display's `sashimi.placement` puts the arcs over the coverage
band (`up`, the default), in a strip below it (`down`), or by crossing
(`auto`); with coverage hidden every arc draws in the strip below (ADR-232
step 5). ggjbrowse's `autoplot` stacks its junctions as a lane of their own
above coverage, with no overlay.

The call: add an `above` placement, make the lane the default, or keep the
overlay. Nothing is built; ask Colin before building.
