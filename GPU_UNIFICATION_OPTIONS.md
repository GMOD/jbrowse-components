# GPU Backend Unification: Options Analysis

## Problem

The `webgl-poc-multisyn` branch maintains three rendering backends (WebGPU, WebGL2,
Canvas2D) with significant code duplication:

- **Shader duplication**: Every shader exists in two hand-maintained copies (GLSL 300
  es + WGSL) with `// SYNC` comments. Synteny has 5 shader pairs (~530 lines).
  Alignments has ~15 shader pairs across `shaders/*.ts` and `wgsl/*.ts`.

- **Renderer duplication**: `WebGLMultiSyntenyRenderer.ts` (605 lines) and
  `WebGPUMultiSyntenyRenderer.ts` (543 lines) are ~85% structurally identical. The
  alignments plugin has the same problem at larger scale (~3,700 lines across two GPU
  renderers).

- **Canvas2D** is fundamentally different (immediate mode, tied to SVG export via
  SvgCanvas) and stays separate in all options.

## Background Research

### Semantic differences between WGSL and GLSL (not just syntax)

A detailed analysis of the codebase found several conceptual mismatches:

- **Instance data access model**: WGSL reads from storage buffer struct arrays
  (`instances[iid].field`). GLSL uses vertex attributes with divisors
  (`in uvec4 a_data0` + `vertexAttribIPointer`). This is a fundamentally different
  data binding model, not just different syntax.

- **Float-as-integer bit tricks (alignments only)**: GLSL encodes integers as floats
  and extracts bits via `mod(floor(x/64), 2) > 0.5`. WGSL uses proper
  `(u32 & 64u) != 0u`. Semantically equivalent but structurally different.

- **Uniform buffer alignment**: GLSL std140 and WGSL alignment rules differ for
  `vec3` types (std140 pads vec3 to 16 bytes). The synteny shaders dodge this by
  using only `f32` fields, but the alignments plugin's uniform model diverges more
  significantly (GLSL uses named uniforms; WGSL uses a flat `array<vec4u, 40>` with
  `uf()/uu()/ui()` accessor functions).

- **HP compiler guards**: The high-precision `dot()` and `max(-inf)` patterns must be
  preserved exactly. Any "simplification" by a transpiler breaks precision.

- **Synteny shaders are the clean case**: all `f32` uniforms, simple instance struct,
  no float-as-integer tricks. The alignments shaders are where semantic gaps get
  dangerous.

### Existing tools

No existing tool solves the WGSL-to-GLSL-300-es-with-vertex-attributes problem:

| Tool | Status |
|------|--------|
| **naga** (already tried) | GLSL output uses UBOs, not vertex attributes. No option to change. |
| **SPIRV-Cross** | Could work in 2-step pipeline (WGSL->SPIR-V->GLSL) with `flatten_ubo`. But no npm/WASM package — must build from C++ via Emscripten. Still wouldn't convert storage buffer access to vertex attributes. |
| **Google Tint** | Chrome's WGSL compiler has GLSL backend but deeply embedded in Dawn. Not extractable. |
| **TypeGPU** | WebGPU/WGSL only, no GLSL output. |
| **Three.js TSL** | Node-graph, deeply coupled to Three.js. Not standalone. |
| **luma.gl** (deck.gl) | Most comparable production system. They maintain both shader versions manually. No transpilation. |
| **wgsl_reflect** | Parser/reflection only, no codegen. |
| **shader-converter-wasm** | Wraps naga — same UBO problem. |

---

## Option A: GPU HAL Only

**Build a thin GPU Hardware Abstraction Layer to unify renderers. Keep maintaining
both shader versions manually (like luma.gl/deck.gl does).**

### What it does

Create interfaces in `packages/core/src/gpu/hal/` that abstract away the
WebGL2/WebGPU API differences at the draw-call level:

```
GpuHal interface:
  - uploadBuffer(regionKey, passId, data, count)
  - writeUniforms(data)
  - beginFrame(clearColor)
  - drawPass(passId, regionKey, instanceCount)
  - endFrame()
  - dispose()
```

