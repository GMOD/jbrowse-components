---
name: verify-the-shared-rectcontinuation-buffer-on-real-hardware
description: code landed; only the headed WebGL2/WebGPU check is owed
metadata:
  area: GPU canvas
  category: ready
  order: 1
  first_move: "code landed; only the headed WebGL2/WebGPU check is owed, and no unit test on the Canvas2D path can see a wrong attribute offset"
---

# Verify the shared rect/continuation buffer on real hardware

The second per-region pack and upload is gone: `strand` moved into
`RectInstance` (`rectInstance.slang`, imported by both shaders) and continuation
draws off rect's buffer via `drawPass(continuation, region, bufferPassId=rect)`,
the arrangement chevron already had over line's. Per-rect GPU bytes for the pair
went 48 → 28.

What is still owed is the headed check, on a real GPU, against **both** backends
— a wrong attribute offset shows up as garbled geometry, and no unit test on the
Canvas2D path can see it. WebGL2 binds attributes through
`vertexAttribPointer`/`vertexAttribIPointer` (int vs float matters) while WebGPU
goes through `vertex.buffers`, so agreeing on one proves nothing about the other.
Zoom a gene past both viewport edges and read the »/« direction against the
strand arrows on the same glyph.

`sharedInstanceBuffers.test.ts` pins the two structs against each other, which is
what makes a silent drift into a test failure; it cannot tell you the HAL wired
the offsets it was handed.
