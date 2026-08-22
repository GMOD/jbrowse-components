---
name: rfc-001-community-plugin-api
description: The 2026-07 community-plugin-API proposal, reduced to what outlived it — the RFC-to-shipped name mapping, the non-goals that are still decisions, and the six sections other docs and source comments cite by number (§3a, §5b, §7, §9, §12b, §13a-c). Read when doing plugin API design, or when a comment sends you to an RFC-001 section.
audience: internal
---

# RFC-001: Community plugin API for the WebGPU/WebGL2/Canvas2D era

**Status: historical proposal, largely superseded.** Written 2026-07 against the
GPU rearchitecture branch, when two external plugins (`jbrowse-plugin-gwas`,
`jbrowse-plugin-mafviewer`) had no path onto the new rendering stack. The
mixin/lifecycle pass and the legacy-renderer deletion both landed; the
Canvas2D-as-peer-path and the shared shader-pass library did not.

**Section numbers are preserved from the original, gaps included.** Six of them
are cited by number from other docs and from source comments (see §15), so
renumbering would break references that nothing checks. Everything not retained
below was either shipped, absorbed into a live doc, or is estimate/plan material
that `TODO.md` and git already own.

## As shipped (RFC name → adopted name)

| RFC | Adopted |
| --- | --- |
| `GpuRenderingBackendLifecycleSlotMixin` | `RenderLifecycleMixin` (no `Gpu` prefix; moved from `packages/core/src/gpu/` to `packages/render-core/`) |
| `installGpuDisplay` | `attachRenderingBackend` |
| `stopGpuRenderingBackendLifecycle` | `stopRenderingBackend` |
| `useGpuModelLifecycle` | `useRenderingBackend` |
| `initDualRenderingBackend` | `createRenderingBackend` |

The RFC's separate `installCanvas2DDisplay` / `useCanvas2DModelLifecycle` were
never built: Canvas2D paths compose the same
`attachRenderingBackend({ upload, render })` shape as GPU, which is the
first-class-peer goal reached by having one path rather than two.

## What is settled elsewhere now

- The render lifecycle, the HAL, and the upload patterns —
  [GPU_RENDERING.md](GPU_RENDERING.md).
- The ABI question the RFC deferred in §7 —
  [PLUGIN_ABI_STABILITY.md](PLUGIN_ABI_STABILITY.md), which is the
  problem-analysis doc §7 asked for.
- The WebGL2 context ceiling, measured —
  [GPU_CONTEXT_BUDGET.md](GPU_CONTEXT_BUDGET.md). It **corrects** §12b below.
- Worker payloads being collect-then-return —
  [ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md) §"Worker payloads are
  collect-then-return", which carries §13b with a status and a retire condition.

---

## 2. Non-goals that are still decisions

The goals are all either shipped or restated in the docs above. These four are
not recorded anywhere else, and each has been re-proposed at least once:

- **No glyph-registration / spec-grammar / DSL layer.** Unmotivated at both
  ends: the simple "BED-like rect/arrow/line" case is already covered by the
  canvas plugin's config (color, displayMode, gene-glyph-mode), and the complex
  case (Manhattan, methylation matrices) needs the full mixin/RPC/render shape
  regardless. A registration API would replace only the render-callback layer,
  lose per-feature batching, conditional paths and custom hit-testing, and add
  indirection that does not earn its keep.
- **No decoupling of MST from `bpPerPx` for animation.** See §13c.
- **No backwards compatibility for plugins built against the legacy API.** Old
  UMD plugins built against `linearWiggleDisplayModelFactory`,
  `FeatureRendererType` or `pluginManager.getPlugin().exports` break on upgrade.
  Accepted deliberately: there are very few external plugins, and the trade was
  getting the API right once. (What that costs in practice is the subject of
  PLUGIN_ABI_STABILITY.md.)
- **Non-LGV display types are out of scope.** Circular, dotplot-shape and custom
  views. The `CircularChordRendererType` hierarchy retired with the rest of the
  LGV-family legacy anyway (§9).

---

## 3. Target plugin shape

### 3a. Picking Canvas2D or GPU

The threshold, which is what the two citations of this section want: **GPU earns
its keep above roughly 100K features per frame.** Below that, Canvas2D is
simpler, has no context budget to spend ([GPU_CONTEXT_BUDGET.md](GPU_CONTEXT_BUDGET.md)),
and is the path SVG export reuses. A display whose data is always small should
not take a GPU context to draw it.

Both paths are peers: same MST shape, same RPC shape, same lifecycle. In the
shipped form that is literally one path — `attachRenderingBackend({ upload,
render })` — with the backend deciding, not the display type.

