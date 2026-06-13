# Handoff: rip out the legacy server-side block render path

## Goal

On the `webgl-poc` branch the entire server-side rendering subsystem is gone
(zero `addRendererType` registrations anywhere; `SvgFeatureRenderer`,
`DivSequenceRenderer`, etc. no longer exist). The block-based `BaseLinearDisplay`
model and everything that drives it are therefore dead in-tree. User approved a
**full rip** (not staged). Keep all the GPU-stack pieces the other displays
import.

## Already committed on this branch (done)

- `5e73e3184b` refactor(BaseLinearDisplay): remove dead write-only mouse state
  (`subfeatureIdUnderMouse`/`setSubfeatureIdUnderMouse`,
  `mouseoverExtraInformation`/`setMouseoverExtraInformation`)
- `c2b1ddcf44` refactor(BaseLinearDisplay): undeprecate `renderingProps` mouse
  callbacks (replaced `@deprecated` tags with an explanatory comment)

These two are independent of the rip and can stay regardless.

## Key facts established (don't re-derive)

- **`LinearBareDisplay` is the ONLY composer of the `BaseLinearDisplay` model.**
  Every other display (canvas `LinearBasicDisplay`, wiggle, multi-wiggle, gwas
  manhattan, maf, multi-sample variants) composes `BaseDisplay` directly and only
  imports the *standalone mixins/components/configSchema* from the
  `BaseLinearDisplay` barrel — NOT the model.
- **`LinearBasicDisplay` (canvas) is GPU, not block-based.** It sets
  `DisplayMessageComponent`, so `BaseLinearDisplayComponent` never renders
  `<LinearBlocks>` for it.
- **`BaseLinearDisplayComponent` is still needed** — it's the registered
  `ReactComponent` for canvas/wiggle/multi-wiggle/gwas (and external gdc/icgc).
  But its `DisplayMessageComponent ? <DisplayMessageComponent/> : <LinearBlocks/>`
  else-branch is dead once `LinearBareDisplay` is gone (every survivor sets
  `DisplayMessageComponent`). Simplify it to always render `DisplayMessageComponent`.
- **External plugins (`~/src/jb2plugins`):** nothing we care about breaks *because
  of* this rip.
  - `quantseq` — already broken by the wiggle GPU rewrite (wiggle no longer
    exports `XYPlotRendererReactComponent` / `xyPlotRendererConfigSchema`);
    extends the wiggle base, not `BaseLinearDisplay`.
  - `hoot-gwas` — gwas-derived; gwas is vendored in-tree as GPU.
  - `gdc` + `icgc` — the only true block-path consumers (compose
    `BaseLinearDisplay`, render via `BaseLinearDisplayComponent`, `rendererTypeName`
    = configured renderer). Already non-functional (need the removed
    `SvgFeatureRenderer`). User: "rare, don't care." Deleting the model means these
    crash on plugin install (destructure `undefined` from `LGVPlugin.exports`) —
    acceptable per user.
  - `jbrowse-plugin-apollo` (`~/src/Apollo3/packages/jbrowse-plugin-apollo`) —
    **MUST keep working; vetted SAFE.** Imports only *types*
    (`LinearGenomeViewModel`/`LinearGenomeViewStateModel`) from the LGV barrel
    (all survive). Its three displays (`LinearApolloDisplay`,
    `LinearApolloReferenceSequenceDisplay`, `LinearApolloSixFrameDisplay`) compose
    core `BaseDisplay`, NOT `BaseLinearDisplay`. Registers its own `ApolloTrack`
    via `createBaseTrackModel`, NOT `BasicTrack`. Renders with self-contained
    canvas (`stateModel/rendering.ts`), not the server-side block/CoreRender path;
    references no removed renderer names. Nothing in the rip touches it.

## Deletion scope

### Delete whole files/dirs
- `plugins/linear-genome-view/src/LinearBareDisplay/` (entire dir)
- `plugins/linear-genome-view/src/BasicTrack/` (entire dir — exists only to host
  LinearBareDisplay; see test caveat below)
- `plugins/linear-genome-view/src/BaseLinearDisplay/model.ts`
- `plugins/linear-genome-view/src/BaseLinearDisplay/renderSvg.tsx`
  (only consumer is model.ts; the SVGLinearGenomeView reference is a comment only)
