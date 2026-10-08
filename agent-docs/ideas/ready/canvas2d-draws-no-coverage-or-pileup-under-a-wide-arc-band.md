---
name: canvas2d-draws-no-coverage-or-pileup-under-a-wide-arc-band
description: A real bug, not a proposal. On the Canvas2D backend an alignments display with `readConnections: 'arc'` draws its arcs and leaves the coverage and the pileup blank once the view passes about 30 kb, while WebGL2 draws all three and the display reports itself drawn. Reproduced on HG008-T Illumina at SUZ12; the cause is not found.
---

# Canvas2D draws no coverage or pileup under a wide arc band

A bug, found driving the read-connections band on human data on 2026-10-08.
The display reports `data-display-phase="ready"` and `data-display-drawn="true"`,
nothing reaches the console, and the frame is the same twenty seconds later, so
a capture gate cannot see it.

## Reproduce

`jbrowse.org/demos/cgiab/config.json`, a session track over
`HG008-T_Illumina_195x.sv_read_evidence_slices.bam` (the BAM
`website/scripts/specs/paper-sv-reads.ts` mounts), `LinearAlignmentsDisplay`
with `forceLoad`, `readConnections: 'arc'`, `readConnectionsDown`,
`readConnectionsHeight: 110`, `coverageHeight: 50`, `&renderer=canvas2d` in the
hash, a 1400 px view.

| view on chr17 | arcs | coverage | pileup |
| --- | --- | --- | --- |
| 31,975,000-31,980,000 (5 kb) | drawn | drawn | drawn |
| 31,970,000-31,990,000 (20 kb) | drawn | drawn | drawn |
| 31,970,000-32,000,000 (30 kb) | drawn | drawn | drawn |
| 31,965,000-32,005,000 (40 kb) | drawn | blank | blank |
| 31,960,000-32,010,000 (50 kb) | drawn | blank | blank |
| 50 kb, `readConnections` off | none | drawn | drawn |
| 50 kb, WebGL2 | drawn | drawn | drawn |

## Where to look

`drawAlignmentBlocks` (`renderers/Canvas2DAlignmentsRenderer.ts`) paints
coverage and pileup inside `forEachClippedBlock` and the arc band after it, so
arcs with nothing else is what a region map holding the arc feeds and no
laid-out pileup paints: `buildAlignmentsRegionMap` files such a region with
`pileup: undefined` and an empty coverage. Whether `laidOutPileupMap` is empty
on Canvas2D at that width, and why the GPU renderer has the pileup for the same
sources, is the open question. The link mark's painter leaves no canvas state
behind (`linkMark.paintBlock`), and the far-pair path is not involved: these
pairs draw as legs, as they did before the far dome.
