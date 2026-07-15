# ADR-030: Extract `@jbrowse/render-core`; GPU rendering API is static-import-only

## Status

Accepted (2026-06). Sequel to [ADR-026](adr-026-displaychrome-layering-stays.md)
(the chrome-stack layering audit) and the GPU public-API refinement pass that
merged `useRenderer` into `useRenderingBackend`.

## Context

We want third-party plugins to build GPU/Canvas2D displays against a **stable,
documented surface that doesn't shift under their feet**. Two questions had to
be answered before that surface could exist:

1. **Where does the rendering code live?** It was a subdirectory of the
   kitchen-sink `@jbrowse/core` (`packages/core/src/gpu` + two hooks in
   `core/src/util`), exposed as ~14 deep per-file subpath exports
   (`@jbrowse/core/gpu/renderBlock`, …). Deep subpaths make the file layout
   *be* the API: any rename breaks consumers, and there's no public/internal
   signal.
2. **How do third parties consume it — runtime re-exports or static import?**
   JBrowse can expose modules to URL-loaded no-build plugins via the
   `ReExports`/`jbrequire` registry. That registry is a **frozen ABI**: a plugin
   loaded from a URL binds to the host's live copy, and we don't control its
   rebuild, so every exposed symbol is a perpetual compatibility obligation.

An audit confirmed `packages/core/src/gpu/**` is a true **leaf**: its only
non-self imports are `mobx` and `@jbrowse/mobx-state-tree` (the fork). It reaches
into nothing else in `@jbrowse/core`. So extraction is clean.

## Decision

### 1. Extract the leaf into `@jbrowse/render-core`

A new package `packages/render-core` owns the rendering primitives: the HAL
(WebGL2/WebGPU/mock), `RenderLifecycleMixin`, the per-region / global backend
base classes (`{Gpu,Canvas2D}{PerRegion,Global}RenderingBackend` +
`{Gpu,Canvas2D}RenderingBackendBase`), `installPerRegionLifecycle` /
`regionUploadSync`, `renderBlock` / `displayPhase`, the clip + Canvas2D geometry
utilities, `slangPass`, `gpuDevice`, and the React hooks (`useRenderingBackend`,
`useTabVisibilityRerender`). It depends only on `mobx` + `@jbrowse/mobx-state-tree`
(+ `react` peer) — **never on `@jbrowse/core`**. The dependency runs the other
way: `@jbrowse/core` and the LGV plugin consume render-core.

`src/index.ts` is the curated public barrel, marked `@experimental` until the
surface is frozen under semver. The package's `exports` map *is* the public API
contract — decoupled from file layout.

**What stays in `@jbrowse/core/gpu`:** the shared `passes/` and `shaders/` dirs
(the runtime simple-shape passes and the `.slang` codegen includes — the codegen
*logic* was unchanged by this extraction and was subsequently moved to its own
`@jbrowse/shader-tools` package), and `glAttributeSync.test.ts` (a cross-plugin
integration test that imports plugin renderers, so it can't live in a leaf
package).

**What stays in the LGV plugin** (not primitives — they depend on view/display
models): `MultiRegionDisplayMixin`, `GlobalDataDisplayMixin`, `DisplayChrome`.
Clean two-tier split: primitives (`render-core`) ← integration (`core` / LGV).

### 2. Backward-compat via shims, not a big-bang rewrite

The ~160 in-tree `@jbrowse/core/gpu/*` import sites were **not** rewritten. Each
old path is now a thin `export * from '@jbrowse/render-core/X'` shim, so existing
imports (and another in-flight branch's edits) keep resolving untouched. New
code should import `@jbrowse/render-core`; internal sites migrate opportunistically.
The shims are a migration aid, not a second public API.

### 3. The GPU rendering API is static-import-only — never in `ReExports`

GPU/Canvas2D displays are a **statically-built-plugin** capability. The render
API is deliberately kept out of the runtime `ReExports`/`jbrequire` registry.

- Static-import plugins pin a version, bundle against it, and rebuild on *their*
  schedule when we ship a breaking change. Semver + their rebuild is the
  insulation — **that** is the "won't shift under their feet" guarantee, not API
  permanence. It is exactly what lets us keep iterating.
- Runtime re-exports are a frozen ABI we'd owe forever — the opposite of what an
  experimental, perf-sensitive layer needs.
- The GPU path already implies a build step (the Slang → `gen:shaders`
  toolchain), so a "runtime no-build GPU plugin with custom shaders" isn't even
  coherent. The audience that writes a custom display can run a static build.

`ReExports` stays reserved for the high-level, years-stable extension points
(adapters, simple tracks, widgets) where the convenience earns the permanence.

### Documented on-ramp

The easy, stable path for third parties is a **Canvas2D-only display** via
`createCanvas2DBackend` — no shader, no codegen, same `RenderLifecycleMixin` /
`DisplayChrome` lifecycle. The GPU shader path is "advanced — requires the Slang
toolchain." `creating_gpu_display.md` should lead with the Canvas2D + static-build
on-ramp.

## Consequences

- `@jbrowse/render-core` is the unit a third-party GPU/Canvas2D display depends
  on and pins. Its `exports` + semver are the stability contract; `@experimental`
  marks the not-yet-frozen window.
- The extraction is behavior-neutral: whole-repo typecheck clean, all 256
  render-core + core/gpu tests green, `pnpm gen:shaders` produces no diff
  (pipeline untouched), consuming plugins pass through the shims.
- Future "why is rendering its own package / why can't my no-build plugin import
  it" questions land here.
- Follow-ups: migrate in-tree `@jbrowse/core/gpu/*` imports to `@jbrowse/render-core`
  and retire the shims; add an export-surface guard test in render-core; rewrite
  `creating_gpu_display.md` against the final import paths.
