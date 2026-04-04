# CLAUDE.md

## GPU rendering (plugins/canvas, packages/core/src/gpu)

Shader uniforms `canvas_width`/`canvas_height` are CSS pixels. The HAL sets
the canvas backing store to `css * dpr`, so `N / canvas_width` in clip space =
`N` CSS pixels at any DPR. Do NOT manually scale by devicePixelRatio.

WebGPU uses 4x MSAA; WebGL2 uses `antialias: true`. Picking passes skip MSAA.

WGSL (`canvasShaders.ts`) and GLSL (`canvasGlslShaders.ts`) must stay in sync.
The Uniforms struct/UBO layout must match the byte offsets in
`GpuCanvasFeatureRenderer.ts`.