Two implementations: `WebGL2Hal` and `WebGPUHal`. Each renderer plugin passes
`PassDescriptor` objects at construction time that describe the shaders, instance
layouts, and blend state for each rendering pass.

A single `GpuMultiSyntenyRenderer.ts` replaces both `WebGLMultiSyntenyRenderer.ts`
and `WebGPUMultiSyntenyRenderer.ts`.

### Impact on shader duplication

None. GLSL and WGSL shaders remain separate files maintained manually. The existing
`// SYNC` comments continue to be the coordination mechanism.

### Improved sync tooling

To make manual shader maintenance more reliable:

- Extract shared TypeScript constants for instance struct layouts (field names, byte
  offsets, strides) used by both the shader attribute declarations and the
  `InstanceBuilder` packing code
- Add a test that compiles both GLSL and WGSL versions and verifies they accept the
  same uniform/instance data
- Consider a lint rule or CI check that flags `// SYNC` comments where the referenced
  file has changed more recently

### Line count impact (synteny)

| Before | After |
|--------|-------|
| `WebGLMultiSyntenyRenderer.ts` (605 lines) | deleted |
| `WebGPUMultiSyntenyRenderer.ts` (543 lines) | deleted |
| — | `GpuMultiSyntenyRenderer.ts` (~300 lines) |
| — | `packages/core/src/gpu/hal/` (~500 lines, reusable) |
| Shader files | unchanged |
| **Renderer duplication: ~1,148 lines** | **~300 lines + 500 reusable infra** |

### Pros

- Lowest risk — no shader transformation, no semantic mismatch concerns
- Proven approach (luma.gl/deck.gl use this pattern in production)
- HAL is immediately reusable for the alignments plugin
- No new build step or codegen infrastructure
- Shader files remain as plain strings — IDE extensions and static analysis tools
  work without changes

### Cons

- Shader duplication remains (5 pairs for synteny, 15+ for alignments)
- Manual `// SYNC` discipline still required
- Every shader change requires updating two files

### Risk level: Low

---

## Option B: HAL + Targeted Codegen (Synteny Only)

**Build the GPU HAL (same as Option A), AND write a custom WGSL-subset-to-GLSL
transpiler that handles only the clean synteny-style shaders.**

### What it does

A new `packages/shader-codegen/` package containing a TypeScript-based transpiler:

- Custom recursive-descent parser for the WGSL subset used in synteny shaders
  (~400-500 lines)
- GLSL 300 es emitter with type inference for `let` declarations (~300-400 lines)
- CLI that runs at build time, reading `.wgsl.ts` source files and generating
  `.glsl.ts` output files
- Generated files are committed to git for IDE support and static analysis

The transpiler handles the synteny shader subset:

- Named-struct uniforms (`uniforms.field` -> `u.field`)
- Simple instance structs with `@pack` annotations for attribute grouping
- Standard control flow, arithmetic, built-in functions
- HP functions included as pre-resolved string fragments (not transpiled)

### What it does NOT handle (left as dual-maintained)

- Alignments shaders with flat-array uniform access (`uf()/uu()/ui()`)
- Float-as-integer bit manipulation tricks
- Complex instance struct packing (17-field ReadInst)
- Any shader that uses `bitcast<>`

### Instance data transformation

WGSL source declares instance structs with `@pack` annotation comments:

```wgsl
// @instance
// @pack a_data0: startBp, endBp, genomeRow, featureId
// @pack a_color: color
struct Instance {
  startBp: u32,
  endBp: u32,
  genomeRow: u32,
  featureId: u32,
  color: vec4f,
}
```

The codegen generates:
- GLSL `in` attribute declarations (`in uvec4 a_data0; in vec4 a_color;`)
- Rewrites `instances[iid].startBp` -> `a_data0.x`
- An attribute layout descriptor (TypeScript) that the HAL uses to configure VAOs

### Build integration

