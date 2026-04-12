# CLAUDE.md

## Display rendering and RPC

All display types fetch data via RPC workers and render on the main thread. The
difference is where layout decisions happen:

- **Canvas plugin**: worker computes layout (feature heights, glyph selection,
  packing) so it needs config sent as a plain snapshot (`getConfSnapshot` +
  `readConfigValue`). Returns pre-computed geometry for GPU rendering.
- **Wiggle/alignments**: worker only fetches and bins data, returns raw arrays.
  Layout and rendering happen on the main thread because they need cross-region
  coordination — e.g. wiggle's autoscale aggregates scores across all visible
  chromosomes to compute a global Y-axis domain, alignments builds a global
  chain index across regions for linked-read highlighting.

## GPU rendering (plugins/canvas, packages/core/src/gpu)

Shader uniforms `canvas_width`/`canvas_height` are CSS pixels. The HAL sets the
canvas backing store to `css * dpr`, so `N / canvas_width` in clip space = `N`
CSS pixels at any DPR. Do NOT manually scale by devicePixelRatio.

WebGPU uses 4x MSAA; WebGL2 uses `antialias: true`. Picking passes skip MSAA.

WGSL (`canvasShaders.ts`) and GLSL (`canvasGlslShaders.ts`) must stay in sync.
The Uniforms struct/UBO layout must match the byte offsets in
`GpuCanvasFeatureRenderer.ts`.
