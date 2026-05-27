## test speedups
  You were right that the import graph is the problem — but it's only ~⅓ of the cost.

  ┌──────────────────────┬─────────┬───────┐
  │       Variant        │ Modules │ Time  │
  ├──────────────────────┼─────────┼───────┤
  │ Pure noop test       │       1 │ 0.73s │
  ├──────────────────────┼─────────┼───────┤
  │ 5 plugins            │     381 │ 2.58s │
  ├──────────────────────┼─────────┼───────┤
  │ Current (30 plugins) │   1,512 │ 3.33s │
  ├──────────────────────┼─────────┼───────┤
  │ Real test (10 tests) │  1,512+ │ 11.3s │
  └──────────────────────┴─────────┴───────┘

  The math for a 2× warm-cache win:
  - Trim corePlugins to per-test minimum: saves ~0.7s/file → ~10% on heavy tests, ~25% on light tests
  - Share JBrowse mount across tests in same file: saves ~3–5s per heavy file
  - Combined: realistic path to ~1.6–1.8×. Honest 2× requires both.

  SWC / esbuild / Vitest: 0% local warm-cache help. Confirmed by profile (babel is 1.8% CPU on real
  tests).

  What I'd actually do, in order:
  1. Make getPluginManager() in util.tsx accept a plugin list (default = corePlugins). Migrate the
  lightest tests to pass [LinearGenomeView, Config, Menus, Sequence, DataManagement]. Quick win, low
  risk.
  2. Audit one heavy plugin barrel (e.g. linear-comparative-view/src/index.ts reaches 504 files) to
  see if non-lazy imports can become lazy() — would benefit all tests.
  3. Only then consider sharing mounts across tests — bigger refactor, harder to keep correct.

  If you want, I can do step 1 as a real PR (refactor util.tsx + convert ~5 light tests) and measure
  the suite delta.


## Autogen docs


 Two notes worth flagging:
  1. plugins/variants/src/shared/SharedVariantConfigSchema.ts has a #slot JSDoc on a
  ...sharedVariantConfigSlots spread; the new extractor honours it and emits a blank-named slot. The
  old code silently dropped it. Either remove that #slot JSDoc or push the per-slot JSDocs down to
  where the fields are actually declared.
  2. The README's instructions for the dummy-function workaround were rewritten to describe the actual
   JSDoc-adjacency rule.

## Canvas

### Skipped intentionally (decisions worth remembering)

- **Hoist `fetchFeaturesForRegion` / `applyFetchResults` out of the
  `.actions(self =>)` closure.** Would require typing `self` either as
  `Instance<typeof stateModelFactory>` (circular type ref) or as a structural
  type — reintroducing exactly the drift risk that `modelContract.ts` exists
  to prevent. Negative-value refactor.
- **Merge the three chained `.views(self =>)` blocks around
  `regionTooLarge`.** Would force sibling refs through `this.X`, violating
  the `self-over-this in views` memory.
- **`assemblyNames[0]!` non-null assertion** at `baseModel.ts:222` and
  `model.ts:238`. Config schema requires assemblyNames to be a non-empty
  array, so the `!` documents a real invariant.

### Anti-recommendations (do not do)

- Don't merge `interleaveRects/interleaveLines/interleaveArrows` in
  `interleaveBuffers.ts` into a parametric function — field-by-field
  correspondence with shader-generated offsets is the point
  (`feedback_complexity_not_loc.md`).
- Don't merge the three `if numXxx > 0` blocks in
  `GpuCanvasFeatureRenderer.uploadRegion`. Same reason.
- Don't split `packRenderArrays` into a parametric primitive packer. Same
  reason — the explicit per-primitive column list documents the GPU
  contract.
- Don't extract `getFeatureName` / `getFeatureDescription` further; they're
  already in `labelUtils.ts`.
