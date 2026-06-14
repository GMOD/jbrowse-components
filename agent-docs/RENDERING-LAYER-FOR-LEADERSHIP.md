# The new rendering layer — leadership overview

> **Audience:** engineering leadership / reviewers deciding on the `webgl-poc`
> merge. Plain-language explainer of *what* the new rendering layer is, *why* it
> is shaped this way, and *how ready it is to ship*. Deep technical detail lives
> in `ARCHITECTURE.md` and the 30 ADRs; this doc is the map, not the territory.

---

## What changed, in one paragraph

JBrowse used to draw genomic tracks by asking a worker to render each screen
"block" into an image/SVG and stitching those together in the browser. We
replaced that with a **GPU pipeline**: workers fetch and lay out data as plain
numbers, and the browser paints it directly on the graphics card. The same code
path automatically falls back **WebGPU → WebGL2 → Canvas2D** depending on what
the user's browser supports, and SVG export still works (it reuses the Canvas2D
drawing code). Every existing track type works on every backend.

Why it matters: rendering happens at interactive frame rates on far larger
datasets, the rendering primitives are now a small reusable library instead of
being entangled with the rest of the app, and several display types that used to
be separate code (e.g. four alignments displays) collapsed into one.

---

## Where the code lives

The reusable rendering core was extracted into its own package,
**`@jbrowse/render-core`** (`packages/render-core`). This is the piece to look at
when evaluating the architecture — the old `packages/core/src/gpu` directory is
now mostly thin re-export "shims" pointing at it.

`render-core` deliberately depends on **only** MobX + our MobX-state-tree fork
(plus React as a peer). It does **not** depend on the rest of JBrowse core. That
direction is the whole point: a third party can build a GPU-accelerated track
that depends on this small leaf package without pulling in the entire
application. (ADR-030.)

It is a small, self-contained surface:

| Layer | What it does |
|---|---|
| **HAL** (hardware abstraction layer) | One interface, three implementations: WebGPU, WebGL2, and a mock for tests. The rest of the system never talks to a graphics API directly. |
| **Backend base classes** | Shared scaffolding for the two display shapes — *per-region* (most tracks) and *global/monolithic* (Hi-C, LD, matrices). Each has a GPU and a Canvas2D variant. |
| **Draw lifecycle** | An MST mixin + a React hook that own canvas setup, drawing, context-loss/device-loss recovery, page-navigation cleanup, and retry. Every display reuses this; none reimplements it. |
| **Upload helpers + geometry utilities** | Move data to the GPU efficiently (only re-upload what changed) and convert genomic coordinates to pixels consistently. |

Total: ~4,600 lines including tests, ~2,600 lines of source.

---

## The key design decisions (and why they're safe)

- **Backend-agnostic by default.** GPU vs Canvas2D is chosen per-display at
  startup behind one factory. Everything downstream — the lifecycle, the
  loading/error UI, SVG export — is identical regardless of backend. This is why
  the Canvas2D fallback is not a second-class path: it runs the same machinery.

- **Workers emit absolute genomic coordinates as plain integers.** No
  block-relative arithmetic crosses the worker boundary, which removes a whole
  class of off-by-one and stitching bugs that the old block system was prone to.

- **One source of truth for display state.** Loading, error, too-large, and
  render-error are computed in a single function with a fixed precedence, instead
  of each display re-deriving it. (ADR-026, `displayPhase.ts`.)

- **Renderers are stateless.** They hold no per-region caches; buffer lifecycle
  is delegated to the HAL. This makes context-loss recovery (the GPU
  occasionally drops everything) a clean "throw it away and re-upload" rather
  than a careful resync.

Every one of these has a written rationale (ADR) capturing the *why*, including
several "this looks wrong but is load-bearing — don't "fix" it" notes that
encode hard-won debugging lessons.

---

## Ship-readiness

**Build / test status of `render-core` (verified 2026-06-13):**

- ✅ 62/62 unit tests pass
- ✅ Clean typecheck (`tsgo --noEmit`, zero errors)
- ✅ No `any` types or type-casts; no `TODO`/`FIXME`/`HACK` markers
- ✅ HAL-parity test green (asserts WebGL and WebGPU stay behaviorally in sync)
- ✅ Public API is curated and explicitly marked `@experimental`

**Risk posture:**

- The API is labeled `@experimental` on purpose — we are not yet promising
  semver stability on these symbols. That is the right call for a freshly
  extracted surface and is documented for plugin authors (RFC-001 §7,
  `PLUGIN_ABI_STABILITY.md`).
- The legacy block-render path is **intentionally retained** (not deleted) so
  external plugins (`gdc`, `icgc`, `mafviewer`) keep working. It is no longer the
  default but remains public API. (See `ARCHITECTURE.md` "Legacy block stack.")

**Cleanup done before merge:** the two import/ergonomics items below were
completed (see `agent-docs/RENDERING-LAYER-HANDOFF.md`).

---

## Simplifications

1. **Import migration — DONE.** Every in-tree import now uses the canonical
   `@jbrowse/render-core` path; the ~13 old `@jbrowse/core/gpu/*` re-export shims
   were deleted (only `@jbrowse/core/gpu/passes`, the shader codegen, and the
   shared `.slang` modules remain there, by design). The shader codegen now emits
   `@jbrowse/render-core/hal` directly into generated files.

2. **`createRenderingBackend` signature — DONE.** Collapsed from five positional
   arguments to `createRenderingBackend(canvas, { passes, uniformByteSize,
   createGpuBackend, createCanvas2DBackend })`. The two same-shaped factory
   lambdas are now named, removing the swap-by-mistake hazard. `canvas` stays
   positional (the required subject, consistent with the sibling
   `createCanvas2DBackend(canvas, factory)` helper).

3. **Left as-is by design: the three upload helpers.** There are intentionally
   two per-region upload helpers plus a frame scaffold
   (`installPerRegionLifecycle` for per-key incremental uploads,
   `createRegionUploadSync` for whole-map reference-diffing, and the base-class
   `renderBlocks` scaffold). These look redundant but solve genuinely different
   MobX reactivity shapes and are each covered by tests + an ADR. Flagged so a
   future reviewer doesn't try to merge them — that would regress the
   optimization.

Net: the package is tight and the two cleanup items are landed.
