# Slang shader migration — next steps

Context: [ADR-005](architecture-decision-records/adr-005-shader-codegen-slang.md).
Current state of the migration, what's left, and the pattern to follow.

## Done (on `webgl-poc`)

- Build tooling: `scripts/install-slangc.sh`, `scripts/build-shaders.ts`,
  `scripts/shader-codegen/{codegen,vulkanGlslToWebgl2}.ts`, `pnpm gen:shaders`
  script.
- `WebGPUHal` grew a `vertexBuffer?: boolean` code path (uniform-only bind
  group layout, vertex.buffers in the pipeline, `setVertexBuffer` at draw).
  Storage-buffer passes continue to work unchanged.
- `colorBits.ts` gained `abgrRed/Green/Blue/Alpha` + `abgrToCssRgba` so the
  GPU's ABGR u32 layout has first-class CPU-side helpers.
- Four canvas-feature shaders migrated to `.slang` + `vertexBuffer: true`:
  `rect`, `line`, `chevron` (shares `lineInstance.slang` with line), `arrow`.
  All four now pack color as a single `u32` end-to-end — no more Uint8Array
  → float32×4 intermediate.
- **wiggle** migrated (`plugins/wiggle/src/shared/shaders/wiggle.slang`).
  One Slang entry point covers all four rendering modes (xyplot/density/
  line/scatter) branched on the `renderingType` uniform; the GpuWiggleRenderer
  reuses a single vertex buffer across PASS_FILL (triangle-list) and PASS_LINE
  (line-list). Color now packed as u32 ABGR in `interleaveInstances`. Instance
  stride dropped from 32 B → 24 B.
- **dotplot** migrated (`plugins/dotplot-view/src/DotplotDisplay/shaders/
  dotplot.slang`). Single line-segment pass; per-instance struct lost its
  three `_pad` fields (stride 32 B → 20 B) and the uniform block lost its
  `_pad` float. Colors were already u32 ABGR upstream so no TS color changes.
- **Codegen polish**: `scripts/shader-codegen/codegen.ts` now emits
  `Int32Array` views for `int` uniforms (previously corrupted via f32 view)
  and only declares typed-array locals actually used (kills unused-var lint
  errors on shaders whose uniform block has no uint/int fields).
- **hpmath consolidated**: `hpmath.slang` moved to
  `packages/core/src/gpu/shaders/`. `build-shaders.ts` passes that dir as a
  second `-I` by default so any `.slang` file can `import hpmath;` without a
  per-plugin copy.
- **`slangPass` helper extracted** to
  `packages/core/src/gpu/slangPass.ts`. Canvas, wiggle, dotplot, and hic all
  build `PassDescriptor`s through it. Supports `topology`, `blendState`,
  `textures`, `picking`, and buffer-sharing overrides.
- **hic** migrated (`plugins/hic/src/LinearHicDisplay/components/shaders/
  hic.slang`). First texture-using shader — uses Slang's combined
  `Sampler2D<float4>`; the codegen auto-discovers combined samplers from
  reflection and emits `TEXTURES: readonly TextureBinding[]` with the
  texture+sampler WebGPU binding indices and a `u_<name>` GL uniform name,
  which `slangPass` forwards into the pass descriptor. GLSL post-processor
  renames Slang's mangled `<name>_0` sampler identifier to `u_<name>` so
  the TS side never depends on Slang's name mangling. Instance stride
  16 B → 12 B (dropped the padding the old storage-buffer layout required).
- `WebGL2Hal.dispose()` no longer calls `WEBGL_lose_context.loseContext()`
  (it was driver-wide on Firefox and took out sibling live contexts).

## Remaining shaders to migrate

Grep for `var<storage` on the `webgl-poc` branch to get the current list.
Rough groupings, in suggested order:

### Tier A — single-shader pairs (simplest)

- ~~**wiggle**~~ — done on `webgl-poc`.
- ~~**dotplot**~~ — done on `webgl-poc`.
- ~~**hic**~~ — done on `webgl-poc` (first texture-using shader, pioneered
  the `Sampler2D` / auto-`TEXTURES` pipeline that the rest of Tier B will
  reuse).

### Tier B — shaders with textures

These use sampled 2D textures (e.g. color ramp lookups). Author with
Slang's combined `Sampler2D` type (not `Texture2D + SamplerState`) —
see ADR-005 §"Authoring conventions" for the gotcha:

- ~~**variant-matrix**~~ — done on `webgl-poc`.
- ~~**ld**~~ — done on `webgl-poc`. Two passes (`ldGenomic` for genomic-
  position cells, `ldUniform` for the triangular uniform-grid path) share
  one `ldUniforms.slang` module so a single UBO write covers both. The
  uniform-grid path uses `SV_InstanceID` — required adding a
  `gl_InstanceIndex - gl_BaseInstance → gl_InstanceID` rewrite in
  `vulkanGlslToWebgl2.ts` (mirror of the existing vertex-index rewrite).

### Tier C — multi-pass / complex

- ~~**variant** (multi-variant display)~~ — done on `webgl-poc`. Turned
  out to be single-pass (SDF triangles in the fragment shader on a
  bounding quad, not separate passes). Color packed u32 ABGR, stride
  32 B → 20 B. First Slang shader using `nointerpolation` for flat
  varyings (`sizePx`, `shapeType`) — works transparently via slangc.
- ~~**linear-synteny**~~ — done on `webgl-poc`. Fill + picking + edge
  passes share a `syntenyTypes.slang` module (Instance struct, Uniforms,
  `computeCorners`/`isCulled` helpers). Picking kept as a separate
  `.slang` file so the codegen emits a standalone WGSL/GLSL pair;
  `glslFragmentOverride` is no longer needed. Stride 64 B → 40 B
  (padding from the old storage-buffer layout was dead weight).
  Required adding a `{ a, b, c }` → `Struct(a, b, c)` rewrite in
  `vulkanGlslToWebgl2.ts` — slangc emits C-style initializers that
  are only legal in GLSL 4.20+, not GLSL ES 3.00.
- **multi-synteny**:
  `plugins/linear-comparative-view/src/MultiLGVSyntenyDisplay/components/
  multiSyntenyGpuShaders.ts`. Largest of the remaining set (~600 lines).
- **alignments**:
  `plugins/alignments/src/LinearAlignmentsDisplay/components/wgsl/{read,
  cigar,coverage,misc}Shaders.ts`. Most complex renderer — leave until
  last. The existing `hpWgsl.ts` / `hpGlsl.ts` modules can be deleted once
  all WebGL consumers migrate to `import hpmath;`.

### Compute shaders — WebGPU-only, keep storage buffers

- `plugins/variants/src/VariantRPC/ldComputeShader.ts`,
  `ldPhasedComputeShader.ts`. These **should not** migrate to vertex buffers
  — they're compute, not draw. But they *can* migrate to Slang authoring;
  set `//! targets: wgsl` so no GLSL is emitted. Follow the LD compute spike
  in the git history of `webgl-poc-genshaders` for shape.

## Migration checklist per shader

For each shader file pair (`*Shaders.ts` + `*GlslShaders.ts`):