```json
{
  "scripts": {
    "shader:gen": "node --experimental-strip-types ../../packages/shader-codegen/src/cli.ts --input src/.../wgsl/ --output src/.../generated/",
    "shader:check": "node --experimental-strip-types ../../packages/shader-codegen/src/cli.ts --check ...",
    "prebuild": "pnpm shader:gen"
  }
}
```

Generated files are committed to git. CI runs `shader:check` to verify they're
up-to-date.

### Line count impact (synteny)

| Before | After |
|--------|-------|
| `WebGLMultiSyntenyRenderer.ts` (605 lines) | deleted |
| `WebGPUMultiSyntenyRenderer.ts` (543 lines) | deleted |
| `multiSyntenyGpuShaders.ts` ~530 lines (GLSL+WGSL) | 5 WGSL source files (~265 lines) + generated GLSL (auto) |
| — | `GpuMultiSyntenyRenderer.ts` (~300 lines) |
| — | `packages/core/src/gpu/hal/` (~500 lines, reusable) |
| — | `packages/shader-codegen/` (~1,200 lines, reusable) |
| **Hand-maintained: ~1,678 lines** | **~565 lines + ~1,700 lines reusable infra** |

### Pros

- Eliminates both renderer AND shader duplication for synteny
- Single source of truth for synteny shaders (WGSL)
- Generated GLSL files on disk for static analysis
- Codegen package is potentially extensible to more shaders over time
- HAL immediately reusable for alignments renderers

### Cons

- Significant upfront investment in transpiler (~1,200 lines of infrastructure)
- Transpiler only covers the synteny shader subset — alignments shaders remain
  dual-maintained
- Custom parser must be maintained as shader complexity grows
- Type inference for `let` declarations adds complexity
- New build step in the development workflow
- Risk of subtle codegen bugs producing incorrect GLSL

### Risk level: Medium

---

## Option C: HAL + SPIRV-Cross Pipeline

**Build the GPU HAL, AND invest in a naga -> SPIRV-Cross two-step shader compilation
pipeline (WGSL -> SPIR-V -> GLSL 300 ES).**

### What it does

Use two established shader compilers in sequence:

- **Step 1**: naga converts WGSL to SPIR-V binary (naga does this reliably)
- **Step 2**: SPIRV-Cross converts SPIR-V to GLSL 300 ES with `flatten_ubo` option

This requires compiling SPIRV-Cross (C++) to WASM via Emscripten and publishing it
as an internal package or vendored dependency.

### The vertex attribute problem

SPIRV-Cross's `flatten_ubo` can convert uniform blocks to plain uniforms, but
**storage buffer -> vertex attribute conversion is not a standard SPIRV-Cross
feature**. SPIR-V represents instance data as `StorageBuffer` decorated inputs.
SPIRV-Cross would output these as SSBOs in GLSL, not vertex attributes.

Possible workarounds:
- Post-process the GLSL output to rewrite SSBOs to vertex attributes (fragile)
- Use SPIRV-Cross's reflection API to extract the storage buffer layout, then
  generate attribute declarations separately and patch the shader
- Modify SPIRV-Cross source to add a "storage buffer to vertex attribute" option
  (significant C++ work)

### Build integration

The WASM binary would be ~2-3 MB. The codegen runs at build time:

```
WGSL source -> naga (WASM) -> SPIR-V -> SPIRV-Cross (WASM) -> GLSL 300 ES -> post-process -> .glsl.ts
```

### Pros

- Uses battle-tested shader compilers (naga + SPIRV-Cross)
- Could potentially handle ALL shaders (synteny + alignments) since SPIRV-Cross
  understands the full shader language
- SPIRV-Cross is extremely mature (used by MoltenVK, Unity, Godot)
- Future-proof: as WGSL evolves, naga and SPIRV-Cross will likely keep up

### Cons

