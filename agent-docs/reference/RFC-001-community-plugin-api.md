---
name: rfc-001-community-plugin-api
description: The 2026-07 community-plugin-API proposal reduced to what outlived it — the RFC-to-shipped name mapping, the non-goals that are still decisions, and the sections other docs cite by number. Read when a comment sends you to an RFC-001 section.
audience: internal
kind: spec
---

# RFC-001: Community plugin API for the WebGPU/WebGL2/Canvas2D era

**Status: historical proposal, largely superseded.** The mixin/lifecycle pass
and the legacy-renderer deletion landed; the Canvas2D-as-peer-path and the
shared shader-pass library did not.

**Section numbers are preserved from the original, gaps included.** Other docs
and source comments cite them by number (§15), so renumbering breaks references
nothing checks.

## As shipped (RFC name → adopted name)

| RFC | Adopted |
| --- | --- |
| `GpuRenderingBackendLifecycleSlotMixin` | `RenderLifecycleMixin` (in `packages/render-core/`) |
| `installGpuDisplay` | `attachRenderingBackend` |
| `stopGpuRenderingBackendLifecycle` | `stopRenderingBackend` |
| `useGpuModelLifecycle` | `useRenderingBackend` |
| `initDualRenderingBackend` | `createRenderingBackend` |

Canvas2D paths compose the same `attachRenderingBackend({ upload, render })`
shape as GPU, so `installCanvas2DDisplay` and `useCanvas2DModelLifecycle` were
never built.

## What is settled elsewhere

- Render lifecycle, HAL, upload patterns: [GPU_RENDERING.md](GPU_RENDERING.md).
- The ABI question §7 deferred: [PLUGIN_ABI_STABILITY.md](PLUGIN_ABI_STABILITY.md).
- The WebGL2 context ceiling: [GPU_CONTEXT_BUDGET.md](GPU_CONTEXT_BUDGET.md). It corrects §12b.
- Worker payloads being collect-then-return: [ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md) §"Worker payloads are collect-then-return" (§13b).

## 2. Non-goals that are still decisions

- **No glyph-registration / spec-grammar / DSL layer.** Simple rect/arrow/line
  cases are covered by the canvas plugin's config, and complex ones (Manhattan,
  methylation matrices) need the full mixin/RPC/render shape regardless. A
  registration API would lose per-feature batching, conditional paths and
  custom hit-testing.
- **No decoupling of MST from `bpPerPx` for animation.** See §13c.
- **No backwards compatibility for plugins built against the legacy API**
  (`linearWiggleDisplayModelFactory`, `FeatureRendererType`,
  `pluginManager.getPlugin().exports`). External plugins are few, and the trade
  was getting the API right once.
- **Non-LGV display types are out of scope.**

## 3a. Picking Canvas2D or GPU

GPU earns its keep above roughly 100K features per frame. Below that, Canvas2D
is simpler, spends no context budget ([GPU_CONTEXT_BUDGET.md](GPU_CONTEXT_BUDGET.md)),
and is the path SVG export reuses. Both are one path,
`attachRenderingBackend({ upload, render })`, with the backend deciding, not
the display type. The current display shape is in
[GPU_RENDERING.md](GPU_RENDERING.md) §"Adding a new GPU display type".

## 5b. Primitives, not a framework

A shader-pass library ships primitives, not a framework: each mark keeps its
varying part explicit rather than inheriting a generalized vertex-generation
helper. [ADR-040](../architecture-decision-records/adr-040-no-genome-quad-vertex-helper.md)
declines exactly that generalization. The `rect` / `line` / `arrow` / `chevron`
passes stay in `plugins/canvas/src/LinearBasicDisplay/passes/`, with no second
consumer.

## 7. API stability policy (deferred)

Cross-plugin coupling uses static imports plus esbuild `globalExternals`, and
`pluginManager.getPlugin('X').exports` is removed for new plugin code. The RFC
deferred semver, `api-extractor` and versioned mixins as premature.
[PLUGIN_ABI_STABILITY.md](PLUGIN_ABI_STABILITY.md) argues the deferral has a
cost: an unbounded, invisible runtime surface ossifies with or without a policy.

## 12b. HAL hardening

The context-cap figures here were guesses. The ceiling is 16 in Chrome and
Firefox alike; [GPU_CONTEXT_BUDGET.md](GPU_CONTEXT_BUDGET.md) owns the subject.

## 13a. Eventual WebGL2 retirement

Keep WebGL2 until the `vulkanGlslToWebgl2.ts` post-processor needs frequent
maintenance from Slang regressions, or WebGPU coverage on the genomics user
base (including non-HTTPS deployments and aging Linux/Mesa) exceeds ~97%. This
is one of two retire conditions on ARCHITECTURAL_LIMITS.md §"One WebGL2 context
per display canvas".

## 13b. Streaming worker→main render

Carried as a live limit in ARCHITECTURAL_LIMITS.md §"Worker payloads are
collect-then-return".

## 13c. 60fps zoom animation decoupled from MST commit

Three approaches were rejected: a volatile `pendingBpPerPx` with a debounced
commit, animating only the `bpRangeX`/`viewBp` uniform, and a discrete
fetch-level tile model with a continuous GPU transform. `bpPerPx` as the MST
single source of truth is load-bearing for the scalebar, gridlines, ruler, RPC
fetch invalidation and every React overlay. Perf work inside the invariant is
fine. **Decoupling needs its own ADR and an explicit go-ahead.**

## 15. Who cites this document

- `packages/render-core/src/createRenderingBackend.ts` → §3a
- [ADR-040](../architecture-decision-records/adr-040-no-genome-quad-vertex-helper.md) → §5, §5b
- [PLUGIN_ABI_STABILITY.md](PLUGIN_ABI_STABILITY.md) → §7
- [ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md) → §13a, §13b
- [GPU_CONTEXT_BUDGET.md](GPU_CONTEXT_BUDGET.md), [GPU_PORTABILITY.md](GPU_PORTABILITY.md) → §12b
