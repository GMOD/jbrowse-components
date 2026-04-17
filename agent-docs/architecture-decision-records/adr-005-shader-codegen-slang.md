# ADR-005: Author shaders in Slang, cross-compile to WGSL/GLSL + generate TS layout

## Status

Accepted

## Context

We currently hand-write every shader twice — once in WGSL (`*Shaders.ts`) for
the WebGPU backend, once in GLSL ES 3.00 (`*GlslShaders.ts`) for the WebGL2
fallback — and hand-maintain a third parallel declaration in TypeScript for
the byte offsets and strides used to pack per-instance buffers
(`interleaveBuffers.ts`, `GlAttributeLayout[]` arrays in `PassDescriptor`).
There are ~16 shader sets across the canvas, wiggle, variants, synteny, HiC,
dotplot, graph, and LD plugins.

Three hand-maintained descriptions of the same struct is the source of
recurring pain:

- Byte-offset drift between the TS packer and the WGSL/GLSL struct produces
  silent browser crashes (no static analysis catches it).
- Adding a field means editing at least three files per shader (WGSL, GLSL,
  interleave, plus the GL attribute layout).
- Shader helpers (HP 64-bit math emulation) are duplicated in `hpWgsl.ts` and
  `hpGlsl.ts` as string templates.

We previously tried using naga to cross-compile WGSL → GLSL; it lowers
`var<storage, read>` to UBOs on the WebGL target, which exceeds WebGL's UBO
size limits for realistic instance counts. We also tried a "shader
generator" branch (`webgl-poc-genshaders`) that built the sources via string
concatenation; its output was malformed.

Spike results (`agent-docs/shader-codegen-spike/FINDINGS.md`) evaluated six
mature community approaches:

| Approach | Verdict |
| --- | --- |
| Tint WGSL→GLSL | Same storage-buffer-to-UBO problem as naga |
| Three.js TSL (node-graph DSL) | Production-quality dual output, but imposes a node-graph programming model |
| Babylon.js runtime Tint transpile | Ships a 2MB WASM to every user; runtime cost |
| [WESL](https://wesl-lang.dev/) (WGSL superset with imports) | Only emits WGSL; doesn't solve WebGL2 |
| [TypeGPU](https://docs.swmansion.com/TypeGPU/) (TS→WGSL at runtime) | WGSL only; runtime generation |
| [Slang](https://github.com/shader-slang/slang) (HLSL-flavored cross-platform shading language) | **Chosen** |

## Decision

Author all shaders in **Slang** (`.slang` files). A build-time step compiles
each `.slang` to:

1. `*.wgsl` — for WebGPU (validated with naga in CI)
2. `*.vert.glsl` + `*.frag.glsl` — for WebGL2, via Slang's GLSL target +
   `vulkanGlslToWebgl2.ts` post-processor (validated with glslangValidator in
   CI). Compute shaders skip this step.
3. `*.reflection.json` — Slang's reflection output (intermediate)
4. `*.generated.ts` — derived from reflection JSON. Contains:
   - `WGSL_SOURCE`, `GLSL_VERTEX`, `GLSL_FRAGMENT` shader string constants
   - `INSTANCE_STRIDE_BYTES`, `INSTANCE_STRIDE_F32`
   - `FIELD_OFFSET_BYTES`, `FIELD_OFFSET_F32` per-field offsets
   - `UNIFORMS_SIZE_BYTES`, `UniformOffsets`
   - TS interface types
   - `writeInstance(buf, i, inst)` typed packer
   - `GL_ATTRIBUTES: GlAttributeLayout[]` (matches `PassDescriptor` shape)

Generated files are committed. CI regenerates and fails the build if the
output differs (catches "forgot to run gen:shaders").

### Authoring conventions (dual-target vs. WGPU-only)

Shaders are tagged by which backend(s) they need. Conventions enforce what
Slang can successfully emit for each:

**Dual-target shaders** (WebGPU + WebGL2 fallback) — ~14 of the 16 existing
shaders, including all canvas feature glyphs, wiggle, dotplot, synteny, HiC,
variant glyphs:

- Per-instance data as vertex attributes: `: ATTR0`, `: ATTR1`, …
- Textures as `Sampler2D` (combined), **not** `Texture2D + SamplerState`
  (Slang emits Vulkan's separated-sampler pattern for the latter, which isn't
  WebGL2-compatible)
- No compute, no atomics, no `groupshared`
- No `StructuredBuffer` (WebGL2 has no SSBOs — WebGL2 is GLES 3.0, SSBOs are
  GLES 3.1+)

**WebGPU-only shaders** — LD compute, LD phased compute, future analytics:

- Full Slang language: `StructuredBuffer`, `RWStructuredBuffer`,
  `groupshared`, `Atomic<T>`, compute entry points
- Build step skips GLSL emission for these files

The split already matches implicit conventions in the codebase — the canvas
feature plugin already uses vertex attributes, LD compute already uses
storage buffers. Slang formalizes this.

### Vulkan-isms that require post-processing for WebGL2

Slang's `-target glsl` emits "GLSL (Vulkan)" — GLSL 4.60 with
Vulkan-specific extensions and intrinsics. The `vulkanGlslToWebgl2.ts`
post-processor handles the ten observed Vulkan-isms (documented in the file).
`slangc` version is pinned; if a new Vulkan-ism appears, `glslangValidator`
fails in CI before shipping.

### Build tooling

- `scripts/install-slangc.sh` — fetches slangc into `.cache/slangc/` (gitignored).
  Developers run this once when they first need to regenerate shaders.
  `pnpm install` does **not** fetch it (only contributors editing shaders
  need the binary; generated outputs are committed).
- `scripts/build-shaders.ts` — walks `**/*.slang`, invokes slangc + post-processor
  + codegen, writes `*.generated.ts` next to the source.
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
  `writeInstance` packer) for performance, but the offset constants they use
  are now derived from the shader struct rather than hand-maintained.
- `PassDescriptor.glAttributes` inline arrays → `GL_ATTRIBUTES` imported from
  `*.generated.ts`

If `*.slang` changes in a way that shifts byte offsets, `*.generated.ts`
changes, and `interleaveBuffers.ts` (which imports named field offsets like
`FIELD_OFFSET_F32.y`) either keeps working transparently or fails at tsc if
the field was renamed/removed. Stride drift is no longer expressible.

## Consequences

### Positive

- Shader bodies authored once; cross-compiled deterministically.
- Stride / UBO offset drift is impossible by construction — the TS packer and
  the shader struct are both derived from the same `.slang` file.
- Shared helpers (HP math) live in `hpmath.slang`, imported by other files,
  no more `HP_WGSL_CORE` / `HP_GLSL_CORE` duplication.
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
- Slang's WGSL output is marked "experimental" in their docs. naga validation
  in CI mitigates — if a regression appears, we catch it before release.
- Contributors editing shaders must learn Slang syntax (HLSL-flavored; not a
  steep curve — the spike ported two shaders in ~15 minutes each).
- Three authoring rules for dual-target shaders (use `ATTR` semantics, use
  `Sampler2D`, use `Atomic<T>`) are easy to forget. Document in the plugin's
  `AGENTS.md` and add a lint rule that flags `StructuredBuffer` / `Texture2D`
  in dual-target `.slang` files.

### Migration staging

1. **Infrastructure** (this ADR + initial commit): slangc fetch script,
   build-shaders script, committed `codegen.ts` + `vulkanGlslToWebgl2.ts`,
   `.cache/` gitignore entry, pnpm task.
2. **Canvas feature shaders**: `rect`, `line`, `chevron`, `arrow` — simplest,
   highest duplication, directly exercises the `PassDescriptor` integration.
3. **Remaining vertex shaders**: wiggle, dotplot, HiC, synteny (two), variant
   (three), LD, graph.
4. **Compute shaders**: LD compute, LD phased compute. WGSL-only, fastest.
5. **Cleanup**: delete `*Shaders.ts` / `*GlslShaders.ts` / `HP_*_CORE` once
   all shaders are migrated.

Each stage is its own PR and merges independently. Rollback of any stage is
a revert of that PR; the build infrastructure stays in place.

## Alternatives considered

- **naga-driven reflection against hand-written WGSL** (no authoring change):
  would deliver the stride-drift fix without adopting Slang. Rejected because
  it leaves the dual-body maintenance burden — the main motivation for this
  effort — unresolved.
- **Three.js TSL / node-graph DSL**: proven dual-output story, but imposes a
  node-graph programming model that's a large mental shift for a small team
  and conflicts with the explicit, imperative style of our existing shaders.
- **Runtime Tint/naga transpile** (Babylon.js approach): ships compiler bytes
  to every page load and keeps cross-compile failure modes in production.
  Prefer a build-time pipeline.
- **Write our own mini-compiler** (what `webgl-poc-genshaders` attempted):
  rejected; the previous attempt shipped malformed syntax and the work to get
  to parity with Slang is not repayable.

## References

- [Slang language](https://github.com/shader-slang/slang)
- [Slang WGSL target docs](http://shader-slang.org/slang/user-guide/wgsl-target-specific)
- [Bevy encase layout derivation](https://docs.rs/encase/) (inspired the TS
  codegen design)
- Spike artifacts: `agent-docs/shader-codegen-spike/`