- No existing npm WASM package for SPIRV-Cross — must build from C++ source
- The vertex attribute problem is not solved by SPIRV-Cross out of the box
- Two-step pipeline adds complexity and potential for subtle bugs
- WASM binaries add ~2-3 MB to dev dependencies
- Debugging shader compilation errors through two compilers is harder
- SPIRV-Cross GLSL output may need post-processing for WebGL2 compatibility
- Significant upfront investment with uncertain payoff on the vertex attribute issue

### Risk level: High

---

## Option D: HAL + Full Custom Codegen

**Build the GPU HAL AND a comprehensive custom transpiler targeting both synteny and
alignments shaders.**

### What it does

Extends Option B's transpiler to handle all shader patterns in the codebase:

- Named-struct uniforms (synteny style)
- Flat-array uniform access with `uf()/uu()/ui()` (alignments style)
- Complex instance structs (17-field ReadInst with mixed int/float types)
- Float-as-integer bit manipulation (`mod(floor(x/64), 2)` <-> `(u32 & 64u)`)
- `bitcast<f32>()` handling
- All 20+ shader pairs across synteny and alignments

### Additional transpiler complexity

Beyond Option B, the transpiler would need:

- **Dual uniform mode**: Support both named-struct and flat-array uniform patterns,
  with the ability to generate either GLSL named uniforms or GLSL UBO from WGSL
  indexed array access
- **Type coercion tracking**: Understand when a WGSL `u32` field should become a
  GLSL `float` attribute (for the float-as-integer pattern)
- **Bit operation translation**: Convert `(flags & 64u) != 0u` to
  `mod(floor(flags / 64.0), 2.0) > 0.5` for the GLSL output where flags is a float
  attribute
- **Per-shader configuration**: Each shader may need different packing rules,
  uniform modes, and type mappings

The transpiler grows from ~1,200 lines (Option B) to ~2,500-3,000 lines to handle
these additional patterns.

### Alternative: Normalize alignments first

Instead of making the transpiler handle both patterns, first refactor the alignments
shaders to use the same clean patterns as synteny:
- Convert from flat-array uniforms to named-struct UBO
- Convert from float-encoded integers to proper integer attributes
- Convert from `vertexAttribPointer` (float) to `vertexAttribIPointer` (integer) for
  integer fields

This is a significant refactor of the alignments plugin but would make all shaders
amenable to the simpler Option B transpiler. The refactor could be done incrementally.

### Line count impact (synteny + alignments)

| Before | After |
|--------|-------|
| Synteny renderers (~1,148 lines) | ~300 lines |
| Alignments renderers (~3,729 lines) | ~1,500-2,000 lines |
| All shader files (~2,500 lines GLSL+WGSL) | ~1,250 lines WGSL source + generated |
| — | `packages/shader-codegen/` (~2,500-3,000 lines) |
| — | `packages/core/src/gpu/hal/` (~500 lines) |
| **Hand-maintained: ~7,377 lines** | **~3,050-3,550 lines + ~3,000-3,500 infra** |

### Pros

- Complete elimination of shader duplication across the entire codebase
- Single source of truth for all shaders
- HAL eliminates all renderer duplication
- Maximum long-term maintainability

### Cons

- Largest upfront investment (~3,000+ lines of infrastructure)
- Transpiler complexity is high — handling float-as-integer patterns requires
  semantic understanding, not just syntax transformation
- Higher risk of subtle bugs in the more complex transformation paths
- The alignments uniform model (flat array with bitcast) is genuinely hard to
  transpile cleanly
- May be better to normalize the alignments shaders first (separate large refactor)
- Custom parser/emitter becomes a maintenance burden as shader patterns evolve

### Risk level: High

---

## Recommendation

**Option A (HAL only)** has the best risk/reward ratio. The GPU HAL eliminates the
renderer duplication (the larger source of bugs and maintenance burden) with low risk
and proven patterns. Shader duplication is annoying but manageable — the shaders
change less frequently than the renderer plumbing, and the `// SYNC` discipline has
worked so far.

**Option B (HAL + targeted codegen)** is reasonable if the shader sync burden becomes
a real problem after the HAL is in place. It could be pursued as a follow-up after
Option A is shipped and stable.

