# Plan: external "legacy server-side rendering" compat plugin

**Audience:** a future agent (or human) tasked with restoring the block-based
server-side render path *after* the `webgl-poc` rip
(`HANDOFF-serverside-rip-complete.md`) has deleted it from the main tree.

**Why this doc exists:** the rip removes the last in-tree reference for how the
block path is wired. This captures the exact recovery sources, file manifest,
dependency contract, and registration shape **while they still exist in HEAD**,
so the compat plugin can be reconstructed without re-deriving anything.

**Anchor SHA (pre-block-rip HEAD):** `d673d7e390d5b40c3aa0782d064700421d3f7ffa`
— every file path below resolves at this SHA. Once the rip lands, recover via
`git show d673d7e390:<path>`.

---

## UPDATE 2026-06-13: the core server-side machinery has ALSO been ripped

The plan below was written assuming core kept its server-side rendering infra as
a "frozen contract." **That is no longer true.** A follow-up rip removed it from
core too (commits `3d1ef53b56` renderer classes + CoreRender RPC, `b2e1a507f4`
the renderer registry). So the compat plugin can no longer rely on `@jbrowse/core`
providing any of it. What's now GONE from core:

| Removed from core | was at |
|---|---|
| `ServerSideRendererType` (+test) | `pluggableElementTypes/renderers/ServerSideRendererType.ts` |
| `BoxRendererType`, `FeatureRendererType`, `LayoutSession`, `CircularChordRendererType` | `pluggableElementTypes/renderers/` |
| `CoreRender` + `CoreGetFeatureDetails` RPC methods | `rpc/methods/` (+ RpcRegistry + coreRpcMethods entries) |
| `rpc/methods/util.ts` (`RenderArgs`, `validateRendererType`) | — |
| `renderToAbstractCanvas` | `util/renderToAbstractCanvas.ts` |
| `PluginManager.addRendererType` / `getRendererType` / `getRendererTypes` / `rendererTypes` + the `'renderer'` pluggable-element group | `PluginManager.ts` |
| `BaseDisplayModel.rendererType` getter | `pluggableElementTypes/models/BaseDisplayModel.tsx` |
| ReExports entries for the 4 renderer classes | `ReExports/list.ts` + `modules.ts` |

**Still present in core (the compat plugin CAN use these):** `RendererType` base
class + `RenderProps` type (`renderers/RendererType.tsx`, still in ReExports),
`renderers/util/serializableFilterChain.ts`, `RpcMethodType` /
`RpcMethodTypeWithFiltersAndRenameRegions` base, `addDisplayType`/`addTrackType`,
`BaseDisplay`, `blockTypes`, `BaseDisplayModel.rendererTypeName` prop (kept for
snapshot back-compat).

### What this means for the compat plugin

It must **vendor the entire server-side stack**, not just register against core:

1. Recover the core renderer infra from SHA **`547288e90f`** (the commit just
   before the core rip; `git show 547288e90f:packages/core/src/pluggableElementTypes/renderers/ServerSideRendererType.ts`,
   etc.) — vendor `ServerSideRendererType`, `BoxRendererType`, `FeatureRendererType`,
   `LayoutSession`, `renderToAbstractCanvas`, `rpc/methods/util.ts`, and the
   `CoreRender` + `CoreGetFeatureDetails` RPC method classes into the plugin.
2. **Register the `CoreRender` + `CoreGetFeatureDetails` RPC methods** via the
   still-present `pluginManager.addRpcMethod(...)` — that extension point survives,
   so the vendored `ServerSideRendererType.renderInClient` (which does
   `rpcManager.call('CoreRender', ...)`) still works.
3. **Renderer registration is the hard part:** `addRendererType` and the
   `'renderer'` pluggable-element group are GONE. Options, cleanest first:
   - Have the vendored displays hold their renderer instance directly (don't go
     through `pluginManager.getRendererType`) — the display owns its renderer.
   - Or re-add a renderer registry by monkeypatching the PluginManager instance
     in the plugin's `install()` (assign `pm.rendererTypes`/`addRendererType`).
     This is the accepted "legacy/monkeypatch" path.
4. Vendor the concrete renderers (`SvgFeatureRenderer`/`DivSequenceRenderer`) as
   before (§B below).

Everything in the original plan below still applies for the **display/track/block
glue**; layer the server-side-infra vendoring above on top of it.

