# Plan: external "legacy server-side rendering" compat plugin

**Audience:** a future agent (or human) tasked with restoring the block-based
server-side render path *after* the `webgl-poc` rip
(`HANDOFF-remove-serverside-path.md`) has deleted it from the main tree.

**Why this doc exists:** the rip removes the last in-tree reference for how the
block path is wired. This captures the exact recovery sources, file manifest,
dependency contract, and registration shape **while they still exist in HEAD**,
so the compat plugin can be reconstructed without re-deriving anything.

**Anchor SHA (pre-block-rip HEAD):** `d673d7e390d5b40c3aa0782d064700421d3f7ffa`
— every file path below resolves at this SHA. Once the rip lands, recover via
`git show d673d7e390:<path>`.

---

## The crucial fact that makes this clean (verify it still holds)

The rip does **not** touch the core server-side rendering machinery. It only
deletes the LGV-specific block glue and (earlier) the concrete renderers.
Everything the compat plugin rides on is **stable, still-maintained, public
`@jbrowse/core` API** exported to external plugins via `ReExports/list.ts`:

| Core piece | Path | ReExports? |
|---|---|---|
| `ServerSideRendererType` | `packages/core/src/pluggableElementTypes/renderers/ServerSideRendererType.ts` | `list.ts` ✓ |
| `BoxRendererType` | `.../renderers/BoxRendererType.ts` | `list.ts` ✓ |
| `FeatureRendererType` | `.../renderers/FeatureRendererType.ts` | `list.ts` ✓ |
| `renderToAbstractCanvas` | `packages/core/src/util/renderToAbstractCanvas.ts` | ✓ |
| `CoreRender` RPC method | `packages/core/src/rpc/methods/CoreRender.ts` (registered `RpcRegistry.ts`) | n/a (RPC) |
| `addRendererType` | `PluginManager.ts:569` | public API |
| `addDisplayType` / `addTrackType` | `PluginManager.ts` | public API |
| `blockTypes` etc. | `@jbrowse/core/util/blockTypes` | ✓ |

**First step for the future agent:** confirm the table above still holds. If
core has since dropped any of these, the compat plugin must pin to an older
`@jbrowse/core` version (the npm-published one matching this anchor SHA) rather
than `latest`. Quick check:
```
grep -n "ServerSideRendererType\|BoxRendererType\|FeatureRendererType" \
  node_modules/@jbrowse/core/dist/ReExports/list.js
```

Because the deleted block files form a **self-contained leaf** (they depend
*downward* on stable core + a few KEPT LGV mixins, and nothing in-tree depends
*back up* on them except the two registration files that move into the plugin),
this is a genuine plugin — **not** prototype/private monkeypatching.

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

## Maintenance contract for the MAIN repo (so this stays buildable)

The compat plugin only consumes the §table core API. For it to keep building
against `latest`, the main repo should treat these as a **frozen public
contract**: `ServerSideRendererType`, `BoxRendererType`, `FeatureRendererType`,
`renderToAbstractCanvas`, the `CoreRender` RPC, and their `ReExports/list.ts`
entries. If a future cleanup wants to remove them (nothing in-tree uses them
post-rip), that's the moment the compat plugin must pin to an old core version
instead — acceptable, but note it in that cleanup's PR.
