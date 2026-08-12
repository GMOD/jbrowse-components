---
status: Accepted
summary: "Author shaders in Slang, cross-compile to WGSL/GLSL + generate TS layout"
---

# ADR-005: Author shaders in Slang, cross-compile to WGSL/GLSL + generate TS layout

## Status

Accepted

## Context

### The surface-level pain

We currently hand-write every shader twice — once in WGSL (`*Shaders.ts`) for
the WebGPU backend, once in GLSL ES 3.00 (`*GlslShaders.ts`) for the WebGL2
fallback — and hand-maintain a third parallel declaration in TypeScript for the
byte offsets and strides used to pack per-instance buffers
(`interleaveBuffers.ts`, `GlAttributeLayout[]` arrays in `PassDescriptor`).
There are ~16 shader sets across the canvas, wiggle, variants, synteny, HiC,
dotplot and LD plugins.

### The underlying architectural issue

The hand-written shaders don't just duplicate source — they duplicate
**fundamentally different data-access patterns** because WebGPU and WebGL2
disagree on how a shader reads per-instance data:

- **WebGPU / WGSL** natively uses **storage buffers**:
  `@group(0) @binding(0) var<storage, read> instances : array<Inst>;` then
  `let inst = instances[iid];` in the vertex shader. Idiomatic, fast, unbounded
  instance count.
