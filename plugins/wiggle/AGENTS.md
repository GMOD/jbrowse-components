# Wiggle Plugin Notes

## Rendering Architecture

Data is uploaded per-region and rendered per-block with scissor/viewport
clipping. Each block maps to a region with its own GPU buffer and regionStart. A
single-pass approach would require a combined buffer re-upload whenever any
region changes, which is worse for scrolling where typically only one region
updates. Per-block draw call overhead is small relative to the data upload cost.

## Three-way sync: Canvas 2D, WebGL, and WebGPU

The wiggle display has three rendering backends that must stay synchronized:

1. **WebGPU / WebGL2** via `GpuWiggleRenderer.ts` — one Slang source
   (`shaders/wiggle.slang`) is compiled to WGSL and GLSL ES 3.00 by
   `pnpm gen:shaders`; the result lives in `shaders/wiggle.generated.ts`.
2. **Canvas 2D** fallback (`Canvas2DWiggleRenderer.ts`). Selected by
   `WiggleRenderer.ts` via `initDualBackend` when no GPU context is available.

When changing rendering behavior (colors, whisker contrast, draw order, scale
logic), apply the same change to the Slang shader and the Canvas 2D fallback,
then regenerate the shader artifacts. The SVG export path in `renderSvg.tsx`
must also stay consistent.