- `plugins/linear-genome-view/src/BaseLinearDisplay/models/serverSideRenderedBlock.ts`
- `plugins/linear-genome-view/src/BaseLinearDisplay/components/LinearBlocks.tsx`
- `plugins/linear-genome-view/src/BaseLinearDisplay/components/RenderedBlocks.tsx`
- `plugins/linear-genome-view/src/BaseLinearDisplay/components/ServerSideRenderedBlockContent.tsx`
- `plugins/linear-genome-view/src/BaseLinearDisplay/components/Block.tsx`
- Probably also dead after the above (verify each has no other importer first):
  `components/BlockErrorMessage.tsx`, `components/MaxHeightReachedIndicator.tsx`,
  `components/DisplayChrome.tsx`? — NO, DisplayChrome is exported and used widely,
  KEEP it. Check `MenuPage.tsx`, `DisplayRenderErrorOverlay.tsx`,
  `ServerSideRenderedBlockContent` helpers individually with grep.

### KEEP (GPU stack imports these — verify still exported from barrel)
`baseLinearDisplayConfigSchema` (models/configSchema.ts), `TrackHeightMixin`,
`FeatureDensityMixin` (../shared), `ConfigOverrideMixin` +
`migrateOldSettingSnapshots`, `MultiRegionDisplayMixin` +
`onDisplayedRegionsChange` + types, `GlobalDataDisplayMixin`,
`StaleViewportRescaleMixin`, `FetchMixin`, `computeRenderTransform` +
renderTransform types, `FloatingLegend` (+ `LegendItem` type — see below),
`SVGLegend`, `calculateSvgLegendWidth`, `DisplayLoadingOverlay`,
`DisplayErrorBar`, `DisplayChrome` (+ `ChromeModel`), `BaseLinearDisplayComponent`
(+ `BlockMsg`, `Tooltip` — confirm Tooltip consumers; likely safe to keep),
`drawCanvasImageData` (util.ts), `getDisplayStr` (../shared), `TooLargeMessage`,
and `types.ts` (`ExportSvgDisplayOptions`, `LayoutRecord` — both used widely
externally; KEEP types.ts).

## Edits to shared files (the fiddly part)

### `plugins/linear-genome-view/src/BaseLinearDisplay/index.ts`
- Remove `export { ... baseLinearDisplayConfigSchema }`? NO keep it.
- Remove the `BaseLinearDisplay` model export (line ~6) and
  `BaseLinearDisplayModel`/`BaseLinearDisplayStateModel` type exports (lines ~7-11).
- Remove `BlockModel` / `RenderedProps` type re-exports (from serverSideRenderedBlock.ts).
- `LegendItem` is currently exported `from './model.ts'`. model.ts just
  re-exports it from `./components/FloatingLegend.tsx`. Re-point the barrel to
  export `LegendItem` directly from `./components/FloatingLegend.tsx`.

