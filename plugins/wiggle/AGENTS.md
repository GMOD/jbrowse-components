# Wiggle Plugin Notes

## Rendering Architecture

Data is uploaded per-region and rendered per-block with scissor/viewport
clipping. Each block maps to a region with its own GPU buffer and regionStart. A
single-pass approach would require a combined buffer re-upload whenever any
region changes, which is worse for scrolling where typically only one region
updates. Per-block draw call overhead is small relative to the data upload cost.

## Three-way sync: Canvas 2D, WebGL, and WebGPU

The wiggle display has three rendering backends that must stay synchronized:

1. **WebGL** (GLSL shaders in `wiggleShader.ts` + `WiggleRenderer.ts`)
2. **WebGPU** (WGSL shaders in `wiggleWgsl.ts` + `WiggleGPURenderer.ts`)
3. **Canvas 2D** (`Canvas2DWiggleRenderer.ts`)

When changing rendering behavior (colors, whisker contrast, draw order, scale
logic), apply the same change to all three backends. The SVG export path in
`renderSvg.tsx` must also stay consistent with the canvas renderers.
