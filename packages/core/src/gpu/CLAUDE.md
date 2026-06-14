# packages/core/src/gpu

**The GPU/Canvas2D rendering primitives live in `@jbrowse/render-core`**
(`packages/render-core`) — the HAL, the draw-lifecycle mixin, the backend base
classes, the React backend hooks, and the clip/canvas/hp-math utilities. Import
those from `@jbrowse/render-core`. See `packages/render-core/CLAUDE.md` for the
file map and invariants.

The old `@jbrowse/core/gpu/*` re-export shims were **removed** once every
in-tree import moved to `@jbrowse/render-core` (the shim-retirement follow-up to
ADR-030). Don't re-add a shim here; import from render-core directly.

What remains in this directory:

- `passes/` — shared "simple shape" GPU passes (arrow/chevron/line/rect) + their
  `.generated.ts` shaders. Runtime code (imported by the canvas plugin) whose
  generated outputs the codegen writes here. Still exported as
  `@jbrowse/core/gpu/passes`. Its runtime deps (`slangPass`, the
  `PassDescriptor` type) import from `@jbrowse/render-core`.
- `shaders/` — shared cross-plugin `.slang` modules (`hpmath`, `colorPack`),
  hardcoded as `@jbrowse/shader-tools`'s `SHARED_INCLUDE` (moving them means
  updating that constant in `packages/shader-tools/src/build-shaders.ts`).
- `glAttributeSync.test.ts` — cross-plugin integration test (imports plugin
  renderers), so it can't live in the leaf render-core package.

Rationale for the split and the static-import-only policy: ADR-030.
