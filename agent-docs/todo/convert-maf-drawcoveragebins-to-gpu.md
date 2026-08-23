---
name: convert-maf-drawcoveragebins-to-gpu
description: alignments already draws its coverage bars on the GPU; the MAF band still calls the Canvas2D drawCoverageBins path
metadata:
  area: MAF, GPU
  category: ready
---

# Convert MAF drawCoverageBins to GPU

`drawMafCoverage` (`plugins/maf/src/LinearMafDisplay/components/drawMafCoverage.ts`)
calls alignments-core's `drawCoverageBins` — a Canvas2D bar-per-bin loop — from
both the on-screen `MafCoverageBand` and the SVG export path. Alignments'
coverage band already left this behind: `plugins/alignments/src/shaders/slang/
coverage.slang` draws the equivalent depth bars on WebGPU/WebGL, with Canvas2D
as the fallback. MAF's coverage band is still Canvas2D-only.

`coveragePackedBuffer` is already worker-packed depth data, the same shape the
alignments GPU path consumes, so this is a consumer swap rather than a new
pipeline: point `MafCoverageBand` at the alignments GPU renderer (or a shared
one) behind the same backend-selection the alignments display uses, and keep
`drawCoverageBins` for the SVG export, which draws once and has no backend to
pick.