### `plugins/linear-genome-view/src/index.ts`
- Remove `BaseLinearDisplay` from the `import { ... } from './BaseLinearDisplay/index.ts'`
  and from `exports = { ... }` (line 30) and the bottom `export { BaseLinearDisplay, ... }` (line 90).
  CAUTION: `exports.BaseLinearDisplay` is public ReExports API consumed by
  gdc/icgc — removing it is the intended breaking change (user OK'd).
- Remove `import LinearBareDisplayF` (line 15) + its `install()` call (line 59).
- Remove `import BasicTrackF` (line 12) + `BasicTrackF(pluginManager)` (line 57)
  IF deleting BasicTrack.
- Remove the `linearBareDisplay*Factory` re-exports (lines 85-88).
- Remove `BaseLinearDisplayModel`, `BlockModel`, `RenderedProps` from the type
  re-export block (lines 76-83); KEEP `ExportSvgDisplayOptions`, `LayoutRecord`,
  `LegendItem`.

### `plugins/linear-genome-view/src/BaseLinearDisplay/components/BaseLinearDisplay.tsx`
- Drop the `import LinearBlocks`. Replace the
  `{DisplayMessageComponent ? <DisplayMessageComponent/> : <LinearBlocks {...props}/>}`
  with just `<DisplayMessageComponent model={model} />`. Keep legend/tooltip/
  context-menu/MenuPage logic. The `DisplayMessageComponent ? ... : ...` guards on
  `onContextMenu`/`onMouseMove` can be simplified since it's now always defined —
  but confirm every consumer's `DisplayMessageComponent` getter is non-undefined.

### `plugins/linear-genome-view/src/BaseLinearDisplay/util.ts`
- After deleting model.ts: `fetchFeatureByIdRpc` and `findSubfeatureById` become
  unused here (canvas has its OWN `findSubfeatureById` in
  `LinearBasicDisplay/baseModelHelpers.ts`). `drawCanvasImageData` stays (exported,
  though only re-exported — verify a real consumer; if none, can drop too but
  low-priority). Trim dead funcs.

### `plugins/linear-genome-view/src/BaseLinearDisplay/CLAUDE.md`
- Heavily documents the fetch system (still valid: FetchMixin /
  MultiRegionDisplayMixin survive). Remove only the server-side-block-specific
  sections if any. Mostly stays.

## TEST CAVEAT (the main scope risk — decide first)

`BasicTrack` is used as a generic fixture in **~35 cases** across:
- `LinearGenomeView/index.test.ts` (many `type: 'BasicTrack'` track confs;
  one asserts `displays[0].type === 'LinearBareDisplay'` ~line 1470)
- `LinearGenomeView/components/LinearGenomeView.test.tsx` (several; note the
  "renders one track" ones are already `xtest` = skipped)
- `index.test.ts` line 17 imports `LinearBasicDisplayStateModelFactory` from
  `'../LinearBareDisplay/index.ts'` (misleading name — it's the bare factory) and
  registers a `BasicTrack` + that display on a stub PluginManager.
- external `jbrowse-plugin-multilevel-linear-view/src/.../model.test.ts` (ignore)

Options for the tests:
1. **Keep `BasicTrack` + a minimal non-server-side `LinearBareDisplay`** — defeats
   the purpose; reject.
2. **Delete both, migrate test fixtures to `FeatureTrack`** — but FeatureTrack's
   display is the GPU `LinearBasicDisplay` (canvas plugin). Check whether the test
   harness (`createTestSession` from `@jbrowse/web/testUtils`) registers canvas /
   FeatureTrack's display. The full web test session likely does; the stub
   `PluginManager` in `index.test.ts` does NOT (it hand-registers types).
3. **Delete LinearBareDisplay/BaseLinearDisplay model but KEEP `BasicTrack`** as a
   bare track type with no display registered, and rewrite the handful of tests
   that assert on `displays[0]`. Tracks with no matching display type just get an
   empty `displays` array.

Recommended: option 2/3 hybrid — delete `LinearBareDisplay` + model + block
components; for tests, switch generic `BasicTrack` fixtures to `FeatureTrack`
where the harness supports it, and fix `index.test.ts`'s hand-rolled registration
(it currently registers a `BasicTrack` + bare display on a stub manager — replace
with a trivial inline stub display or drop those assertions). Verify
`createTestSession` gives `FeatureTrack` a display before mass-swapping; if not,
register a minimal display in the test or keep assertions track-level only.

## Verification after each chunk
- `npx tsgo --noEmit 2>&1 | grep -iE "linear-genome-view|BaseLinearDisplay|LinearBareDisplay|BasicTrack"`
- `npx jest plugins/linear-genome-view` (and `plugins/canvas plugins/wiggle plugins/gwas`
  since they import the barrel)
- Repo-wide barrel import check:
  `grep -rn "BaseLinearDisplay\b" --include=*.ts --include=*.tsx plugins packages | grep -v "/BaseLinearDisplay/"`
  should only show survivors (mixins/component/configSchema), no `BaseLinearDisplay`
  model imports.

## Suggested commit sequence (even though "full rip", keep reviewable)
1. Delete `LinearBareDisplay/` + `BasicTrack/` + their registrations/exports;
   fix tests.
2. Delete `BaseLinearDisplay/model.ts` + `renderSvg.tsx` + `serverSideRenderedBlock.ts`
   + block components; fix barrel + `index.ts` exports; simplify
   `BaseLinearDisplayComponent`.
3. Trim `util.ts` dead funcs; update `CLAUDE.md`.