1. Create `plugins/<plugin>/src/<path>/shaders/<name>.slang`. Author the
   vertex + fragment entry points (`vs_main`, `fs_main` — snake_case
   matches the HAL's hardcoded `entryPoint`).
2. Declare per-instance fields with `: ATTR0`, `: ATTR1`, … semantics.
3. Put the uniform block at `[[vk::binding(1, 0)]] ConstantBuffer<T>` —
   binding 1 is the shared slot across both HAL bind group layouts.
4. For color: declare `uint color : ATTR<N>` and unpack with `unpackRGBA(c)`
   (copy the helper from `rect.slang`). Pack on the CPU side using
   `cssColorToABGR` (already done at the feature layer in
   `collectRenderData`).
5. If sharing an instance struct with a sibling pass (like line+chevron),
   put the struct in a separate `<name>Instance.slang` module.
6. Run `pnpm gen:shaders`. This runs slangc + naga + glslangValidator and
   writes `<name>.generated.ts`.
7. In the plugin's `*Shaders.ts` / `*GlslShaders.ts`, replace the hand-
   authored strings with `export { WGSL_SOURCE as FOO_SHADER } from
   './shaders/<name>.generated.ts'` (and analogous `GLSL_VERTEX` /
   `GLSL_FRAGMENT`).
8. In the plugin's `Gpu*Renderer.ts`:
   - Import the generated module (`import * as fooShader from ...`).
   - Use the `slangPass()` helper (or inline equivalent) in the pass list
     — critically, set `vertexBuffer: true`.
   - Use `GL_ATTRIBUTES`, `INSTANCE_STRIDE_BYTES`, and
     `UNIFORM_OFFSET_F32` from the generated module (stop hand-maintaining
     them).
9. Update the TS interleave/pack function to use `FIELD_OFFSET_F32` /
   `FIELD_OFFSET_BYTES` constants instead of hand-coded offsets. Tests
   will fail at compile time if the shader's field set changed
   incompatibly.
10. If the upstream RPC worker still unpacks color into a byte array,
    flatten it to `Uint32Array` (one u32 per instance) and push the pack
    at the source — `collectRenderData` has examples for `rectColors`,
    `lineColors`, `arrowColors`.
11. Update test fixtures (search for old `new Uint8Array(N * 4)` color
    allocations).

## Known gotchas (from the canvas migration)

- **Slang mangles identifiers in GLSL output**. The post-processor
  renames UBO block `block_Uniforms_0` → `Uniforms`, vertex attributes
  `<structParam>_<field>_0` → `a_<field>`, and cross-stage varyings
  `entryPointParam_<vs>_<field>_0` / `<fragParam>_<field>_0` → `v_<field>`
  so WebGL2 links by name. All handled transparently by
  `scripts/shader-codegen/vulkanGlslToWebgl2.ts` given reflection-sourced
  rename hints.
- **Vulkan-GLSL dialect fixes** also happen in that post-processor —
  `#version 460` → `#version 300 es`, drop `GL_ARB_shader_draw_parameters`
  extension, rewrite `gl_VertexIndex - gl_BaseVertex` → `gl_VertexID`,
  etc. `glslangValidator` runs inside `pnpm gen:shaders` to catch any new
  dialect leaks before they get committed.
- **Slang's DCE drops unused vertex inputs from GLSL**. Line doesn't read
  `inst.direction`, so line's emitted GLSL has no `in float a_direction;`
  even though its buffer layout does (chevron reads it). The
  `glAttributeSync` test allows attributes-in-buffer-but-not-in-GLSL but
  catches the reverse.
- **Entry points must be `vs_main` / `fs_main`** (snake_case) because the
  HAL hardcodes those names. Slang's default camelCase (`vsMain`) causes
  WebGPU pipeline validation to fail silently.
- **Vertex buffer stride** can be any multiple of 4 — the old 16-byte
  alignment check was for WGSL storage buffers (WebGPU minBindingSize),
  not vertex buffers. The HAL warning is now scoped to storage shaders
  only.

## Follow-up cleanups (after all shaders migrate)

- Delete `HP_WGSL_CORE` / `HP_GLSL_CORE` string templates in
  `packages/alignments-core/src/{hpWgsl,hpGlsl}.ts` — replaced by
  `import hpmath;` in every shader.
- Delete the storage-buffer code paths in `WebGPUHal`
  (`createStandardBindGroupLayout`, `createStandardBindGroup`,
  `createStorageBuffer`) once no pass uses `vertexBuffer: false`.
- Delete `PassDescriptor.vertexBuffer` flag itself (became the only path).
- Audit `PassDescriptor.glAttributes` for per-pass duplication that can
  collapse into the generated modules (several places still have
  per-attribute tables inline).
- Canvas2D renderers: audit `rgbaString(Uint8Array, i)` callers and
  migrate each color array upstream to `Uint32Array` — mirrors what the
  canvas plugin did for its rects/lines/arrows.

## Debugging tips (from the rect→arrow journey)

- Enable WebGL2 HAL verbose logging with `?webgl2-debug=1` in the URL, or
  `window.DEBUG = { webgl2: true }` in devtools before any GPU renderer
  initializes. Exposes attribute-location + first-draw GL errors.
- Lifecycle (init/dispose/context-LOST/restored) logs via `console.warn`
  always — they're cheap and the context-leak failure mode is hard to
  debug post-hoc.
- If a migrated shader renders blank in WebGPU with
  `"Location[0] ... is not provided by the previous stage outputs"`, the
  pass is missing `vertexBuffer: true` in its `PassDescriptor`.
- If WebGL2 silently renders nothing after a migration, run
  `glslangValidator -S vert <file>.vert.glsl` on the generated GLSL —
  some browsers fail silently on validation errors that glslang catches.
  Also check for missing `a_*` attributes via the debug mode above.
- If both WebGPU and WebGL show garbage colors, check byte order:
  `cssColorToABGR` produces `R=byte0, A=byte3`; `unpackRGBA` in the shader
  expects the same. If upstream code used `color-bits`' canonical layout
  (`R=byte3`), the shader output will be swizzled.
