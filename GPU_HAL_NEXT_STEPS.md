# GPU HAL: Next Steps

## Completed

The GPU HAL has been implemented and proven across all four renderer types:

- **MultiSynteny** (5 passes): 1,148 → 268 lines (77% reduction)
- **Dotplot** (1 pass): 496 → 98 lines (80% reduction)
- **LinearSynteny** (3 passes + picking): 978 → 208 lines (79% reduction)
- **Alignments** (18 passes): 4,734 → 1,387 lines (71% reduction)

HAL infrastructure: ~1,000 lines in `packages/core/src/gpu/hal/`, reusable across all
renderers. Supports custom blend states, picking, scissor/viewport control, and
multiple primitive topologies (triangle-list, triangle-strip, line-list).

### Alignments migration details

The alignments plugin had two separate GPU backends (`WebGPUAlignmentsRenderer.ts`
at 1,588 lines, `WebGLRenderer.ts` at 2,141 lines) plus 4 WebGL sub-renderers
(~1,005 lines). These were unified into a single `GpuAlignmentsRenderer.ts`
(~1,321 lines) using the HAL.

HAL extensions added for this migration:
- `topology` field on PassDescriptor (triangle-strip for arcs, line-list for arc lines)
- `setScissor()`/`clearScissor()` for per-block viewport clipping
- `setViewport()`/`clearViewport()` for arcs area rendering

GLSL shaders were converted from named uniforms to UBO (Uniform Buffer Object)
accessors matching the WGSL `uf()/uu()/ui()` pattern. A pre-existing bug where
WGSL cigar/coverage shaders called undefined `flip_x()` was fixed by adding
`U_REVERSED` at uniform slot 23.

## Remaining Opportunities

### Shader sync tooling
With all renderers using the HAL, the `PassDescriptor` already captures the instance
layout in TypeScript. A test could verify that GLSL attribute declarations match the
`glAttributes` layout. This catches sync bugs at test time instead of runtime.

### Shader codegen (future)
The HAL makes shader codegen more tractable if revisited later. The `PassDescriptor`
contains both WGSL and GLSL sources. A codegen system would only need to generate the
GLSL side — the HAL handles everything else. The instance data transformation (the
hardest part of codegen) is now fully described by `glAttributes`, so the codegen
could use that metadata instead of parsing shader source.

### Uniform layout unification
The alignments and multi-synteny renderers use different uniform layouts.
Unifying them would enable deeper shader sharing (e.g., coverage/SNP/indicator
shaders could be literally the same between both renderers).

### Coverage shader sharing
The MultiLGVSyntenyDisplay and LinearAlignmentsDisplay both render coverage bars,
SNP coverage, and insertion indicators. With a unified uniform layout, these
passes could share the same WGSL/GLSL shader code via `@jbrowse/alignments-core`.
