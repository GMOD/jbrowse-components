---
name: a-dense-arc-band-blanks-canvas2d-under-swiftshader
description: A headless capture pinned to Canvas2D under `--use-angle=swiftshader` loses the coverage and the pileup of an alignments display once its arc band strokes several thousand arcs. The painter draws them and the browser's accelerated canvas drops them; software canvas and real GPUs keep them. The call is whether to work around it in the painter or in the capture harness.
---

# A dense arc band blanks Canvas2D under SwiftShader

Found on 2026-10-08 driving HG008-T Illumina at SUZ12 with
`readConnections: 'arc'` and `&renderer=canvas2d`. Past about 30 kb the arc
band draws and the coverage and pileup are blank, with the display reporting
itself drawn and nothing on the console.

The painter is not at fault. At 50 kb `buildAlignmentsRegionMap` holds the
pileup, `drawAlignmentBlocks` runs once, and a `getImageData` inside it reads
the coverage and pileup pixels back before and after `paintArcBands`. Taking
that readback also makes the final frame correct. The frame's 202,905 canvas
calls, replayed into a bare `<canvas>` in Chrome 154.0.8037.97:

| canvas backend | coverage and pileup |
| --- | --- |
| ANGLE on SwiftShader, accelerated canvas | blank |
| software canvas, no flags | drawn |
| ANGLE Vulkan, AMD radv | drawn |
| ANGLE GL, Intel UHD 630 | drawn |

The app pinned to `renderer=canvas2d` on the AMD Vulkan backend draws all three
bands at 50 kb, so a reader on a real GPU or on Chrome's software canvas is not
shown to be affected. The captures that are: any figure, browser test or probe
that pairs the Canvas2D pin with the SwiftShader flags over a dense arc band.

## What sets it off

Each of these alone restores the replayed frame: dropping the arc band's clip
(`withClip` in `paintArcBands`, `Canvas2DAlignmentsRenderer.ts`), giving that
clip a fractional height, dropping the ellipses under 12 px wide, or dropping
three quarters of the earlier `fillRect`s. In the app, capping the ellipse
strokes at 5,000 draws the frame and 8,000 blanks it; the 30 kb view strokes
5,444 and the 50 kb view 10,944. The far-pair legs and the far dome play no
part. A synthetic stream of 140,000 rects and 60,000 uniform ellipses under the
same clip did not reproduce it, so there is no minimal case to report upstream
yet.

## The call

- **In the painter:** stroke same-style arcs as one path, which also cuts the
  draw count on every backend. Untested against this defect.
- **In the harness:** stop pairing the Canvas2D pin with
  `--use-angle=swiftshader`, since Chrome's software canvas draws the frame.
  Untested in the app.
- **Neither:** note it where the capture flags are documented and move on.
