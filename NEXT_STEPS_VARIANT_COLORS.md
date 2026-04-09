# Variant Colors Fix — Status & Next Steps

## What was done

### Bug 1: Blank features after regionTooLarge (FIXED)
When the "too many features" banner appeared and then the user zoomed back in,
features would disappear. Root cause: the banner unmounts the canvas element,
destroying the GPU context. The `useGpuRenderer` hook didn't detect the canvas
DOM element changing.

**Fix**: `packages/core/src/util/useGpuRenderer.ts` — track the previous canvas
element via a ref and bump `contextVersion` when it changes, triggering
re-initialization.

### Bug 2: JEXL color expressions ignored (IN PROGRESS)
Tracks with `color1: "jexl:get(feature,'type')=='SNV'?'green':'purple'"` render
as goldenrod instead of green/purple.

**Root causes discovered**:
- `baseTrackConfig.ts` preProcessSnapshot silently strips the `renderer` block
  when the renderer type is unregistered (`CanvasFeatureRenderer` was deleted)
- The RPC `executeRenderFeatureData.ts` used a hardcoded `mockConfig` with
  `color1: 'goldenrod'` instead of the actual config

**Changes made** (all unit tests pass, needs e2e verification):

1. **`baseTrackConfig.ts`** — Instead of stripping unknown renderer blocks,
   promotes their properties to the display level. Also renames `height` →
   `featureHeight` to avoid collision with display track height.

2. **`LinearFeatureDisplay/configSchema.ts`** — Added all the old
   CanvasFeatureRenderer config slots directly as display-level settings:
   `color1`, `color2`, `color3`, `outline`, `featureHeight`, `displayMode`,
   `geneGlyphMode`, `subfeatureLabels`, `displayDirectionalChevrons`,
   `transcriptTypes`, `containerTypes`, `labels { name, nameColor, description,
   descriptionColor, fontSize }`.

3. **`renderConfig.ts`** — Enhanced `createCachedConfig` and `readCachedConfig`
   to support plain objects with JEXL string detection. No MST re-hydration
   needed in the worker — JEXL strings are evaluated directly via
   `stringToJexlExpression().eval()`.

4. **`executeRenderFeatureData.ts`** — Deleted the hardcoded `mockConfig` and
   manual `configContext` construction. Now calls
   `createRenderConfigContext(displayConfig)` which was previously dead code.

5. **`model.ts`** — Added `displayConfigSnapshot` view using
   `readConfObject(self.configuration)`. Updated `fetchFeaturesForRegion` to
   spread the full config snapshot with model overrides on top.

6. **All 8 glyph files** — Updated `'height'` → `'featureHeight'` in
   `readCachedConfig` calls.

## What still needs to be done

### E2E verification
Build (`pnpm --filter @jbrowse/web build`) and run the additional-tracks
browser test suite. The BED genes test was failing with
`TypeError: Cannot read properties of undefined (reading 'map')` — this needs
investigation. The error may come from the snapshot containing unexpected
structures from the `renderer` pluggable union slot.

Likely fix: the `readConfObject(self.configuration)` snapshot includes the
MST `renderer` slot which might contain non-plain-object values. May need to
destructure out `renderer` from the snapshot before passing to the RPC:
```ts
get displayConfigSnapshot() {
  const { renderer, ...rest } = readConfObject(self.configuration)
  return rest
}
```

### Update browser test snapshots
Once features render with correct colors, the snapshot PNGs need updating
(`--update` flag on the browser test runner).

### PileupComponent has same canvas unmount pattern
`plugins/alignments/src/LinearAlignmentsDisplay/components/PileupComponent.tsx`
has the same early-return for regionTooLarge that unmounts the canvas. The
`useGpuRenderer` fix handles this automatically, but verify it works.

### labelUtils.ts fragility
`plugins/canvas/src/RenderFeatureDataRPC/labelUtils.ts` calls
`readConfObject(config, ['labels', 'name'], { feature })` on potentially plain
objects. This returns the raw JEXL string instead of evaluating it. Currently
only affects the rare `isNested && !isTranscriptChild` path. Should be hardened
to handle plain objects.

### Other display types
The pattern (promote renderer config to display level, pass config snapshot to
RPC, evaluate JEXL in worker) should be considered for other display types
that use the old renderer config pattern.

## Files modified
```
packages/core/src/util/useGpuRenderer.ts
packages/core/src/pluggableElementTypes/models/baseTrackConfig.ts
plugins/canvas/src/LinearFeatureDisplay/configSchema.ts
plugins/canvas/src/LinearFeatureDisplay/configSchema.test.ts (new)
plugins/canvas/src/LinearFeatureDisplay/model.ts
plugins/canvas/src/LinearFeatureDisplay/components/GpuCanvasFeatureRenderer.ts
plugins/canvas/src/RenderFeatureDataRPC/executeRenderFeatureData.ts
plugins/canvas/src/RenderFeatureDataRPC/renderConfig.ts
plugins/canvas/src/RenderFeatureDataRPC/renderConfig.test.ts
plugins/canvas/src/RenderFeatureDataRPC/rpcTypes.ts
plugins/canvas/src/RenderFeatureDataRPC/glyphs/{box,cds,glyphUtils,matureProteinRegion,processed,repeatRegion,segments,subfeatures}.ts
```

## Test status
- 156 unit tests pass (15 suites in plugins/canvas/src/)
- E2E tests: variant_colors test passes, BED genes test needs fix (see above)
