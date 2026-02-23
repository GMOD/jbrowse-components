# LinearSyntenyDisplay

- WGSL shaders in `syntenyShaders.ts` are compiled to GLSL via the `compile-shaders` script. Generated GLSL output lives in `generated/index.ts`.
- `WebGLSyntenyRenderer.ts` imports and uses the generated GLSL.
- Shared constants between TypeScript exports and WGSL inline code are marked with `// SYNC:` comments in `syntenyShaders.ts`.
