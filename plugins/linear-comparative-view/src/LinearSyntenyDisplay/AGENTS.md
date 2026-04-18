# LinearSyntenyDisplay

- Shaders are authored in Slang (`shaders/*.slang`). Each source file has a
  sibling `*.generated.ts` emitted by `pnpm gen:shaders` containing WGSL,
  GLSL-ES-300, uniform/instance byte offsets, and `GL_ATTRIBUTES`. Never edit
  the `.generated.ts` files by hand.
- Shared types (the per-instance vertex layout, the `Uniforms` cbuffer,
  `computeCorners` and `isCulled`) live in `shaders/syntenyTypes.slang`. Every
  shader imports from this module so layouts stay in sync.
- `GpuSyntenyRenderer.ts` wires the three passes (`fill`, `edge`, `picking`) via
  `slangPass()` from `@jbrowse/core/gpu/slangPass`. `INSTANCE_STRIDE_BYTES` and
  attribute layout come from the generated module — do not hand-maintain a
  parallel copy.