*(§3b–3d, the proposed MST/RPC/component boilerplate, are dropped. They were
written before the names settled and every one of them now reads wrong; the
current shape is in [GPU_RENDERING.md](GPU_RENDERING.md) §"Adding a new GPU
display type".)*

---

## 5. Shader-pass library

**Not built as specified, and the reason is worth keeping.** The proposal was to
promote `rect` / `line` / `arrow` / `chevron` passes into a shared cross-plugin
library. They still live in `plugins/canvas/src/LinearBasicDisplay/passes/`,
whose `index.ts` comment records that they were drafted for this and stayed put
until a second consumer appeared. One never has.

### 5b. Primitives, not a framework

The design rule that survived, and the one
[ADR-040](../architecture-decision-records/adr-040-no-genome-quad-vertex-helper.md)
cites twice: a pass library ships **primitives, not a framework**. Each mark
keeps its varying part explicit rather than inheriting a generalized
vertex-generation helper. ADR-040 is the worked example of declining exactly
that generalization.

---

## 7. API stability policy (deferred)

A formal stability policy was deferred until the new API settled across multiple
plugin migrations. The substantive decision was already made elsewhere in the
RFC: cross-plugin coupling uses static imports plus esbuild `globalExternals`,
and `pluginManager.getPlugin('X').exports` is removed for new plugin code.
Committing then to semver discipline, `api-extractor` tooling, or versioned
mixin coexistence (`MixinV1`/`V2`) would have been premature for a phase still
expecting large changes.

**This is the section PLUGIN_ABI_STABILITY.md was written against**, and it
argues the deferral has a cost the RFC did not price: an unbounded, invisible
runtime surface ossifies whether or not a policy exists. Read that doc, not this
paragraph, before acting.

---

## 9. Legacy renderer audit — done

All of it landed. `ServerSideRendererType`, `FeatureRendererType`,
`BoxRendererType` and `CircularChordRendererType` are deleted from
`packages/core/src/pluggableElementTypes/renderers/` (only `util/` remains),
arc and variants/LD migrated off them, and the `ReExports` entries went with
them. The one live reference is
`packages/core/src/pluggableElementTypes/index.ts`, whose comment points here.

The removed classes stay documented in
[HISTORICAL.md](HISTORICAL.md) §"The old block-based (server-side) rendering
system", which is where to read what they did and why the block path can still
be rebuilt as an external compat plugin.

---

## 12. Cross-cutting work

### 12b. HAL hardening

> **Superseded in part.** This section's context-cap figures were guesses.
> Measured 2026-08-05: the ceiling is **16 in Chrome**, on both a real GPU and
> SwiftShader. "Firefox around 16" is the figure that generalizes; **"Chrome
> around 8" is wrong.** Everything about what happens past the cap is in
> [GPU_CONTEXT_BUDGET.md](GPU_CONTEXT_BUDGET.md), which owns this subject.

The other three items, still open and still worth doing:

- **`writeUniforms` outside-frame contract** (`webgpuHal.ts`). Calls outside
  `beginFrame`/`endFrame` write to slot 0 directly via `device.queue.writeBuffer`.
  Consistent under careful reading — the inside-frame path resets `uniformSlot`
  in `beginFrame` — but fragile to mis-modify. Make outside-frame writes a hard
  error, or document the invariant and add a boundary test.
- **`Promise.all` → `Promise.allSettled` in `resolvePipelines`.** Parallel
  pipeline compilation reports the first error and masks the rest; when porting
  a shader you want them all at once. ~10 lines, aggregating into a
  `ShaderCompileError`.
- **`MAX_UNIFORM_SLOTS = 512` cap exhaustion test.** The cap is undocumented to
  the rest of the codebase and silently `console.error`s on overflow without
  preventing draw corruption. Drive a frame past it and assert clean failure.

---

## 13. Deferred / future directions

### 13a. Eventual WebGL2 retirement

Keep WebGL2 until either (a) the `vulkanGlslToWebgl2.ts` post-processor needs
frequent maintenance from Slang regressions, or (b) WebGPU coverage on the
genomics user base — academic/biomed, including non-HTTPS deployments and aging
Linux/Mesa stacks — exceeds ~97%. Neither is true today; estimate 3-5 years out.
The Slang investment does not depend on retiring WebGL2.

This is one of the two retire conditions on ARCHITECTURAL_LIMITS.md §"One WebGL2
context per display canvas"; the other, track-level mount/release, is the near
one.

### 13b. Streaming worker→main render

Now carried as a live limit with a retire condition in ARCHITECTURAL_LIMITS.md
§"Worker payloads are collect-then-return". Short version: workers collect a
whole typed-array payload and return it in one message, so peak memory is the
full payload rather than one feature at a time, which the retired streaming
`FeatureRendererType` path had. The unbuilt options are chunked typed-array
delivery or a streaming RPC primitive.

### 13c. 60fps zoom animation decoupled from MST commit

Three approaches were considered and all three rejected: a volatile
`pendingBpPerPx` driving uniforms during a gesture with a debounced MST commit;
animating only the `bpRangeX`/`viewBp` uniform during a gesture; and a discrete
fetch-level tile model with a continuous GPU transform between levels.

`bpPerPx`-as-MST-single-source-of-truth is load-bearing for the scalebar,
gridlines, ruler, RPC fetch invalidation and every react-rendered overlay, so
the cost of a wrong fix exceeds the cost of imperfect zoom feel. Perf work
*inside* the invariant is fine — cheaper writes, fewer downstream observers,
more aggressive debouncing. **Decoupling needs its own ADR and an explicit
go-ahead, not a casual refactor.**

---

## 15. Who cites this document

Kept so a section is not renumbered or deleted out from under a reference:

- `packages/render-core/src/createRenderingBackend.ts` → §3a
- `packages/core/src/pluggableElementTypes/index.ts` → §9
- `plugins/canvas/src/LinearBasicDisplay/passes/index.ts` → §5
- [ADR-040](../architecture-decision-records/adr-040-no-genome-quad-vertex-helper.md) → §5b (twice)
- [PLUGIN_ABI_STABILITY.md](PLUGIN_ABI_STABILITY.md) → §7 (three times)
- [ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md) → §13a, §13b
- [GPU_CONTEXT_BUDGET.md](GPU_CONTEXT_BUDGET.md) → §12b
- [GPU_RENDERING.md](GPU_RENDERING.md) → §3a
