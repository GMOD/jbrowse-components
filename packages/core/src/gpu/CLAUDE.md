# packages/core/src/gpu

**The GPU/Canvas2D rendering primitives moved to `@jbrowse/render-core`**
(`packages/render-core`) — the HAL, the draw-lifecycle mixin, the backend base
classes, the React backend hooks, and the clip/canvas/hp-math utilities. See
`packages/render-core/CLAUDE.md` for the file map and invariants.

What remains here:

- **Re-export shims** (`RenderLifecycleMixin.ts`, `renderBlock.ts`, `hal/index.ts`,
  …) — thin `export * from '@jbrowse/render-core/X'` files so the ~160 existing
  `@jbrowse/core/gpu/*` imports keep resolving. New code should import from
  `@jbrowse/render-core`. Don't add logic to a shim; if you need to change
  behavior, edit the source in render-core.
- `passes/` — shared "simple shape" GPU passes (arrow/chevron/line/rect) +
  their `.generated.ts` shaders. Stays near the shader-codegen pipeline.
- `shaders/` — shared cross-plugin `.slang` modules (`hpmath`, `colorPack`),
  referenced by `scripts/build-shaders.ts`'s `SHARED_INCLUDE`.
- `glAttributeSync.test.ts` — cross-plugin integration test (imports plugin
  renderers), so it can't live in the leaf render-core package.

Rationale for the split and the static-import-only policy: ADR-030.
