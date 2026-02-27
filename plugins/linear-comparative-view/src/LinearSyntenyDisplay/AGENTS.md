# LinearSyntenyDisplay

- WGSL shaders live in `wgslShaders.ts`, GLSL ES 3.0 shaders live in
  `glslShaders.ts`. Both must be kept in sync manually.
- `WebGPUSyntenyRenderer.ts` uses the WGSL shaders, `WebGLSyntenyRenderer.ts`
  uses the GLSL shaders. Shared constants are exported from `wgslShaders.ts`.
- Constants marked with `// SYNC:` comments must stay in sync across both files.
