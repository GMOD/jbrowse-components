# Rendering-layer review + cleanup — handoff

**Date:** 2026-06-13 · **Branch:** `webgl-poc` · **Context:** pre-merge review of
the GPU rendering layer (`@jbrowse/render-core` + `packages/core/src/gpu`),
followed by two cleanups requested off the back of that review.

This is a working handoff: what was changed, why, how it was verified, and what a
reviewer should re-check. The leadership-facing overview is the sibling doc
`RENDERING-LAYER-FOR-LEADERSHIP.md`.

---

## Summary

1. **Reviewed** the rendering layer. The real engine lives in
   `@jbrowse/render-core` (a leaf package: deps `mobx` + the MST fork, `react`
   peer); `packages/core/src/gpu` had become mostly thin re-export shims. The
   package is well-factored and densely documented (30 ADRs + `ARCHITECTURE.md`).
2. **Retired the shims** — migrated every in-tree import to the canonical
   `@jbrowse/render-core` path and deleted the 13 shim files.
3. **Simplified `createRenderingBackend`** from 5 positional args to
   `(canvas, optionsObject)`.
4. **Wrote/updated docs** — new leadership overview, refreshed the three
   `CLAUDE.md`s and `ARCHITECTURE.md` to match the post-shim reality.

All green: typecheck, tests, lint (see Verification).

---

## Change 1 — shim retirement

**Before:** ~13 files in `packages/core/src/gpu/*` were one-line
`export * from '@jbrowse/render-core/X'` shims; ~220 imports went through the old
`@jbrowse/core/gpu/*` paths, ~53 through `@jbrowse/render-core`. Safe to delete
because `@jbrowse/core/gpu/*` is **new on this unmerged branch** — never in a
release, so there are no external consumers.

**What changed:**

- Shader codegen now emits `@jbrowse/render-core/hal` (was `@jbrowse/core/gpu/hal`)
  — `packages/shader-tools/src/shader-codegen/codegen.ts`. Ran `pnpm gen:shaders`
  to regenerate all ~34 `.generated.ts` files.
- Rewrote every in-tree import `@jbrowse/core/gpu/<X>` → `@jbrowse/render-core/<X>`
  for all subpaths **except `passes`** (which legitimately stays in core).
- Fixed the two internal references into the deleted shims:
  `packages/core/src/gpu/passes/index.ts` (slangPass) and the
  `glAttributeSync.test.ts` HAL import.
- **Deleted** the 13 shim files + the empty `hal/` dir. Kept in
  `packages/core/src/gpu`: `passes/`, `shaders/`, `glAttributeSync.test.ts`,
  `CLAUDE.md`.
- Added `"@jbrowse/render-core": "workspace:^"` to every package that now imports
  it (14 packages/plugins/products). Updated the pnpm lockfile.
- Removed the now-dead `./gpu/<X>` subpath entries from
  `packages/core/package.json` (`exports`, `publishConfig.exports`,
  `publishConfig.typesVersions`) — kept `./gpu/passes`.

**What deliberately stayed in `@jbrowse/core/gpu`:** the shared `passes/` GPU
pass library (exported as `@jbrowse/core/gpu/passes`), the shared `.slang`
modules (`shaders/`, the codegen's hardcoded `SHARED_INCLUDE`), and
`glAttributeSync.test.ts` (cross-plugin integration test that imports plugin
renderers, so it can't live in the leaf package).

## Change 2 — `createRenderingBackend` options object

**Before:** `createRenderingBackend(canvas, passes, uniformByteSize, createGpu, createCanvas2D)`
— two same-shaped `(x) => new Backend(x)` lambdas in positions 4/5, trivially
swappable by mistake.

**After:**

```ts
createRenderingBackend(canvas, {
  passes,
  uniformByteSize,
  createGpuBackend: hal => new GpuXRenderer(hal),
  createCanvas2DBackend: c => new Canvas2DXRenderer(c),
})
```

New exported type `RenderingBackendOptions<T>` (added to the barrel). Updated all
11 call sites.

**Design decision — `canvas` stays positional, not in the options bag.** It's the
required subject ("create a backend *for this canvas*"), and keeping it positional
matches the sibling helper `createCanvas2DBackend(canvas, factory)` and the
`useRenderingBackend(factory, model)` hook whose factory is `(canvas) => …`. The
options object is specifically the *configuration* (passes + uniform size + the
two factories). Trivial to flip if a reviewer prefers full uniformity — change
the signature in `packages/render-core/src/createRenderingBackend.ts` and the 11
call sites.

## Change 3 — docs

- **New:** `agent-docs/RENDERING-LAYER-FOR-LEADERSHIP.md` — plain-language
  "what/why/ship-readiness" overview (the existing `MERGE-SUMMARY.md` is a
  thorough but engineer-facing merge changelog).
- **Updated to post-shim reality:** `packages/core/src/gpu/CLAUDE.md`,
  `packages/render-core/CLAUDE.md`, `packages/shader-tools/CLAUDE.md`,
  `agent-docs/ARCHITECTURE.md` (shim description + stale `@jbrowse/core/gpu/*`
  path references → `@jbrowse/render-core/*`).
- **Left as historical record (not edited):** the ADRs and
  `RFC-001-community-plugin-api.md` (explicitly marked historical).

---

## Verification (all green as of handoff)

- `pnpm test packages/render-core packages/core/src/gpu plugins/wiggle/src/shared …`
  → **350 tests / 19 suites pass** (includes the cross-plugin HAL-parity
  `glAttributeSync.test.ts`).
- `npx tsgo --noEmit` clean in: `packages/render-core`, `packages/core`,
  `packages/wiggle-core`, `packages/shader-tools`, and all consumer plugins
  (alignments, wiggle, canvas, gwas, hic, maf, variants, dotplot-view,
  linear-comparative-view, sequence, linear-genome-view).
- `eslint --cache --fix` clean across all 131 changed source files.
- Scope: ~199 files (most are the one-line import change in `.generated.ts` +
  migrated imports; plus 13 deletions, 16 `package.json` dep additions, the
  lockfile, and the call-site refactor).

## What a reviewer should re-check

- **Grep guard:** `grep -rn "from '@jbrowse/core/gpu/" plugins packages products
  | grep -v /esm/ | grep -v "gpu/passes'"` should return nothing. (The `/esm/`
  build artifacts still contain old strings until a rebuild regenerates them —
  they're gitignored, harmless.)
- **`pnpm gen:shaders && git diff --exit-code`** (CI's staleness check) should be
  clean — generated files were regenerated with the new import string.
- Confirm the `canvas`-positional decision above is acceptable, or ask for the
  flip.

## Not done / out of scope

- No runtime/visual smoke test in a browser (change is import-path + signature
  only; no rendering logic touched). A reviewer wanting belt-and-suspenders can
  load a GPU display and confirm it paints.
- The pre-existing uncommitted edit to `website/src/pages/demos.md` (present at
  session start) is unrelated and untouched.
- Nothing committed — all changes are in the working tree for review.