**Options C and D** carry significant risk for uncertain additional benefit. The
semantic gaps between WGSL and GLSL (especially for the alignments shaders) mean that
any transpiler — whether custom or based on SPIRV-Cross — will need substantial
special-casing.

---

## Option E: PixiJS-Style Unified Abstraction

**Model the HAL after PixiJS's architecture: unified resource classes (Shader,
Geometry, Buffer, State) with per-renderer backend data, and use vertex buffers
(not storage buffers) for instance data in WebGPU.**

### How PixiJS handles this

PixiJS (examined at ~/src/pixijs) supports WebGL2, WebGPU, and Canvas in production.
Key design decisions:

- **No shader transpilation.** Developers write separate GLSL and WGSL. Both are
  wrapped in a unified `Shader` class that holds `glProgram` + `gpuProgram`.

- **Vertex buffers for instance data in BOTH backends.** PixiJS does NOT use WebGPU
  storage buffers for instance data. Instead, it uses vertex buffers with
  `stepMode: 'instance'` in WebGPU (equivalent to `vertexAttribDivisor` in WebGL).
  This means the buffer layout and shader attribute access pattern are the same for
  both backends. The WGSL shaders use `@location(N)` vertex inputs, not
  `var<storage, read>`.

- **Unified resource classes with per-renderer GPU data.** Each shared resource
  (Buffer, Geometry, Shader) stores backend-specific data keyed by renderer UID:
  `buffer._gpuData[rendererUID]`. GPU data is created lazily on first use.

- **System composition.** Each renderer registers different "systems" (GlBufferSystem
  vs GpuBufferSystem, GlShaderSystem vs GpuShaderSystem, etc.) that know how to
  translate the unified abstractions to backend-specific API calls.

- **HighShader composition.** Complex shaders are built from reusable "bits" (header,
  main, end) with separate GLSL and WGSL templates. This is shader-level code sharing
  without transpilation — shared logic lives in TypeScript, shader bits are
  per-language.

- **Bind groups abstract uniforms.** A `BindGroup` wraps textures, buffers, and
  uniform groups. WebGPU translates these to `GPUBindGroup`; WebGL translates them
  to individual `glUniform*` calls.

### What this means for JBrowse

The key insight is the **vertex buffer decision**. Currently JBrowse's WebGPU shaders
use storage buffers (`var<storage, read> instances: array<Instance>`) while WebGL
uses vertex attributes (`in uvec4 a_data0`). This is the root cause of the shader
divergence — the data access model is fundamentally different.

If JBrowse switched WebGPU to also use vertex buffers with `stepMode: 'instance'`
(like PixiJS does), then:

- WGSL shaders would use `@location(0) data0: vec4u` instead of storage buffer
  struct access
- The WGSL and GLSL shaders would be structurally much more similar
- The same packed buffer layout works for both backends
- The HAL only needs to abstract buffer creation/upload, not data access patterns

**Trade-off**: Storage buffers can be larger than vertex buffers (WebGPU's
`maxStorageBufferBindingSize` is typically 128MB+, while `maxVertexBufferArrayStride`
is 2048 bytes per vertex and `maxVertexAttributes` is 16). For genomic data with
millions of features, this could matter. However, the current shaders use instanced
drawing with relatively compact per-instance data (32 bytes for synteny, 68 bytes for
alignments reads), so vertex buffer limits are unlikely to be hit.

### What it does

- Build unified abstractions similar to PixiJS: `GpuBuffer`, `GpuGeometry`,
  `GpuShader`, `GpuState`, `GpuUniformGroup`
- Each abstraction stores per-backend data lazily
- Switch WebGPU instance data from storage buffers to vertex buffers
- WGSL shaders change from `var<storage, read>` struct access to `@location` vertex
  inputs
- GLSL shaders stay the same (already use vertex attributes)
- Both shader languages now have similar structure (both use vertex inputs)
- Shaders remain dual-maintained but the structural divergence is greatly reduced
- The HighShader-style composition could allow shared logic fragments

### Impact on shader similarity