- **WebGL2 / GLSL ES 3.00** has **no SSBOs** (that's a GLES 3.1+ feature). The
  only options are vertex attributes (`in vec4 a_color;`) or UBOs (size-limited
  to ~16-64 KB per binding). Instance data must come in as vertex attributes
  with `vertexAttribDivisor(loc, 1)`.

Every existing dual-target shader pair resolves this split twice:

- The WGSL shader declares a `var<storage, read> instances` and indexes
  `instances[iid]`.
- The GLSL shader declares `in` vertex attributes and reads them directly.
- The HAL uploads the same raw byte buffer to both — as a `STORAGE` GPUBuffer on
  WebGPU, as an `ARRAY_BUFFER` VBO on WebGL2.
- The TS interleave function packs instance data with byte offsets that match
  the GLSL `in` attribute locations **and** the WGSL `var<storage>` std430
  layout. These two layouts happen to align for simple structs but there's no
  tooling enforcing it.

The duplication isn't cosmetic — it's a compile-time choice about data plumbing.
Any single-source authoring must pick _one_ pattern that works on both backends.

### Why naga's WGSL→GLSL fails

When naga lowers `var<storage, read> instances : array<T>` to GLSL ES 3.00, it
has no SSBO to target, so it emits a **UBO** containing the array. GLSL ES UBOs
have a minimum 16 KiB size limit across implementations and ~64 KiB is the
practical cap. A realistic feature render hits that limit at a few thousand
instances and WebGL silently truncates, or validation fails. That's why
naga-as-compiler didn't work for us.

### The only viable unifying pattern

Vertex attributes are the intersection: WebGPU supports them cleanly (declare
`buffers:` on the pipeline), WebGL2 requires them. If we author shaders with
vertex-attribute inputs — `@location(N) field : T` in WGSL, `in T a_field;` in
GLSL — the **same data pattern** works on both backends, and the TS side packs
one byte layout that both consume.

Three hand-maintained descriptions of the same struct is the source of recurring
pain:

- Byte-offset drift between the TS packer and the WGSL/GLSL struct produces
  silent browser crashes (no static analysis catches it).
- Adding a field means editing at least three files per shader (WGSL, GLSL,
  interleave, plus the GL attribute layout).
- Shader helpers (HP 64-bit math emulation) are duplicated in `hpWgsl.ts` and
  `hpGlsl.ts` as string templates.

We previously tried using naga to cross-compile WGSL → GLSL; it lowers
`var<storage, read>` to UBOs on the WebGL target, which exceeds WebGL's UBO size
limits for realistic instance counts. We also tried a "shader generator" branch
(`webgl-poc-genshaders`) that built the sources via string concatenation; its
output was malformed.

Spike results (the `shader-codegen-spike` branch, since removed) evaluated six
mature community approaches:

| Approach                                                                                       | Verdict                                                                    |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Tint WGSL→GLSL                                                                                 | Same storage-buffer-to-UBO problem as naga                                 |
| Three.js TSL (node-graph DSL)                                                                  | Production-quality dual output, but imposes a node-graph programming model |
| Babylon.js runtime Tint transpile                                                              | Ships a 2MB WASM to every user; runtime cost                               |
| [WESL](https://wesl-lang.dev/) (WGSL superset with imports)                                    | Only emits WGSL; doesn't solve WebGL2                                      |
| [TypeGPU](https://docs.swmansion.com/TypeGPU/) (TS→WGSL at runtime)                            | WGSL only; runtime generation                                              |
| [Slang](https://github.com/shader-slang/slang) (HLSL-flavored cross-platform shading language) | **Chosen**                                                                 |

## Decision

**Unify both backends on the vertex-attribute instancing pattern, and author all
shaders in [Slang](https://github.com/shader-slang/slang) (`.slang` files).**
This has two prerequisites that must be implemented before any shader can be
migrated:

### Prerequisite A: HAL grows native vertex-buffer support (WebGPU side)

The current `WebGPUHal` hardcodes the storage-buffer pattern — `uploadBuffer`
creates a `GPUBuffer` with `STORAGE` usage, the bind group layout declares
`binding(0) = 'read-only-storage'`, pipelines have no `vertex.buffers:` entry.
This must become a per-pass choice. `PassDescriptor` grows a
`vertexBuffer?: boolean` flag; when set:

- `compilePipelines` declares
  `vertex.buffers: [{ arrayStride, stepMode: 'instance', attributes }]` from the
  pass's `glAttributes`, and uses a uniform-only bind group layout (no storage
  at binding 0).
- `uploadBuffer` creates a `GPUBuffer` with `VERTEX` usage and the uniform-only
  bind group.
- `drawPass` calls `pass.setVertexBuffer(0, regionBuf.dataBuffer)` before the
  draw call.

The WebGL2 HAL requires no changes — it already uses the vertex-attribute
pattern for every pass.

During the migration, the HAL keeps supporting storage-buffer passes
(`vertexBuffer: false`, the default) for any shader that hasn't migrated yet.
**The long-term goal is to standardize every shader on vertex buffers and delete
the storage-buffer HAL path entirely** — then only one instancing pattern
exists, the WebGPU and WebGL2 HALs operate on identical buffer uploads, and
there's no more "same data, two access styles" split anywhere in the codebase.
Named access to instance fields (`inst.color`) is preserved under vertex buffers
by declaring the inputs as an entry-point struct
(`fn vs_main(inst: RectInstance, ...)`).

### Prerequisite B: the shared uniform binding convention

Both layouts place the uniform at `@binding(1)` so the shader source is
identical regardless of which path it takes:

    @group(0) @binding(1) var<uniform> u : Uniforms;

Storage-buffer passes additionally have `@binding(0)` for the storage array.
Vertex-buffer passes leave `@binding(0)` unused.

### Then: author in Slang

A build-time step compiles each `.slang` to:

1. `*.wgsl` — for WebGPU (validated with naga in CI)
2. `*.vert.glsl` + `*.frag.glsl` — for WebGL2, via Slang's GLSL target +
   `vulkanGlslToWebgl2.ts` post-processor (validated with glslangValidator in
   CI). Compute shaders skip this step.
3. `*.reflection.json` — Slang's reflection output (intermediate)
4. `*.generated.ts` — derived from reflection JSON. Contains:
   - `WGSL_SOURCE`, `GLSL_VERTEX`, `GLSL_FRAGMENT` shader string constants
   - `INSTANCE_STRIDE_BYTES`, `INSTANCE_STRIDE_WORDS`
   - `INSTANCE_OFFSET_F32` / `_U32` / `_I32` per-field word offsets, split by
     the typed-array view the field's Slang type takes. (Was one flat
     `FIELD_OFFSET_F32` over every field, where `_F32` meant *words* rather than
     a view — so a packer chose the destination view by hand and could write a
     `uint` field through a Float32Array without complaint.)
   - `UNIFORMS_SIZE_BYTES`, `UniformOffsets`
   - TS interface types
   - `writeInstance(buf, i, inst)` typed packer
   - `GL_ATTRIBUTES: GlAttributeLayout[]` (matches `PassDescriptor` shape)
   - compute entry points only: `COMPUTE_ENTRY_POINT` and `WORKGROUP_SIZE_X`,
     read from the entry point's name and its `[numthreads(X, …)]`, so a TS
     dispatch count (`ceil(work / WORKGROUP_SIZE_X)`) can't drift from the
     workgroup the kernel declares. A compute shader emits no instance layout
     or `GL_ATTRIBUTES` — its `StructuredBuffer<T>` is a bound resource, not a
     per-instance vertex buffer the CPU packs.

Generated files are committed. CI regenerates and fails the build if the output
differs (catches "forgot to run gen:shaders").

### Authoring conventions (dual-target vs. WGPU-only)

Shaders are tagged by which backend(s) they need. Conventions enforce what Slang
can successfully emit for each:

**Dual-target shaders** (WebGPU + WebGL2 fallback) — ~14 of the 16 existing
shaders, including all canvas feature glyphs, wiggle, dotplot, synteny, HiC,
variant glyphs:

- Per-instance data as vertex attributes: `: ATTR0`, `: ATTR1`, …
- Uniform block at explicit `[[vk::binding(1, 0)]]` (so WebGPU bind group layout
  is uniform-only at binding 1 and `@binding(0)` is unused, matching the HAL's
  vertex-buffer pipeline layout).
- `PassDescriptor.vertexBuffer: true` to select the HAL's vertex-buffer path
  (see Prerequisite A).
- Textures as `Sampler2D` (combined), **not** `Texture2D + SamplerState` (Slang
  emits Vulkan's separated-sampler pattern for the latter, which isn't
  WebGL2-compatible).
- No compute, no atomics, no `groupshared`.
- No `StructuredBuffer` (WebGL2 has no SSBOs — WebGL2 is GLES 3.0, SSBOs are
  GLES 3.1+).

**WebGPU-only shaders** — LD compute, LD phased compute, future analytics:

- Full Slang language: `StructuredBuffer`, `RWStructuredBuffer`, `groupshared`,
  `Atomic<T>`, compute entry points
- Build step skips GLSL emission for these files

The split already matches implicit conventions in the codebase — the canvas
feature plugin already uses vertex attributes, LD compute already uses storage
buffers. Slang formalizes this.

### Vulkan-isms that require post-processing for WebGL2

Slang's `-target glsl` emits "GLSL (Vulkan)" — GLSL 4.60 with Vulkan-specific
extensions and intrinsics. The `vulkanGlslToWebgl2.ts` post-processor handles
the ten observed Vulkan-isms (documented in the file). `slangc` version is
pinned; if a new Vulkan-ism appears, `glslangValidator` fails in CI before
shipping.

### Build tooling

- `scripts/install-slangc.sh` — fetches slangc into `.cache/slangc/`
  (gitignored). Developers run this once when they first need to regenerate
  shaders. `pnpm install` does **not** fetch it (only contributors editing
  shaders need the binary; generated outputs are committed).
- `packages/shader-tools/src/build-shaders.ts` — walks `**/*.slang`, invokes slangc +
  post-processor
  - codegen, writes `*.generated.ts` next to the source.
- `pnpm gen:shaders` — convenience alias.
- CI runs `pnpm gen:shaders && git diff --exit-code` to catch stale outputs.

### What this replaces

For each migrated shader set:

- `*Shaders.ts` → deleted; imports in renderers pull `WGSL_SOURCE` from
  `*.generated.ts`
- `*GlslShaders.ts` → deleted; imports pull `GLSL_VERTEX` / `GLSL_FRAGMENT`
- `interleaveBuffers.ts` → rewritten. The hand-coded stride and field offsets
  are replaced with imports from the corresponding `*.generated.ts`. Loops
  continue to use the fast `u32[]` / `f32[]` path (not the per-instance
  `writeInstance` packer) for performance, but the offset constants they use are
  now derived from the shader struct rather than hand-maintained.
- `PassDescriptor.glAttributes` inline arrays → `GL_ATTRIBUTES` imported from
  `*.generated.ts`

If `*.slang` changes in a way that shifts byte offsets, `*.generated.ts`
changes, and `interleaveBuffers.ts` (which imports named field offsets like
`INSTANCE_OFFSET_F32.y`) either keeps working transparently or fails at tsc if
the field was renamed, removed, or changed type — a field that moves between the
f32 and u32 maps keeps its word offset and still stops compiling. Stride drift is
no longer expressible.

## Consequences

### Positive

- Shader bodies authored once; cross-compiled deterministically.
- Stride / UBO offset drift is impossible by construction — the TS packer and
  the shader struct are both derived from the same `.slang` file.
- Shared helpers (HP math) live in `hpmath.slang`, imported by other files, no
  more `HP_WGSL_CORE` / `HP_GLSL_CORE` duplication.
- Reflection JSON gives us a machine-readable description of every shader
  interface — enables future tooling (shader browser, debug overlays, etc.)
- The existing dual-backend `PassDescriptor` shape is unchanged; this is a
  per-shader migration, not an architectural rewrite.

### Negative

- New build dependency: `slangc` (~15MB static binary, one-shot download per
  contributor). Generated outputs are committed so CI and non-shader-touching
  contributors don't need it.
- Slang's GLSL output needs a post-processor. The current regex covers all
  observed Vulkan-isms; if Slang emits a new one, `glslangValidator` in CI
  catches it but a human has to extend the post-processor.
- Slang's WGSL output is marked "experimental" in their docs. naga validation in
  CI mitigates — if a regression appears, we catch it before release.
- Contributors editing shaders must learn Slang syntax (HLSL-flavored; not a
  steep curve — the spike ported two shaders in ~15 minutes each).
- Three authoring rules for dual-target shaders (use `ATTR` semantics, use
  `Sampler2D`, use `Atomic<T>`) are easy to forget. Document in the plugin's
  `AGENTS.md` and add a lint rule that flags `StructuredBuffer` / `Texture2D` in
  dual-target `.slang` files.

### Migration staging

All stages have landed; every shader in the repo is authored in Slang and there
are no hand-written WGSL/GLSL sources left.

1. **Tooling infrastructure** ✅: slangc fetch script, build-shaders script,
   committed `codegen.ts` + `vulkanGlslToWebgl2.ts`, `.cache/` gitignore entry,
   pnpm task.
2. **HAL vertex-buffer support** ✅: `WebGPUHal` drives vertex-attribute passes
   per Prerequisite A.
3. **Canvas feature shaders** ✅: `rect` first as the end-to-end proof, then
   `line`, `chevron`, `arrow`.
4. **Remaining vertex shaders** ✅: wiggle, dotplot, HiC, synteny, variant, LD.
5. **Compute shaders** ✅: `ldCompute` / `ldPhasedCompute` (`//! targets: wgsl`).
   These bind `StructuredBuffer`/`RWStructuredBuffer` and are dispatched
   directly against `getGpuDevice()` from the variant RPC — the HAL has no
   compute path, since one call site isn't enough to design an abstraction
   against. A second compute kernel is the trigger to add one.
6. **Cleanup** ✅: `*Shaders.ts` / `*GlslShaders.ts` / `HP_*_CORE` deleted.

Each stage was its own PR, independently revertable, with the build
infrastructure staying in place regardless.

### Lessons learned (from the rect-first spike)

- Attempting to migrate rect before stage 2 caused WebGPU pipeline validation
  failures ("Location[0] Uint32x2 is not provided by the previous stage
  outputs") — the HAL had no concept of vertex buffer layouts, so Slang's
  vertex-attribute WGSL was uninterpretable.
- Separately, `WEBGL_lose_context.loseContext()` called from
  `WebGL2Hal.dispose()` turned out to be effectively driver-wide on Firefox:
  disposing one HAL knocked out live sibling contexts too. Removed — the browser
  reclaims contexts on GC. **`getGraphicsCapabilities` kept the same call on its
  feature-detection context until 2026-08-12**, where it had the same effect
  (opening the About widget mid-session could blank live tracks) plus a console
  line users reported as a fault; see
  [GPU_CONTEXT_BUDGET.md](../reference/GPU_CONTEXT_BUDGET.md) §"The probe's own
  context".
- Slang entry-point names default to camelCase (`vsMain`), but the HAL hardcodes
  `vs_main` / `fs_main`. Authored `.slang` sources use the snake_case form to
  match.

### A guard that iterates over what it found is not a guard

Two holes of the same shape, both found by probing rather than by a failure, and
both silent per-backend rendering bugs — the exact class this ADR exists to
eliminate.

- **The GLSL rewrites were keyed on the mangling suffix `_0`.** slangc's
  disambiguating index counts declarations it has seen, so it is only usually
  zero. A miss is silent twice over: the WebGL2 shader keeps `inst_color_1`, so
  `getAttribLocation('a_color')` returns -1 and that one attribute reads a
  constant; and `assertVertexInputs` searches for `a_(\w+)` and compares only
  what it FOUND, so the declaration it should have flagged drops out of the
  comparison and the cross-check passes. Renames now match `_\d+` (field names
  are unique within a struct, so widening cannot alias two onto one) and refuse
  any `<prefix>_…_<n>` that survives. Note the first fix alone would not have
  been enough — the backstop is what makes a mangling shape nobody anticipated
  loud instead of quiet.
- **Tight packing is the vertex-attribute rule, and it was applied to storage
  buffers too.** `findInstanceStruct` supports instancing through a
  `StructuredBuffer<T>`, where std430 aligns a vec2 to 8 and a vec3/vec4 to 16
  — so `float2 a; float b; float2 c;` packs `c` at 12 and the GPU reads it at
  16. `assertVertexInputsMatch` cannot catch it *by construction*: such a shader
  declares no vertex inputs, so finding nothing is the correct answer and the
  check that keeps the model honest everywhere else is vacuous exactly here.
  Nothing in the tree instances that way today, so `instanceAttrs` refuses a
  std430-incompatible layout with the rule named rather than shipping an
  untested offset emitter for a case with no consumer.

The generalization worth keeping: **whenever a check is written as "for each
thing I parsed, assert X", ask what happens when the parse comes up short.**
`assertParsedSomething` was already added for the all-empty case; the partial
case needed its own answer, and the vacuous-by-construction case needed the
guard moved somewhere the check could actually reach.

## Alternatives considered

- **naga-driven reflection against hand-written WGSL** (no authoring change):
  would deliver the stride-drift fix without adopting Slang. Rejected because it
  leaves the dual-body maintenance burden — the main motivation for this effort
  — unresolved.
- **Three.js TSL / node-graph DSL**: proven dual-output story, but imposes a
  node-graph programming model that's a large mental shift for a small team and
  conflicts with the explicit, imperative style of our existing shaders.
- **Runtime Tint/naga transpile** (Babylon.js approach): ships compiler bytes to
  every page load and keeps cross-compile failure modes in production. Prefer a
  build-time pipeline.
- **Write our own mini-compiler** (what `webgl-poc-genshaders` attempted):
  rejected; the previous attempt shipped malformed syntax and the work to get to
  parity with Slang is not repayable.
- **A runtime "shader bits" abstraction over all three backends** (PixiJS-style
  composable fragments, a shared geometry description, one `forEachBlock()`
  render loop). Investigated 2026-03-26 on `webgl-poc` and rejected before this
  ADR: PixiJS needs composable bits because it remixes dozens of features, while
  we have a handful of fixed programs that are never remixed, so the split adds
  indirection with no compositional payoff. Also considered and rejected there:
  wgpu-to-WASM (~10 MB, buggy WebGL fallback), regl (WebGL only), luma.gl v9
  (portable API but still dual shaders, no Canvas2D), gpu.js (dead, GPGPU not
  drawing), and WebGPU Compatibility Mode (needs a secure context we can't
  require). That investigation's conclusion was "keep three backends, share only
  the HP math"; this ADR supersedes it by moving the duplication to build time
  instead, which shares the whole shader body rather than 50 lines of it.

### Why the backends resist a runtime abstraction

The structural differences the rejected abstraction had to paper over, and which
Slang instead absorbs at build time:

| Aspect          | WebGPU                        | WebGL2                         | Canvas2D               |
| --------------- | ----------------------------- | ------------------------------ | ---------------------- |
| Shader language | WGSL                          | GLSL ES 3.0                    | N/A                    |
| Instance data   | Storage buffers (interleaved) | Separate VBOs per attribute    | Plain TypedArrays      |
| Uniforms        | Dynamic offset UBO            | Individual `gl.uniform*` calls | N/A                    |
| Command model   | Command buffer recording      | Immediate-mode state machine   | Immediate-mode drawing |
| Line draw       | 6 verts (thin quad)           | 2 verts (`gl.LINES`)           | `ctx.stroke()`         |
| Colors          | f32 [0..1] in storage buffer  | Normalized UNSIGNED_BYTE       | `rgba()` strings       |
| MSAA            | 4x with resolve texture       | None                           | N/A                    |

Canvas2D is deliberately left out of the codegen for the same reason: it shares
no shader at all, only the geometry decisions upstream of one.

## References

- [Slang language](https://github.com/shader-slang/slang)
- [Slang WGSL target docs](http://shader-slang.org/slang/user-guide/wgsl-target-specific)
- [Bevy encase layout derivation](https://docs.rs/encase/) (inspired the TS
  codegen design)
