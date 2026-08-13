---
status: Rejected
summary: "WebGL2 GLSL keeps coming from vulkanGlslToWebgl2.ts, not from -target spirv piped through SPIRV-Cross: the adapter absorbed fifteen new shaders in ninety days without one translation fix, and the WebGL-only bug it did have was a spec default SPIRV-Cross would have emitted too"
---

# ADR-061: WebGL2 GLSL comes from the regex adapter, not SPIRV-Cross

## Status

Rejected (2026-08). Extends [ADR-005](adr-005-shader-codegen-slang.md) (author
shaders in Slang, cross-compile to WGSL/GLSL). ADR-005 settled *that* the WebGL2
backend is generated; this settles *by what*, and is the decision of record for
the recurring "why is a regex post-processor in the compile path — shouldn't a
real compiler do this?" question.

## Context

`packages/shader-tools/src/build-shaders.ts` compiles each `.slang` to WGSL for
WebGPU and GLSL ES 3.00 for WebGL2. The second target is the awkward one.

**slangc compiles both backends; it just has no GLSL ES target.** Its profile
list runs `glsl_110` … `glsl_460` — desktop only, no `*_es` profile and no ES
capability (checked against the pinned 2026.5.2: `-profile glsl_300_es` is
`unknown profile`). So `-target glsl` yields Vulkan-flavoured desktop GLSL:
`#version 460`, `gl_VertexIndex` / `gl_BaseVertex`, `layout(binding=N)` on UBOs,
`layout(location=N)` on varyings, HLSL brace initializers.
`packages/shader-tools/src/shader-codegen/vulkanGlslToWebgl2.ts` is the 209-line
adapter down to ES 3.00.

That file is **not an alternative to using Slang for WebGL; it is the gap Slang
leaves.** A reader who mistakes it for a shortcut will look for the principled
option, and there is exactly one: `-target spirv` piped through **SPIRV-Cross**,
which has a genuine ESSL backend (`--es --version 300`) and would replace the
regexes with a compiler.

### What it would cost

A second auto-fetched, version-pinned binary in the build, plus a rework of
every name-mangling assumption downstream of the GLSL text: `assertVertexInputsMatch`
(`shader-codegen/assertVertexInputs.ts`), `renameMangled`
(`vulkanGlslToWebgl2.ts`), and the `a_<field>` / `v_<field>` convention the
generated `VERTEX_ATTRIBUTES` array and the WebGL HAL both depend on. SPIRV-Cross
mangles differently; none of that survives untouched.

### What it would buy, measured

The case for a compiler is that regexes are brittle and will break as shader
count grows. That prediction is now testable, and it did not happen:

- **`vulkanGlslToWebgl2.ts` has 6 commits in its entire history**, against a
  209-line source and a 175-line test. Three are not translation work at all
  (the extraction into `@jbrowse/shader-tools`, the codegen test suite, an
  eslint sweep); the rest are layout guards and build-time assertions.
- Over the same window the input surface grew hard: **50 `.slang` files, 15 of
  them added in the last 90 days**, across gwas, maf, variants, synteny,
  render-core, canvas, alignments, and an example plugin. Compute kernels
  (`ldCompute`, `ldPhasedCompute`) landed in that set too.

Fifteen new shaders through the adapter, zero mistranslation fixes.

### The one WebGL-only bug is evidence against the swap, not for it

`51d84384ec` fixed a real backend divergence: GLSL ES 3.00 predeclares
`precision lowp sampler2D` in both stages (§4.5.4), so sampled colors came back
at 2^-8 relative precision — the width of the 8-bit ramp being sampled — while
WGSL, which has no such notion, read the same texture at full precision. The fix
was to emit `precision highp sampler2D` for the three shaders that declare a
sampler.

That is a **spec default the emitted ES source has to opt out of**, not a
translation the adapter got wrong. SPIRV-Cross emits ES 3.00 too, inherits the
same predeclared default, and would have needed the same injection. The
failure class actually observed in this path is one the swap does not address.

### What holds the current output honest

`glslangValidator` (GLSL ES) and `naga` (WGSL) both run in the `Shaders` CI job
on every push, alongside `pnpm gen:shaders && git diff --exit-code` for
staleness and an untracked-artifact check. A regex that produces invalid ES
fails the build; it cannot reach a user's GPU.

## Decision

**Keep generating WebGL2 GLSL with `-target glsl` + `vulkanGlslToWebgl2.ts`. Do
not adopt SPIRV-Cross.**

Record it as the only real alternative, so the next reader weighs it once
instead of rediscovering that slangc has no ES profile.

## Consequences

- The compile path stays one auto-fetched binary (slangc), pinned, with two
  optional validators probed at build time.
- `a_<field>` / `v_<field>` naming and the `assertVertexInputsMatch` /
  `renameMangled` assumptions stay load-bearing. They are cheap to keep and
  expensive to port; that asymmetry is the decision.
- New `.slang` files are expected to pass through the adapter untouched, and
  have. A shader that *doesn't* — a Slang construct whose emitted desktop GLSL
  the regexes cannot lower — is the revisit trigger, and it will announce itself
  as a red `Shaders` job, not as a slow decay.
- A second trigger would be slangc gaining a real `*_es` profile, which deletes
  the adapter outright rather than replacing it. Worth re-checking on a slangc
  pin bump; `-profile glsl_300_es` returning something other than `unknown
  profile` is the whole test.
- Not a precedent for regex post-processing generally. It is tolerated here
  because the input is one pinned compiler's deterministic output, the result is
  validated by a real GLSL compiler in CI, and the alternative is a second
  toolchain — none of which is true of regexes over hand-written source.

## Related

- [ADR-005](adr-005-shader-codegen-slang.md) — why shaders are authored in Slang
  and cross-compiled at all.
- [reference/GPU_RENDERING.md](../reference/GPU_RENDERING.md) — the pass/UBO
  model and the generated-artifact rules around this path.
- [reference/SHADER_JS_CODEGEN.md](../reference/SHADER_JS_CODEGEN.md) — the third
  generated target (Canvas2D twins), settled by
  [ADR-051](adr-051-shader-js-codegen-is-scalar-only.md).