Before (current):
```
WGSL: let inst = instances[iid];  let bp = inst.startBp;
GLSL: uint bp = a_data0.x;
```

After (vertex buffer approach):
```
WGSL: @location(0) data0: vec4u  ...  let bp = data0.x;
GLSL: in uvec4 a_data0;          ...  uint bp = a_data0.x;
```

The shader bodies become much more similar. The remaining differences are purely
syntactic (type names, variable declarations, entry point decorators) rather than
structural.

### Line count impact (synteny + alignments)

| Before | After |
|--------|-------|
| Synteny renderers (~1,148 lines) | ~300 lines (unified) |
| Alignments renderers (~3,729 lines) | ~1,500-2,000 lines (unified) |
| Shader files | Structurally simplified but still dual-maintained |
| — | `packages/core/src/gpu/hal/` (~600-800 lines, richer than Option A) |
| **Renderer duplication: ~4,877 lines** | **~1,800-2,300 lines + ~700 reusable infra** |

### Pros

- Proven in production (PixiJS serves millions of users)
- Eliminates the root cause of shader divergence (storage buffer vs vertex attribute)
- Makes future shader codegen much more tractable (differences become purely
  syntactic)
- Richer abstraction than Option A — unified resource lifecycle, lazy GPU data
- PixiJS's BindGroup pattern elegantly bridges WebGL's individual uniforms and
  WebGPU's bind groups
- Vertex buffer approach keeps both backends' data paths aligned

### Cons

- Requires changing existing WebGPU shaders from storage buffers to vertex inputs
- Richer abstraction is more code than the minimal HAL in Option A (~800 vs ~500)
- Vertex buffer size limits could theoretically matter for extremely dense data
  (unlikely given current instance sizes)
- Still dual-maintains shaders (though they're now much more similar)
- More upfront refactoring of existing WebGPU code

### Risk level: Low-Medium

### Future path to shader codegen

Because the shader bodies become structurally similar after the vertex buffer switch,
a targeted transpiler becomes much simpler — it only needs to handle syntactic
transforms (type names, declarations, entry points) without the storage-buffer-to-
attribute structural transformation. This could be added as a follow-up with much
lower risk than Options B-D.

---

## Updated Recommendation

**Option E (PixiJS-style)** is arguably the best approach if you want to eventually
address shader duplication too. It's slightly more work than Option A upfront (because
you refactor WebGPU shaders from storage buffers to vertex buffers), but it removes
the fundamental architectural divergence that makes all the codegen options hard.

**Option A (HAL only)** remains the lowest-risk choice if you want to get renderer
unification shipped quickly and defer the shader question entirely.

The key question is: **is switching WebGPU from storage buffers to vertex buffers
acceptable?** If yes, Option E is strongly preferred. If there are reasons to keep
storage buffers (e.g., future compute shader integration, buffer size concerns), then
Option A is the pragmatic choice.

## Decision matrix

| Criteria | A: HAL only | B: HAL + synteny codegen | C: HAL + SPIRV-Cross | D: HAL + full codegen | E: PixiJS-style |
|----------|-------------|--------------------------|----------------------|----------------------|-----------------|
| Risk | Low | Medium | High | High | Low-Medium |
| Renderer dedup | Yes | Yes | Yes | Yes | Yes |
| Shader dedup | No | Synteny only | Potentially all | All | No (but much easier later) |
| New infrastructure | ~500 lines | ~1,700 lines | ~500 + WASM build | ~3,500 lines | ~700-800 lines |
| External dependencies | None | None | SPIRV-Cross WASM | None | None |
| Maintenance burden | Low | Medium | Medium | High | Low |
| Alignments migration | HAL only | HAL only | HAL + shaders | HAL + shaders | HAL + shader simplification |
| Time to first value | Shortest | Medium | Longest | Long | Short-Medium |
| Shader similarity | Unchanged | Synteny unified | Potentially all | All unified | Greatly improved |
| Path to full codegen | Hard | Partial | Possible | Done | Easy (syntactic only) |
