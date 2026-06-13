# Handoff: server-side render path rip (LGV + core) — DONE, what's next

**Branch:** `webgl-poc`. **Pre-rip baseline:** `d673d7e390`. As of this handoff
the whole server-side rendering subsystem is gone from both `plugins/linear-genome-view`
and `packages/core`. `npx tsgo --noEmit` is clean (0 errors); the test suites for
core + alignments + wiggle + variants + linear-genome-view + gwas all pass
(~2522 tests).

## What was removed (commit by commit)

LGV layer:
- `4b89af33ec` — `LinearBareDisplay` + `BasicTrack` (the only block-model composer
  and its host track). LGV unit-test fixtures now use a minimal inline
  `BaseDisplay`+`TrackHeightMixin` stub.
- `8b1dacf9ff` — block `BaseLinearDisplay` model + block components (`LinearBlocks`,
  `RenderedBlocks`, `ServerSideRenderedBlockContent`, `Block`, `BlockErrorMessage`,
  `MaxHeightReachedIndicator`, `MenuPage`, `renderSvg`, `serverSideRenderedBlock`).
  `BaseLinearDisplayComponent` is now a thin GPU container.
- `d2e75b53c1` — dead `fetchFeatureByIdRpc`/`findSubfeatureById` in LGV `util.ts`.
- `547288e90f` — orphaned `SVGLegend` + `calculateSvgLegendWidth`.

Core layer:
- `3d1ef53b56` — `ServerSideRendererType`/`BoxRendererType`/`FeatureRendererType`/
  `LayoutSession`/`CircularChordRendererType`, the `CoreRender` + `CoreGetFeatureDetails`
  RPC methods (+ RpcRegistry/coreRpcMethods entries), `rpc/methods/util.ts`,
  `renderToAbstractCanvas`, and their ReExports entries. The live RPC base
  `RpcMethodTypeWithFiltersAndRenameRegions` was decoupled from the renderer-derived
  `RenderArgs` via a local structural type (compile-time only — no serialization change).
- `b2e1a507f4` — the renderer **registry**: `PluginManager.addRendererType/getRendererType/
  getRendererTypes/rendererTypes` + the `'renderer'` pluggable-element group, the dead
  `BaseDisplayModel.rendererType` getter, the `CoreFreeResources` renderer loop.
  `liftLegacyRendererConfig` lost its `knownRendererTypes` arg (always lifts now).

(`4df25613a2` regenerated an unrelated pre-existing stale variants snapshot.)

## What deliberately STAYS in core (do not remove)

- **`RendererType` base class + `RenderProps` type** (`renderers/RendererType.tsx`,
  still in ReExports) — `RenderProps` is live: `util/tracks.ts` `getParentRenderProps`,
  `BaseDisplayModel`, dotplot, and lgv all use it. `RendererType` is still in the
  `PluggableElementType` union (harmless; not actively registered).
- **`renderers/util/serializableFilterChain.ts`** — live, used by the RPC base.
- **`BaseDisplayModel.rendererTypeName` prop** — kept for snapshot back-compat
  (removing it risks old-session load errors); nothing reads it in-tree now.
- The generic extension surface: `addRpcMethod`, `addDisplayType`, `addTrackType`,
  `RpcMethodType` bases, `BaseDisplay`, `blockTypes`.

## Known-safe external plugins (vetted, do not break)

- **`jbrowse-plugin-apollo`** (`~/src/Apollo3`) — composes core `BaseDisplay`,
  registers its own `ApolloTrack`, renders its own canvas, type-only LGV imports.
  Unaffected by everything above. Must keep working.
- **gdc / icgc** (`~/src/jb2plugins`) — the accepted breakage. They consumed the
  block path via `LGVPlugin.exports.BaseLinearDisplay` (now removed). They crash on
  install; the compat plugin (below) is their migration path.

## The compat plugin (the main open follow-up)

`agent-docs/PLAN-legacy-server-side-compat-plugin.md` is the recovery plan for
rebuilding the server-side path as an **external** plugin. **Read its top "UPDATE
2026-06-13" section first** — it was originally written assuming core kept a
"frozen contract," which is no longer true. The compat plugin must now also
**vendor the core server-side infra** from SHA `547288e90f` (the commit before the
core rip), register `CoreRender`/`CoreGetFeatureDetails` via the surviving
`addRpcMethod`, and either have displays own their renderer directly or monkeypatch
a renderer registry back onto the PluginManager. Concrete-renderer recovery SHAs
(`SvgFeatureRenderer` `08d470db25`, `DivSequenceRenderer` `c602c269f8`) and the
LGV block-glue manifest are in that doc.

This plugin is **not yet built** — it's a documented recovery path, created so the
knowledge survives the deletion. Build it only if a real user needs gdc/icgc/
custom server-side renderers.

## Possible further cleanups (optional, low priority)

- `RendererType` is still in the `PluggableElementType` union in
  `pluggableElementTypes/index.ts` though `'renderer'` is no longer a registrable
  group. Harmless; removing it touches the generic element-type typing.
- `offscreenCanvasUtils.tsx` still exports `ReactRendering`/`renderingToSvg`; verify
  whether those are still live now that `renderToAbstractCanvas` is gone (they were
  part of the server-side raster/SVG path).
- `BaseDisplayModel.rendererTypeName` prop is now write-only/unread in-tree — could
  be dropped if a snapshot pre-processor strips it for back-compat first.

## Verify before merging

- `npx tsgo --noEmit` (expect 0)
- `pnpm test packages/core plugins/alignments plugins/wiggle plugins/variants plugins/linear-genome-view plugins/gwas`
- Smoke-test the actual app (GPU alignments/wiggle/variants/gwas render; feature
  click details still work via each plugin's own `GetFeatureDetails` RPC, NOT the
  removed `CoreGetFeatureDetails`).