---

## (Original plan — display/block glue; server-side infra now also vendored, see UPDATE above)

The recovery sources below are still correct for the LGV block glue. The "rides
on stable core API" framing only held for the *first* rip; per the UPDATE, the
server-side core infra is now vendored too.

---

## Recovery manifest (what to vendor, and from where)

### A. The block display glue — recover from anchor SHA `d673d7e390`

```
plugins/linear-genome-view/src/LinearBareDisplay/configSchema.ts
plugins/linear-genome-view/src/LinearBareDisplay/index.ts        # registration shape, see §Registration
plugins/linear-genome-view/src/LinearBareDisplay/model.ts        # composes BaseLinearDisplay model
plugins/linear-genome-view/src/BasicTrack/configSchema.ts
plugins/linear-genome-view/src/BasicTrack/index.ts
plugins/linear-genome-view/src/BaseLinearDisplay/model.ts        # THE block model (BaseLinearDisplay)
plugins/linear-genome-view/src/BaseLinearDisplay/renderSvg.tsx
plugins/linear-genome-view/src/BaseLinearDisplay/models/serverSideRenderedBlock.ts
plugins/linear-genome-view/src/BaseLinearDisplay/components/LinearBlocks.tsx
plugins/linear-genome-view/src/BaseLinearDisplay/components/RenderedBlocks.tsx
plugins/linear-genome-view/src/BaseLinearDisplay/components/ServerSideRenderedBlockContent.tsx
plugins/linear-genome-view/src/BaseLinearDisplay/components/Block.tsx
plugins/linear-genome-view/src/BaseLinearDisplay/components/BlockErrorMessage.tsx
plugins/linear-genome-view/src/BaseLinearDisplay/components/MaxHeightReachedIndicator.tsx
```
Recover each: `git show d673d7e390:<path> > <new-plugin-path>`

### B. The concrete renderers — recover from their own pre-removal SHAs

`SvgFeatureRenderer` (whole `plugins/svg/src/SvgFeatureRenderer/` tree —
~20 files incl. glyph components, configSchema, hooks):
- last-having SHA: **`08d470db25a4414762e25bd6998218d49a2b34fd`**
- removed by `272f01f5e9` (Remove SvgFeatureRenderer #5290)
- recover the dir: `git archive 08d470db25 plugins/svg/src/SvgFeatureRenderer | tar -x -C <plugin-src>`

`DivSequenceRenderer` (`plugins/sequence/src/DivSequenceRenderer/` — Sequence/
Translation components, configSchema):
- last-having SHA: **`c602c269f8000814f7b15b1ccf5d62dda0774ff7`**
- removed by `fd0cd412c3` (Port LinearReferenceSequenceDisplay canvas rendering)
- recover: `git archive c602c269f8 plugins/sequence/src/DivSequenceRenderer | tar -x -C <plugin-src>`
- (only needed if you want the legacy reference-sequence track too; skip if
  only feature tracks matter)

> If these SHAs ever fall out of the repo (history rewrite), find them again:
> `git log --oneline --all --diff-filter=D -- '*SvgFeatureRenderer/index*'`
> then use that commit's `~1` parent.

### C. Imported from published barrels — do NOT vendor, add as deps

The block `model.ts` imports these from the **KEPT** LGV barrel
(`@jbrowse/linear-genome-view`) and core. Confirmed survivors of the rip:
- from `@jbrowse/linear-genome-view`: `BaseLinearDisplayComponent`,
  `baseLinearDisplayConfigSchema` (models/configSchema), `TrackHeightMixin`,
  `FeatureDensityMixin`, `FloatingLegend` (+`LegendItem`), `calculateSvgLegendWidth`,
  block `util.ts` helpers, `types.ts` (`ExportSvgDisplayOptions`,`LayoutRecord`)
- from `@jbrowse/core/*`: configuration, pluggableElementTypes/models,
  util, util/blockTypes, util/compositeMap, util/stopToken, util/tracks,
  util/tss-react, util/types, ui
- `@jbrowse/mobx-state-tree`, `mobx`, `mobx-react`, `react`, `@mui/*`

**Caveat:** the rip simplifies `BaseLinearDisplayComponent` to always render
`DisplayMessageComponent` and drops its `<LinearBlocks>` else-branch (handoff
§BaseLinearDisplay.tsx). So the compat plugin **cannot reuse the post-rip
`BaseLinearDisplayComponent`** for the block render — its vendored display must
either (a) set its own `DisplayMessageComponent` that renders the vendored
`<LinearBlocks>`, or (b) vendor a pre-rip copy of `BaseLinearDisplayComponent`
too. Recover the pre-rip component from `d673d7e390` if needed:
`plugins/linear-genome-view/src/BaseLinearDisplay/components/BaseLinearDisplay.tsx`.
Approach (a) is cleaner — wire `LinearBlocks` as the display's message component.

---

## Registration shape (the plugin's `src/index.ts`)

Combine the three registration files (verbatim shapes captured from
`d673d7e390`):

```ts
// renderers (from old plugins/svg + plugins/sequence index.ts)
pluginManager.addRendererType(() => new SvgFeatureRenderer(...))   // extends BoxRendererType
pluginManager.addRendererType(() => new DivSequenceRenderer(...))  // optional

// track type (BasicTrack/index.ts)
pm.addTrackType(() => new TrackType({
  name: 'BasicTrack',
  configSchema,
  stateModel: createBaseTrackModel(pm, 'BasicTrack', configSchema),
}))

// display type (LinearBareDisplay/index.ts)
pm.addDisplayType(() => new DisplayType({
  name: 'LinearBareDisplay',
  configSchema,
  displayName: 'Bare feature display',
  stateModel: stateModelFactory(configSchema),   // the vendored BaseLinearDisplay model
  trackType: 'BasicTrack',
  viewType: 'LinearGenomeView',
  ReactComponent: <see §C caveat>,
}))
```

`SvgFeatureRenderer` extends `BoxRendererType`; `DivSequenceRenderer` is a
`FeatureRendererType`. Both old `index.ts` files just call
`pluginManager.addRendererType(() => new XF(...))` and re-export
`ReactComponent` + `configSchema` (the gdc/icgc plugins consumed those re-exports
under names `SvgFeatureRendererReactComponent` / `svgFeatureRendererConfigSchema`
— re-export them under the same names for drop-in compat).

---

## gdc / icgc drop-in compat (the actual motivation)

These external plugins (`~/src/jb2plugins/{gdc,icgc}`) compose `BaseLinearDisplay`
destructured from `LGVPlugin.exports` and render via `BaseLinearDisplayComponent`
with a configured `rendererTypeName`. Post-rip they hard-crash on install
(destructure `undefined`). The compat plugin fixes this if it re-exposes:
- `BaseLinearDisplay` model export (so `LGVPlugin.exports.BaseLinearDisplay`
  resolves — or patch gdc/icgc to import from the compat plugin instead)
- the `SvgFeatureRenderer` renderer type they name in their config
- the `Svg*`/`svg*` re-exports above

Decide at build time whether to (a) make gdc/icgc import `BaseLinearDisplay` from
`@jbrowse/plugin-legacy-server-side` (clean), or (b) have the compat plugin
re-register `BaseLinearDisplay` into the LGV plugin's exports map (closer to
"monkeypatch", more fragile). Prefer (a).

---

## Verification for the future agent

1. Build the plugin standalone (`jbrowse-plugin-template`), `pnpm build`.
2. In a config, add a `BasicTrack` with a `LinearBareDisplay` +
   `rendererTypeName: 'SvgFeatureRenderer'`; confirm it renders blocks.
3. Install gdc (or icgc); confirm no destructure crash and a track renders.
4. If core dropped any §table API, pin `@jbrowse/core` to the version matching
   anchor SHA `d673d7e390` instead of chasing `latest`.

## Maintenance contract for the MAIN repo

~~The main repo should treat the core server-side API as a frozen contract.~~
**Superseded** — that cleanup happened (see UPDATE at top). The compat plugin no
longer has a frozen core contract to rely on; it vendors the server-side infra
from SHA `547288e90f`. The only ongoing main-repo dependency is the *generic*
extension surface still present: `addRpcMethod`, `addDisplayType`,
`addTrackType`, `RendererType` base + `RenderProps`, `RpcMethodType` bases, and
`BaseDisplay`. If a future cleanup removes any of those, the compat plugin must
pin `@jbrowse/core` to a version at/under `547288e90f` rather than `latest`.
