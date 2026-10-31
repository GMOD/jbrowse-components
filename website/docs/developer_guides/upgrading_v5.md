---
title: Upgrading to v5
description: What changed for plugin authors and embedders in JBrowse 2 v5.0.0
guide_category: Plugins
---

Most v4 sessions and configs load, and
[`jbrowse validate`](/docs/cli#jbrowse-validate) names the keys that no longer
do. Plugins do not migrate: the renderer registry is gone, names left the
`@jbrowse/core/*` re-export ABI, config models were flattened, display types
merged, and the extension point APIs changed. Run your bundle against a v5 build
before your users do.

## For everyone

- **Web**: `jbrowse upgrade` updates an installation in place.
- **Desktop**: updates itself.
- **Embedded**: bump `@jbrowse/react-linear-genome-view2`,
  `@jbrowse/react-circular-genome-view2` and `@jbrowse/react-app2` to their v5
  line. The packages without the `2` are deprecated.

## Migrations that happen automatically

Most sessions and configs migrate through `preProcessSnapshot`.
[](/docs/config_guides/v4_config_migration) lists every v4.3.0 key the app
rewrites and the slot each becomes. Among them:

- canvas `color1` and `color3` become `encoding.color` and
  `utrs.encoding.color`; `color2` and `outline` drop, since the glyph's lines
  take the theme's stroke color
- a v4 session's `heightPreConfig` migrates onto the `height` slot
- the LD display's `ldMetric` becomes `encoding.color.field`
- the variant display's `renderingMode: 'phased' | 'alleleCount'` becomes
  `unit: 'haplotype' | 'sample'`, from the config slot and from a session's
  `renderingModeSetting` alike

The `heightOverride` shadow-prop that existed during development is gone, and
there is no `<name>Override` shadow-property system.

Highlight visibility is session-wide in v5 rather than per view, and the v4 keys
that expressed it are **not** migrated. A v4 session with a dismissed band — the
LGV's `highlightsVisible`, or grid-bookmark's `bookmarkHighlightsVisible`, both
written out only when the user turned the band off — reopens with the band
visible, because MST drops a snapshot key the model no longer declares.
Dismissing it again is one click on the **Show highlights** item, and it now
applies to every view at once. The session still loads, and the dismissed
setting is the only loss.

Bookmarks are gone; highlights replace them. The session holds one list,
`session.highlights`, and every view draws the entries on the view's assemblies,
so a view's `highlight` array became the read-only getter `highlights`, and
`addToHighlights`, `setHighlight`, `removeHighlight` and `updateHighlight` moved
to the session as `addHighlight`, `setHighlights`, `removeHighlight` and
`updateHighlight`. A v4 view snapshot's `highlight` list still loads, onto the
session's. Bookmarks a v4 browser kept in localStorage, and the
`sharedBookmarks` a v4 share link contained, are not read; export them as BED
from v4 and import that file.

## The renderer registry is gone

`CoreRender` RPC, the renderer registry, and the server-side renderer and canvas
classes were removed — core no longer renders on the server. A plugin that
registered a custom `RendererType` or hooked into that pipeline has to be
rewritten against [](/docs/developer_guides/creating_gpu_display)
(`RenderLifecycleMixin` and `DisplayChrome`), and there is no compatibility
shim.

In practice the affected set is small: the significant custom renderers were
ones we wrote ourselves, now vendored into core plugins, plus two known external
ones, `jbrowse-plugin-gwas-hoot` and `NucContent`.

## Removed RPC methods

`rpcManager.call(sessionId, name, args)` takes the method name as a string, so a
plugin naming one of these fails the lookup. These went in v5, alongside
`CoreRender` above:

- `WiggleGetGlobalQuantitativeStats` and
  `WiggleGetMultiRegionQuantitativeStats`. There is no separate stats round trip
  any more: `RenderMultiWiggleData` returns the per-region score arrays and the
  display derives the domain from them, which also makes the percentile clip
  (`encoding.y.scale.fenceQuantile`) possible. The adapter methods those two
  called, `getRegionQuantitativeStats` and `getMultiRegionQuantitativeStats`,
  are gone from `BaseFeatureDataAdapter` as well; `scoresToStats` from
  `@jbrowse/core/util/stats` computes the same from an adapter's `getFeatures`.
- `RenderWiggleData`. `RenderMultiWiggleData` serves every quantitative adapter
  now that there is one quantitative display; an adapter handing back typed
  arrays reports one unnamed source through it.
- `MultiWiggleGetSources`. A quantitative track's sources arrive on each
  region's `RenderMultiWiggleData` payload, so a source that only appears in the
  second region is picked up as that region loads.
- `MultiVariantGetSources`, `MultiVariantGetGenotypeMatrix` and
  `MultiVariantClusterGenotypeMatrix` are `MultiSampleVariantGetSources`,
  `MultiSampleVariantGetGenotypeMatrix` and
  `MultiSampleVariantClusterGenotypeMatrix`.
- `MultiVariantGetFeatureDetails` read a feature back out of the renderer
  registry (`RendererType.getFeatureById`), so it went with the registry.
  `MultiSampleVariantGetCellData` answers the same question from the display's
  data.
- `MultiVariantGetSimplifiedFeatures`, `CoreGetFeatureDetails`,
  `ComparativeRender` and `PileupGetVisibleModifications` are not registered.
- `CoreGetFeatureDensityStats` went with the density tier.
- `RenderLinearReadArcsDisplay` and `RenderLinearReadCloudDisplay` went with
  their displays, which are `LinearAlignmentsDisplay` now.

Removed RPC methods are the one removal on this page that fails loudly:
`getRpcMethodType` ends in a registry lookup that throws
`RpcMethodType 'X' is not registered`. The error names the method and lists what
this build does register, which also shows which plugin is missing.

## The host serves four `@jbrowse` packages to plugins

The re-export list used to name a hand-written handful of `@jbrowse/core`
subpaths. It is generated now, from the `exports` map of the four packages the
host serves: `@jbrowse/core`, `@jbrowse/display-kit`, `@jbrowse/display-ui` and
`@jbrowse/render-core`. A plugin importing `@jbrowse/display-kit/DisplayChrome`
gets the host's copy rather than bundling its own; a display mixin or a React
context works no other way. A plugin bundles every other `@jbrowse` package,
core plugins such as `@jbrowse/plugin-linear-genome-view` included, and gets no
other plugin's code at run time.
[](/docs/developer_guides/imports_and_reexports) has the table.

Two things follow for a plugin author:

- **A rebuild raises the minimum host version.** The template externalizes
  whatever the installed `@jbrowse/core`'s list names, so a plugin rebuilt
  against v5 reads those keys off the host and needs a host at least as new as
  the core it was built against: a name added later is `undefined` on an older
  host, since only a missing module throws. A plugin built earlier keeps working
  wherever the keys it reads are still served; the tables below list the names
  that are not.
- **A key the host lacks throws at the first read, naming the key.** A plugin
  built against an older or newer core, or against a package the host does not
  bundle, used to fail as `Cannot read properties of undefined` somewhere inside
  the plugin's module scope. jbrowse-web reports it as one notification and
  opens the session without the plugin.

The plugin `exports` objects went in the same change, since what they held is a
named export of the plugin package — see the next section.

## Names removed from the re-export ABI

Names the 4.3.0 `@jbrowse/core` exported from a subpath this build still
publishes, and this build does not. Where 4.3.0 served that subpath to runtime
plugins — `util`, `configuration`, `pluggableElementTypes` and the rest of its
re-export list — a removed name is `undefined` inside a bundle nobody is going
to rebuild, which is the quietest failure on this page. From any other subpath a
4.3.0 bundle has its own copy, so the removal breaks the plugin's next build
instead:

<!-- BEGIN GENERATED ABI_REMOVED_NAMES -->

88 names over 103 entries, since 15 of them were served from two modules each.

<!-- prettier-ignore -->
| What went | Names |
| --- | --- |
| the renderer registry | `RendererType`, `FeatureRendererType`, `BoxRendererType`, `CircularChordRendererType`, `ServerSideRendererType`, `GlyphType`, `getParentRenderProps` |
| layout, which moved onto the GPU packing path | `PileupLayout`, `SceneGraph`, `calculateLayoutBounds`, `getLayoutId`, `MultiLayout`, `PrecomputedLayout` |
| the 2.x `AbortSignal` helpers; cancellation is an `AbortSignal` again, and `checkAbortSignal` is back | `abortBreakPoint`, `observeAbortSignal`, `makeAbortableReaction` |
| stop tokens, replaced by the platform `AbortController` | `createStopToken` → `new AbortController()`, `stopStopToken` → `controller.abort()`, `checkStopToken` → `checkAbortSignal`, `createStopTokenChecker` → `createAbortBreakpoint` |
| the renderer era's RPC retry and progress reporting | `RetryError`, `isRetryException`, `updateStatus2`, `getProgressDisplayStr`, `getStatsId` |
| desktop file handles, which the desktop package now owns | `getFileHandleCache`, `setFileHandleCache`, `removeFileHandle`, `cleanupStaleHandles`, `getPendingFileHandleIds`, `setPendingFileHandleIds`, `clearPendingFileHandleIds`, `restorePendingFileHandles` |
| renames with a survivor | `contrastingTextColor` → `makeContrasting`, `checkStopToken2` → `checkAbortSignal`, `assembleLocStringFast` → `assembleLocString`, `findLast` → `Array.prototype.findLast`, `findLastIndex` → `Array.prototype.findLastIndex`, `bpToPxMap` → `bpToPx` |
| react-dom, which a rendering library should not ask its host for — react-msaview owns its copy from 71e835ae, which `jbrowse-plugin-msaview` 3.6.0 and `-tview` 2.2.3 include | `renderToStaticMarkup` |
| names with no caller left in core, which the last callers inlined or folded away | `forEachWithStopTokenCheck`, `TextSearchManager`, `isContainedWithin`, `iterMap`, `when`, `blobToDataURL`, `cartesianToPolar`, `degToRad`, `getUriLink`, `defaultStops`, `useDebouncedCallback`, `sampleFeaturesForInterval`, `customAlphabet`, `customRandom`, `random`, `urlAlphabet`, `createCanvas`, `createImageBitmap`, `isImageBitmap`, `collectTransferables`, `isDetachedBuffer`, `matchCSSObject` |
| plugin-definition helpers, now in `@jbrowse/core/pluginDefinitions`, so reading a definition does not load the re-export registry | `isESMPluginDefinition`, `isUMDPluginDefinition`, `pluginDescriptionString`, `pluginUrl` |
| the CJS plugin loader, which wrote a bundle to a temp file and `require`d it in Desktop’s renderer — publish UMD or ESM instead | `isCJSPluginDefinition` |
| the track and display configuration references, which `ConfigurationReference` picks between | `TrackConfigurationReference` → `ConfigurationReference`, `DisplayConfigurationReference` → `ConfigurationReference` |
| the color pickers, one default export per subpath: `@jbrowse/core/ui/PopoverPicker` is the popover, and the default of `@jbrowse/core/ui/ColorPicker`, the popover in 4.3.0, is now the inline panel | `PopoverPicker`, `ColorPicker` |
| palettes, still served as members of `paletteColors` | `dark2` → `paletteColors.dark2`, `ggplot2Colors3` → `paletteColors.ggplot2Colors3`, `ggplot2Colors4` → `paletteColors.ggplot2Colors4`, `ggplot2Colors5` → `paletteColors.ggplot2Colors5`, `ggplot2Colors6` → `paletteColors.ggplot2Colors6`, `set2` → `paletteColors.set2`, `tableau10` → `paletteColors.tableau10` |
| block classes, now interfaces discriminated by `type`, so a block is an object literal | `BaseBlock`, `ContentBlock`, `ElidedBlock`, `InterRegionPaddingBlock` |
| the config models that were flattened | `isConfigurationSlotType` |
| MST reflection `@jbrowse/mobx-state-tree` answers itself: `getWrappedType` and `unwrapType` see through an optional, a refinement, a snapshotProcessor or a resolved late, `asArrayType`/`asMapType` reach a collection, `getUnionSubtypes` a union through any of those | `getDefaultValue`, `getPropertyType`, `getSubType`, `getUnionSubTypes`, `resolveLateType` |

<!-- END GENERATED ABI_REMOVED_NAMES -->

`scripts/check-published-plugins.ts` reads every bundle in the plugin store and
reports what each one takes off the host; `abi-watch.yml` refreshes that answer
weekly. A store entry declaring `jbrowseRange: "*"` is offered to a v5 user as
compatible whatever its state here.

<!-- BEGIN GENERATED ABI_PLUGIN_BREAKS -->

2 of the 15 plugins in the store break against this build.

<!-- prettier-ignore -->
| Plugin | What breaks |
| --- | --- |
| Apollo | `worker eval: ReferenceError: Cannot access 'su' before initialization` |
| Ideogram | `worker eval: ReferenceError: window is not defined` |

<!-- END GENERATED ABI_PLUGIN_BREAKS -->

A `worker eval:` line means the bundle threw while the RPC worker evaluated it.
A missing global (`window`, `document`) is the plugin reading the DOM at module
scope, which only the plugin can fix; `does not serve` is a module this build
stopped serving, the same break as a `module` line.

## The `@material-ui/*` aliases are gone

The host no longer serves `@material-ui/core`, `@material-ui/core/<Component>`,
`@material-ui/core/styles`, `@material-ui/core/utils` or `@material-ui/lab/*`.
They were aliases onto the same `@mui/material` modules, kept since the v2
migration for bundles built against Material UI v4. A bundle that still reads
them reads them at module scope, so it fails to load on v5 with a notification
rather than degrading. The Reactome store plugin was the last such bundle in the
store, and has been rebuilt. A rebuild against the current template imports
`@mui/material` and resolves to the host's copy as before.

## Subpaths removed from `@jbrowse/core`

A deep import such as `import QuickLRU from '@jbrowse/core/util/QuickLRU'`
resolves through the `exports` map in `@jbrowse/core`'s `package.json`, and a
subpath that map no longer serves fails to resolve at your next build. A bundle
you already published inlined the module and keeps working. Where the code
merely moved, the entry lists the import to use instead.

<!-- BEGIN GENERATED ABI_REMOVED_SUBPATHS -->

17 subpaths the published `exports` map no longer serves, against what 4.3.0
published.

<!-- prettier-ignore -->
| Subpath | What happened |
| --- | --- |
| `@jbrowse/core/data_adapters/BaseAdapter/BaseOptions` | the adapter options bag, folded into `data_adapters/BaseAdapter` itself, which still exports `BaseOptions` and is still a published subpath |
| `@jbrowse/core/pluggableElementTypes/GlyphType` | glyphs are drawn by the GPU displays, not registered |
| `@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType` | renderer registry removed |
| `@jbrowse/core/pluggableElementTypes/renderers/CircularChordRendererType` | renderer registry removed |
| `@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType` | renderer registry removed |
| `@jbrowse/core/pluggableElementTypes/renderers/LayoutSession` | the block layout cache the box renderer kept; layout moved onto the GPU packing path |
| `@jbrowse/core/pluggableElementTypes/renderers/RendererType` | renderer registry removed; displays compose RenderLifecycleMixin + DisplayChrome |
| `@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType` | renderer registry removed, core no longer renders on the server |
| `@jbrowse/core/pluggableElementTypes/renderers/util` | helpers for the classes above, deleted with them |
| `@jbrowse/core/rpc/coreRpcMethods` | alive — `CorePlugin` imports `packages/core/src/rpc/coreRpcMethods.ts` relatively, so nothing publishes the subpath any more |
| `@jbrowse/core/rpc/methods/util` | renderer-era RPC helpers, removed with `CoreRender` |
| `@jbrowse/core/ui/ErrorMessage` | alive, and `@jbrowse/core/ui` still exports it as `ErrorMessage` — import it from the barrel |
| `@jbrowse/core/util/QuickLRU` | alive, a vendored copy of the npm package of the same name that core reaches relatively — depend on `quick-lru` yourself |
| `@jbrowse/core/util/compositeMap` | dead, with no caller in or out of the tree |
| `@jbrowse/core/util/layouts/BaseLayout` | the interface `GranularRectLayout` implemented for `MultiLayout` and `PrecomputedLayout` to share; deleted with them, along with the serialization types (`SerializedLayout`, `RectTuple`) that only the worker-to-main layout handoff used |
| `@jbrowse/core/util/offscreenCanvasUtils` | the server-side canvas helpers behind `renderToAbstractCanvas` |
| `@jbrowse/core/util/stopToken` | stop tokens are gone (ADR-122): a caller holds an `AbortController` and passes its `signal`; a worker checks with `checkAbortSignal` and yields through `createAbortBreakpoint`, both in `@jbrowse/core/util/aborting` |

<!-- END GENERATED ABI_REMOVED_SUBPATHS -->

The map is generated from in-repo import sites
(`packages/core/scripts/generateExports.mjs`), so a subpath leaves it whenever
its last in-repo importer does, with nobody deciding to drop it.

## Names removed from the session and from a plugin's `exports`

A plugin reaches these surfaces without importing anything. It looks up a
session member on an object at runtime, often behind `'x' in session`, so
removing one raises no error and the plugin stops asking. A plugin `exports`
object is reached as `pluginManager.getPlugin('X').exports.Y`, where a missing
name is `undefined` and calling it throws inside the calling plugin's `install`.

- **the session**, which a plugin reaches by member lookup (`'x' in session`)
  rather than by import, so nothing fails at build time:
  - `removeReferring`: deleted, along with the reference-clearing pass it drove;
    calling it throws `undefined is not a function`
  - `prepareToBreakConnection`: deleted with the "N tracks will close"
    pre-flight it computed; `breakConnection` now closes them without the
    confirmation step
  - `hasWidget`: deleted; use `session.widgets.has(id)`, which it wrapped
  - `getReferring`: **still there, with a signature a v4 caller does not
    satisfy.** It takes a `trackId` string now, where it used to take the config
    object. A v4 caller passing the object reaches `getReferringMultiple`, which
    tests its `Set` of objects against `node[key]?.trackId`, a string, so every
    comparison misses and the answer is `[]`. The call raises no error: the
    caller concludes no view refers to the track and closes it out from under
    whatever was showing it
  - `addTrackConf`: **still there, writing somewhere else.** It wrote to the
    jbrowse config in v4; it is now a deprecated alias of `addSessionTrackConf`,
    so the track lives for the session and no longer goes into the `config.json`
    every visitor is served. Say which you mean: `addSessionTrackConf` for a
    track your plugin stands up on the user's behalf, `publishTrackConf` for an
    Add-track workflow where an admin means to add it for the whole site
- **`@jbrowse/product-core`'s `Session` barrel**, which is a named allowlist
  now, where it was `export *` over nine modules, so a name the allowlist omits
  is gone from the package even where its module still declares it:
  - `DialogQueueSessionMixin`: `Session/DialogQueue.ts` was folded into
    `BaseSessionModel`, which declares `queueDialog`, `removeActiveDialog`,
    `DialogComponent` and `DialogProps`. Every session still has the members;
    the composable mixin is gone, so a product assembling its own session from
    mixins has to compose `BaseSessionModel` for them
  - `isSessionWithDialogs`, `SessionWithDialogs` and `SessionWithDialogsType`:
    same file. Every session that composes `BaseSessionModel` has the dialog
    members, so there is no narrowing to do; `SessionWithDialogs` was an
    `Instance` of the mixin and `SessionWithDialogsType` its `ReturnType`
- **the plugin `exports` objects, all of them.** `AuthenticationPlugin`,
  `DataManagementPlugin`, `LinearGenomeViewPlugin` and `WigglePlugin` had one;
  `pluginManager.getPlugin('X').exports` is now `undefined` on every plugin. A
  runtime plugin gets no other plugin's code: the display schema they had is
  `baseLinearDisplayConfigSchema` from `@jbrowse/display-kit/configSchema`,
  which the host re-exports, and `SearchBox`, `ZoomControls` and
  `AssemblyManager` have no replacement (see
  [](/docs/developer_guides/imports_and_reexports)). No v5-era plugin in the
  store bundles reaches an `exports` object; the v4 bundles that did (`gdc`,
  `icgc`, `gwas`, `quantseq`, `mafviewer`, `multilevel-linear-view2`) each
  already break on v5 through a renderer-era name.
- **`LinearGenomeViewPlugin.exports`**, before the object itself went:
  - `BaseLinearDisplay`: the legacy block-render state model, removed with the
    server-side render path. A v4 plugin composing `exports.BaseLinearDisplay()`
    throws while its `install` runs, so its track type never registers and a
    saved session opens with the track absent
  - `BaseLinearDisplayComponent`: the React half of the same pair, and the last
    reader of the `DisplayMessageComponent` getter on `BaseDisplayModel`, which
    went with it. A display model no longer holds a React component at all
- **`@jbrowse/plugin-linear-genome-view`'s type exports**, which a plugin built
  against the published package imports rather than looking up at runtime, so
  these break a build, not a session:
  - `LayoutRecord`: the 4-tuple `[minX, minY, maxX, maxY]` the block layout
    handed back, exported from the plugin entry and the `BaseLinearDisplay`
    barrel with no consumer left in the tree. Its 5-tuple
    `LayoutFeatureMetadata` variant went with the floating-label code, so v5
    already published the narrowed tuple.
    `@jbrowse/plugin-breakpoint-split-view` declares an identical one and still
    exports it, so move your import there
  - `Layout`: the named-rectangle interface beside it
    (`minX`/`minY`/`maxX`/`maxY`/`name`), declared in the same file and never
    exported past it or read anywhere

The removals table above and `scripts/check-published-plugins.ts` both work from
module exports and are not checked against a published bundle, so neither
reaches a plugin `exports` object or the session.
`pluginFacingSessionApi.test.ts` pins the session members published bundles
call, and performs the call rather than just asserting the member exists. For
everything else, including `getReferring`'s changed signature, this page is the
record.

## Display types collapsed

A saved config's `type:` still resolves, because each old name is registered as
an alias that migrates its settings across. A plugin that matched on the old
name, or extended or referenced the old display classes directly, needs updating
and otherwise stops applying with no error.

<!-- prettier-ignore -->
| The v4 display | Now |
| --- | --- |
| `LinearPileupDisplay`, `LinearSNPCoverageDisplay`, `LinearReadArcsDisplay`, `LinearReadCloudDisplay` | `LinearAlignmentsDisplay` |
| `LinearFeatureDisplay` | `LinearBasicDisplay` |
| `MultiLinearVariantDisplay`, `LinearVariantMatrixDisplay` | `LinearVariantDisplay` |
| `LinearGCContentDisplay`, `LinearGCContentTrackDisplay` | `LinearWiggleDisplay` |
| `LinearArcDisplay`, `LinearPairedArcDisplay` | `LinearMarkDisplay`, with `link` marks |

A plugin that retires a display registers the old name the same way, through
`retiredTypes`.

## The quantitative displays are one display

`MultiLinearWiggleDisplay` is gone. `LinearWiggleDisplay` draws one source or
many and registers against both `QuantitativeTrack` and
`MultiQuantitativeTrack`, which differ in adapter shorthand and add-track
workflow rather than in what they draw. `rows: 'source'` puts each source on a
separate row, with the tree sidebar, clustering, the row-order sort and the row
labels, and `rows: ''` draws every source in one shared plot. A
`MultiQuantitativeTrack` defaults its display to `rows: 'source'`,
`mark.extent: 'none'` and `height: 200`, so a multi track that names no display
setting still opens as a stack of rows.

`defaultRendering` is now `mark`, in the mark display's words: `xyplot` loads as
`bar`, `scatter` as `point`, `density` as `rect`, `line` as `line`, and
`linecenter` as `mark: { type: 'line', interpolate: 'linear' }`.
`summaryScoreMode` is now two settings: `encoding.y.field`, which of a bin's
stored summaries is plotted (`score`, the mean and v4's `avg`; `minScore`; or
`maxScore`), and `mark.extent`, whether the bin's min-to-max span is drawn
around it (`'min-max'` or `'none'`). v4's `whiskers` is `score` with
`mark.extent: 'min-max'`, and any other mode loads with `mark.extent: 'none'`,
as v4 drew it. A config or session naming `summaryScoreMode`, on the display or
in its `renderers` block, loads that way. A config or a session naming
`MultiLinearWiggleDisplay` loads as `LinearWiggleDisplay`, its rendering read as
the plot and the layout it drew: `multirowxy` is a `bar` on rows, and `xyplot` a
`bar` with `rows: ""`.

`rows` also holds a reader's arrangement of the rows, which
`MultiLinearWiggleDisplay` kept as display props. The arrangement is therefore
one per track, shared by every view showing it, and an edit to it is a change to
the track's settings that undo and reset reach. A color set on one subtrack is
`rowColor: { scale: { domain, range } }`. `runClustering`, `clusterRegion` and
`sortRowsBy` stay display props.

<!-- prettier-ignore -->
| v4 display prop | v5 display config |
| --- | --- |
| `layout`, the rows in order with any label and color set on each | `rows.sort`, `rows.labels` and `rowColor` |
| `clusterTree` | `rows.tree`, beside `rows.treeProvenance` |
| `subtreeFilter` | `rows.kept` |

A session with those props opens with them moved into `rows` and `rowColor`, and
a v4 session's plot, scale, autoscale, domain and colors move to the config
slots that hold them now.

## The variant rows are config too

The variant display keeps its arrangement in `rows` as well, with no `field`,
since its rows are the samples: `rows.sort` is the row order, `rows.labels` the
relabels, `rows.tree` and `rows.treeProvenance` a clustering run's tree, and
`rows.kept` the focus. In phased mode the names are haplotypes,
`"<sample> HP<n>"`, and a sample's name stands for all of its haplotypes.
`rowColor` is `field | { field, scale: { domain, range } }`: the string is still
the sample-metadata attribute that tints every row, and
`scale.domain`/`scale.range` pair row names with the colors a reader set; while
an attribute is named, its palette takes precedence over them.

<!-- prettier-ignore -->
| v4 | v5 display config |
| --- | --- |
| `layout` display prop, the rows in order with any label and color set on each | `rows.sort`, `rows.labels` and `rowColor.scale.domain`/`scale.range` |
| `clusterTree` display prop | `rows.tree` |
| `subtreeFilter` display prop | `rows.kept` |

A session with `layout`, `clusterTree` or `subtreeFilter` opens with them moved
into `rows`, less the colors, which a v4 `colorBy` copied into `layout` from its
palette.

## The multi-row feature display's rows are config too

The multi-row feature display is new in v5. Its rows are the values of a feature
attribute, and `rows` holds both halves: `rows.field` is the attribute, empty
still picking one off the data, and the other members are the arrangement, as on
the quantitative display. `rowColor: { scale: { domain, range } }` pairs row
values with colors, and holds both a color a config names and a color a reader
sets in **Edit colors/arrangement...**.

## The MAF rows are config too

The MAF display keeps its arrangement in `rows` with no `field`, since its rows
are the species, as on the variant display. The adapter's guide tree stays the
adapter's: it draws while some rotation of it lists the species in `rows.sort`'s
order, so a reorder that splits a clade hides it and **Reset row order** brings
it back, and a clustering run's tree in `rows.tree` replaces it.
`rowColor: { scale: { domain, range } }` pairs species with the label tint a
reader set, over the adapter's `samples[].color`. A session saved with
jbrowse-plugin-mafviewer opens with its `subtreeFilter` in `rows.kept` and its
`treeAreaWidth` in `axis.width`.

## The wiggle color is one `encoding.color` object

`encoding.color` on `LinearWiggleDisplay` is `{ value }`, a CSS color, or
`{ scale: { type, domain, range, scheme } }` over the score, the scale every
other display's color takes. A v4 config or session lifts `posColor` and
`negColor` into the threshold object. `useBicolor` and `densityColorRamp` stop
loading, and `bicolorPivot` is `origin`, the mark display's slot, which is also
the value the bars grow from.

<!-- prettier-ignore -->
| v4 | v5 |
| --- | --- |
| `posColor`, `negColor`, `bicolorPivot: p` | `encoding.color: { scale: { type: 'threshold', domain: [p], range: [neg, pos] } }` |
| `color` beside `useBicolor: false` | `encoding.color: { value: '#…' }` |
| `densityColorRamp: 'viridis'` | `encoding.color: { scale: { type: 'linear', scheme: 'viridis' } }` |

`setPosColor`, `setNegColor`, `setUseBicolor` and `setBicolorPivot` are
`setColor` and `setOrigin`. **`useBicolor`, `densityColorRamp` and
`bicolorPivot` do not migrate**: MST drops a snapshot key the model no longer
declares, so a track that named one of them reopens in the default colors.
`scale.domainMid` is new on the ramp. The track menu no longer has a color row:
**Edit colors/arrangement...** offers the plot's two colors on one line, and
**Edit plot...** opens the shared plot dialog on the same object a config file
holds.

[](/docs/config/wigglecolor) lists the members.

## The Hi-C color is an `encoding.color` object

`LinearHicDisplay` takes its ramp from
`encoding.color: { scale: { type, scheme, reverse } }`, with the same schemes as
every other color scale. `colorScheme` and `useLogScale` stop loading, with no
migration.

<!-- prettier-ignore -->
| v4 | v5 |
| --- | --- |
| `colorScheme: 'fall'` | `encoding.color: { scale: { scheme: 'fall' } }` |
| `useLogScale: true` | `encoding.color: { scale: { type: 'symlog' } }` |

`setUseLogScale` is `setLogScale(true | false)`. [](/docs/config/hiccolor) lists
the members.

## The LD color is an `encoding.color` object

`LDTrackDisplay` takes its statistic and ramp from
`encoding.color: { field, scale: { scheme, reverse, domainMin, domainMax } }`.
`field` is `r2` or `dprime`, and an unset `scale.scheme` is reds for r² and
blues for D', as before. `ldMetric: 'dprime'` loads as
`encoding.color: { field: 'dprime' }`; the v4 `colorScheme` string stops
loading, with no migration. [](/docs/config/ldcolor) lists the members.

## A non-coding BED12 parses as a transcript

The BED12 gene heuristic used to require a non-empty thick range, so every
12-column feature with `thickStart == thickEnd` — an lncRNA, a spliced EST, any
alignment with no CDS — came back with no `type` and `block` children. Blocks
make a transcript, and UCSC's format definition calls them exons; thickness
marks whether the transcript codes. Those features now parse as `transcript`
with `exon` children, the way a coding BED12 always has.

For a site, the feature reports a type where it reported none, so the `geneLike`
filter field counts it as a gene, the hover readout numbers its exons and gives
an HGVS `n.` coordinate, "Get sequence" offers the spliced cDNA, "Collapse
introns" is offered on it, and "Save track data" round-trips it byte-exact where
it used to demote the record to BED6, with one row per block and the name and
the score dropped. The feature-details panel stops listing the six raw columns
the promotion consumes (`thickStart`, `thickEnd`, `blockCount`, `blockSizes`,
`blockStarts`, `chromStarts`), as it has always done for a coding BED12. The
drawing does not change, because the same glyph already drew both.

A BED12 alignment promotes the same way, so a UCSC `est`, `intronEst`, `mrna` or
`xenoMrna` track now reports its features as transcripts. That is deliberate:
BED12 has no column separating a spliced EST from an lncRNA, and with no CDS
children the promotion makes no coding claim: the sequence panel withholds CDS
and protein, and HGVS stays `n.`. A BED12 file whose blocks are not exons opts
out with `disableGeneHeuristic: true` on the adapter, as before.

## Config models were flattened

Config slots are no longer separate MST instances; one model holds many slots in
a flat layout. Plugin code calling `configSlot.set(value)` must use
`setConf(model, 'slotName', value)` rather than `configuration.setSlot`, and the
lint rule names the replacement.

Config slots were also renamed. End-user JSON migrates automatically, but plugin
code that reads a renamed slot directly — `getConf(self, 'color1')` — needs
updating.

## The value scale is one `encoding.y` object

Every quantitative display configures its value axis as Vega-Lite's `encoding.y`
([](/docs/config/ychannel)): the wiggle display and the mark display, which
Manhattan now is, at `encoding.y`, and the coverage band of the alignments,
LGVSynteny and MAF displays at `coverage.encoding.y`.

- `scale` holds `type`, `domainMin`, `domainMax`, `zero`, `fenceQuantile`,
  `constant` and `group`; `axis` holds `title` and `grid`; `rules` sits beside
  them.
- The wiggle display's plotted field is `encoding.y.field` (was `y`), and a bare
  string there is the field. MAF's `y` is `encoding.y`. The mark display's
  display-level `encoding.y` names no field, since each mark names its own.
- v4's `scaleType` is `scale.type`, `minScore` and `maxScore` are
  `scale.domainMin` and `scale.domainMax`, and `autoscale` is one number,
  `scale.fenceQuantile`: `localpercentile` is `0.99` and every other value is
  `1`, the extremes. `displayCrossHatches` is `axis.grid`.
- Earlier v5 betas wrote `scales.y`, with `domainQuantile` for `fenceQuantile`,
  `symlogConstant` for `constant`, `autoscaleGroup` for `group`, and `title` and
  `grid` beside the scale members.
- **A config or session in any of these spellings lifts when it loads.**
  `minimalTicks`, `numStdDev`, `inverted` and `numQuantile` have no successor
  and are dropped. The `Number.MIN_VALUE`/`MAX_VALUE` sentinels went away: an
  end left unset autoscales.
- Code that reads a retired slot with `getConf` needs updating. The model's
  `domainQuantile`, `setDomainQuantile` and `clipQuantile` are `fenceQuantile`,
  `setFenceQuantile` and `clipFenceQuantile`, and its volatile
  `unclippedQuantile` is `unclippedFenceQuantile`.
- `@jbrowse/wiggle-core` no longer exports `scalesSchema`, `valueScaleSchema`,
  `SCALES_Y_PATHS`, `yFieldConfigSchemaFields`, or the types
  `ScalesConfigSchema`, `ValueScaleConfigSchema`, `ValueScaleOptions`,
  `ScoreScaleHost` and `ScoreScaleHostPath`. A schema declares its y through
  `yChannelSchema`, `yFieldChannelSchema` or `yEncodingSchema`.
- `ScoreScaleMixin`, `WiggleScoreConfigMixin` and `YFieldConfigMixin` take a
  required `YScalePaths` map naming where each y member lives;
  `COVERAGE_Y_PATHS` from `@jbrowse/alignments-core/coverageBandConfigSchema` is
  the coverage band's.
- `minimalTicks` left display-ui's `ValueScale` and `computeYTicks`' options.

## The tree sidebar's settings are one `axis` object

The wiggle, MAF, mark, multi-sample variant and multi-row feature displays
configure the guide down the left of their rows as `axis`, beside `rows`
([](/docs/config/rowaxis)).

- `showTree` is `axis.tree`, `showBranchLength` is `axis.branchLength`,
  `showRowLabels` is `axis.labels` and `treeAreaWidth` is `axis.width`.
- `showRowSeparators` is `axis.grid`, on every one of them but MAF and the mark
  display. That `axis.grid` draws lines between rows; `encoding.y.axis.grid`
  draws value gridlines, and a view's `axis.grid` draws ruler gridlines.
- **A config or session in the old spellings lifts when it loads.** Code that
  reads one with `getConf` needs updating; the model getters keep their names.
- `@jbrowse/tree-sidebar` exports `rowAxisConfigSchema` and
  `rowAxisWithGridConfigSchema` in place of `treeSidebarConfigSchemaFields` and
  `rowSeparatorsConfigSchemaFields`.

## An embedded view's track catalog is plain configs

`session.tracks` in `@jbrowse/react-linear-genome-view2` and
`@jbrowse/react-circular-genome-view2` holds the configs as written, the way
JBrowse Web's always has, rather than config models. `readConfObject` on an
entry returns `undefined` for a slot the config omits instead of its default,
and cannot evaluate a `jexl:` callback. `hydrateTrackConfig` from
`@jbrowse/core/configuration` returns the resolved model when a host needs
defaults. An edit to a shown track's settings is kept in the session's
`trackConfigDeltas`, so it now survives a session snapshot.

In the types, `session.tracks` is a `TrackConfigEntry[]`, and `getTrackById`
returns an `AnyTrackConfig`, which is such an entry or the live node of an
assembly's sequence track or a connection's track. The track selector's
`selection` and the `Core-extraTrackMenuItems` contribution's `config` are
`AnyTrackConfig` too. `readConfObject` on an entry is a compile error: read
`trackId` and `type` off it, and its assemblies with
`getConfAssemblyNamesOrNone`, which returns `[]` for an entry that omits them.

## An embedded view has no title bar

The single-view components draw their view in a plain bordered box, with no
shaded panel around it and no title bar above it. The view menu moved into the
view's controls: the first button in the linear view's header, and the first in
the circular view's control strip. It keeps `data-testid="view_menu_icon"`. The
About dialog the title bar opened is gone. Session code can read
`session.viewTitleBars`, which is `false` in these products, to tell whether the
view hosts its menu.

## The LGV viewport is a stored bp window

`LinearGenomeView` persisted its viewport as `offsetPx` and `bpPerPx`. Both are
functions of the measured width, and the width was never written down, so a
session authored in a 1000px window reopened at 500px showing half the region
its author framed. It persists as `windowStartBp` and `windowWidthBp` now, in
the linearized bp space `displayedRegions` concatenates (ADR-070).

Almost nothing needs changing:

- `offsetPx` and `bpPerPx` are still there under the same names, as derived
  getters. Reading either is unchanged.
- `scrollTo(offsetPx)`, `setNewView(bpPerPx, offsetPx)` and `moveTo` keep their
  signatures.
- A snapshot or URL spec naming `bpPerPx`/`offsetPx` is still accepted.
  `windowStartBp` converts exactly, and the scale is kept until the first
  measure and adopted at whatever width arrives, bit for bit what v4 did, so an
  old link keeps its old behavior. That covers the several places in the tree
  that build a view from such a snapshot (a synteny row, a split view), so none
  of them changed.

Two things did change:

- **`zoomTo` lost its third parameter.** It was
  `zoomTo(bpPerPx, offset, centerAtOffset)`; `centerAtOffset` was unread and is
  gone. A call passing three arguments now passes one the action does not take.
- **To frame a specific window, say so in bp.**
  `setWindow(windowWidthBp, windowStartBp)` is the action, and a snapshot naming
  `windowWidthBp` is restored as that window at any width. A window built from
  `bpPerPx` needs an invented width for the scale to be relative to, and the old
  pair made that unavoidable. `buildReadVsRefSpec` computed
  `bpPerPx: refLen / viewWidth` from a width threaded in from its caller, and
  now sets `windowWidthBp: refLen` and takes no width at all.

## A view reports an unknown key

v4 dropped an undeclared key on a view snapshot with no error and no warning:
the view rendered its default. A `defaultSession` written with a setting one
level out from where it belonged therefore shipped looking correct and behaving
wrong, and several published demos did.

Every view type now reports one. The view keeps the key and names it once on
attach, in the console and in a notification:

```text
LinearGenomeView ignored unknown key(s): asembly
```

A correct snapshot behaves as before. A view whose only unrecognized key is a
typo still opens, on its import form with the reason shown, instead of waiting
on data that never arrives.

## Every setting goes directly on the view object

A view had two authoring shapes in v4, and which one was correct depended on
where you were writing. Flat on the view is what a session spec, a URL and a
jbrowse-img spec took; nested under `init` is what a `defaultSession` took. v4's
docs did not specify which shape to use where.

v5 keeps the flat shape. Every view type takes every setting directly on the
view object:

```json
{
  "type": "LinearGenomeView",
  "assembly": "hg38",
  "loc": "chr1:1-100000",
  "tracks": ["genes"]
}
```

The flat JSON shape works in a `defaultSession`, in a `?session=spec-` URL, in
`addView` and in an embedded `createViewState`. A view snapshot restored from a
saved session is unaffected: `tracks` holding built track models still restores
as built track models, and `tracks` holding trackIds is read as the request to
open them, which is how the two shapes coexist under one name.

**`init` is deprecated, and every surface uses the same wording.** A view
snapshot naming it is unwrapped on the way in, so the settings under it still
apply and a v4 `defaultSession` keeps working; the console names the spelling to
fix, and `jbrowse validate` reports it as a warning and checks the keys inside
it the way it checks the flat ones:

```text
LinearGenomeView nests its settings under "init", which is deprecated: write every setting directly on the view object.
```

Where a key is written both ways, the flat one wins, so a config can be migrated
one key at a time. Plan on the nesting being read for v5 and not beyond it.

One `init` survives and is unrelated: the `createViewState({ init })` option in
`@jbrowse/react-linear-genome-view2` and `@jbrowse/react-circular-genome-view2`.
That is a function argument the product hands to the view it builds, not a key
on a view object, and it is unchanged.

`BreakpointSplitView`'s `init` was a bare array of panels, the one view whose
`init` was not an object. Write those panels as `views`, the key a session spec
and a `jb2export --spec` already used; the bare array is still read, since a
positional list under `init` can only be the row list.

Two behavior changes have no migration:

- **A pre-`levels` `LinearSyntenyView` session**, one with a top-level `tracks`
  array of built track snapshots, the form that predates synteny levels, is now
  read as a request to open those tracks instead of being converted to
  `levels[0]`. Write `levels: [{ "tracks": [...] }]` instead.
- **`coord: { ratio: 1 }` re-fits on launch.** Setting it in a spec latched the
  shared zoom limit without re-zooming the rows, so rows placed by `loc`, and
  rows after an `autoDiagonalize`, kept a scale the mode rules out. Restoring a
  saved session still only latches, since those rows already hold a window.

## Extension points changed shape

A point whose `args` are an array is now registered through
`contributeToExtensionPoint`, whose callback takes only the props and returns
its entries, with `undefined` meaning "nothing from me", instead of being handed
everyone else's array and trusted to hand it back. The old form let a callback
return a bare entry, or a single-element array, and drop every other plugin's
contribution without an error; both look correct in an install where theirs is
the only plugin registered. Passing such a point to `addToExtensionPoint` is now
a type error that names the method to use, unless the call pins a type argument,
which keeps the older arity compiling and skips the check with it.
`addExtensionElement` and `addExtraTrackMenuItems` moved with it.

The UI points went the other way, from one helper per point to one mechanism per
kind of slot. A single-component slot — `Core-replaceWidget`,
`Core-replaceAbout`, the desktop start-screen panels — is filled with
`wrapComponent`, which hands your component whatever fills the slot so far, so
replacing is wrapping without rendering what you were handed and wrappers from
two plugins nest instead of one disappearing. Which tracks any of them applies
to is `matchesTrackSelector`, one predicate your contribution asks before it
draws, and it reads a track config as readily as a widget model. An About panel
therefore gets the copy-safe `trackId` matching only feature panels used to
have. Both come from `@jbrowse/core/ui`, and between them they replace
`addFeaturePanel`, `addReplaceWidget` and `addWidgetWrapper`.

Extending a view or display now has a separate entry point.
`Core-extendPluggableElement` fires for every kind of pluggable element there
is, so a callback had to match a name, assert the element was the kind that name
implies, and remember to return it. `extendViewType` / `extendDisplayType` check
the group and the name against a registry instead, so the state model arrives
typed and a typo is a compile error rather than an extension that stops applying
with no error. `addViewMenuItems` / `addDisplayMenuItems` sit on top of those,
so appending a menu item no longer means replacing someone else's state model
and remembering to hand their items back.

See [](/docs/developer_guides/extension_points) for the current API.

## A state model is a lazy loader, so extending one is asynchronous

Most view and display state models are registered as loaders now, fetched when a
session first names the type rather than at plugin install. The model is
therefore **not there yet** at install or configure time, and the `stateModel`
getter on a lazy `ViewType` or `DisplayType` throws until the loader resolves,
naming the `loadStateModel()` call to await. The v4 idiom run from `install` or
`configure` breaks on it:

```js
// v4 — throws for a lazy element when run before its model loads
pluggableElement.stateModel = pluggableElement.stateModel.extend(self => ({
  views: {
    menuItems() {
      /* ... */
    },
  },
}))
```

Call `extendStateModel` instead. It applies your function inline when the model
is already loaded and queues it for the loader otherwise, so one call is correct
either way:

```js
// v5
pluggableElement.extendStateModel(stateModel =>
  stateModel.extend(self => ({
    views: {
      menuItems() {
        /* ... */
      },
    },
  })),
)
```

Not every type is lazy — `LinearGenomeView` is registered eagerly — so a bundle
tested only against eager types can pass and still throw on a lazy one.
`extendViewType` / `extendDisplayType` do this for you, and are the better
choice if you are touching the code anyway.

`Core-extendPluggableElement` fires when the loader resolves rather than at
install, so the v4 idiom inside that callback still sees a loaded model and
works. The one exception is a callback that changes something the host reads
before any model loads (a display's `configSchema`): it runs too late for a lazy
element and has no effect, and raises no error.

### Opening a view or a track is asynchronous too

The session API uses the lazy loaders too. Each v4 call still exists, and the
second column shows what it does when the model is not loaded:

<!-- prettier-ignore -->
| The v4 call | Without a loaded model | The v5 call |
| --- | --- | --- |
| `session.addView('DotplotView', snap)` | throws, naming the type | `await session.launchView('DotplotView', snap)` |
| `view.showTrack(trackId)` | starts the load and returns `undefined`, so the track appears a tick later and a synchronous caller gets nothing back | `await view.launchTrack(trackId)` |
| `view.toggleTrack(trackId)` | same | `await view.launchToggleTrack(trackId)` |
| `pluginManager.getViewType(name).stateModel` | throws, naming the loader | `await pluginManager.getViewType(name).loadStateModel()` |
| `pluginManager.getDisplayType(name).stateModel` | throws, naming the loader | `await pluginManager.getDisplayType(name).loadStateModel()` |

When you cannot await, call `isStateModelLoaded`, the check `addView` makes
before throwing.

The embedded products follow the same split. The circular product's
`createViewState` is async, and `createViewStateAsync` is the same function
under the name the other products use. The linear and app products keep a
synchronous `createViewState` and add an async `createViewStateAsync`.

## The `Launch view` menu is now `Launch`

The submenu that `pushLaunchViewMenuItem` collects contributions under is
labelled `Launch`, because half of what it opens is no longer a view. The
function keeps its name, pinned by the re-export ABI so a published bundle reads
it off the host at module scope, and contributions still go to one place. The
rename matters only where you spelled the label yourself. That is usually a test
walking a menu, where the failure reads as "my item was never added" rather than
"the submenu is called something else". Import `LAUNCH_LABEL` from
`@jbrowse/core/ui` rather than repeating the string.

## `@jbrowse/plugin-canvas` is `@jbrowse/plugin-features`

The plugin that provides `FeatureTrack` and its `LinearBasicDisplay` is
published as `@jbrowse/plugin-features` and registers as `FeaturesPlugin`. Code
importing `@jbrowse/plugin-canvas` or calling
`pluginManager.hasPlugin('CanvasPlugin')` needs the new names, as do these
exports:

- `linearCanvasBaseDisplayConfigSchemaFactory` →
  `linearFeatureBaseDisplayConfigSchemaFactory`
- `LinearCanvasBaseDisplayModel` → `LinearFeatureBaseDisplayModel`
- `LinearCanvasBaseDisplayConfigModel` → `LinearFeatureBaseDisplayConfigModel`
- `CanvasFeatureRenderingBackend` → `FeatureRenderingBackend`

The RPC methods `GetCanvasFeatureDetails` and `GetCanvasGroupByCandidates` are
now `GetBasicFeatureDetails` and `GetBasicGroupByCandidates`.

## Removals with no replacement

**dockview is gone from the workspace.** `useDockviewController`,
`DockviewLayout`, `DockviewContext`, both header-action components,
`JBrowseViewTab`, `JBrowseViewPanel` and the `dockview-react` dependency itself
were deleted when the layout became an MST tree. A plugin that imports any of
them, or calls dockview's imperative api, finds them absent. There is
deliberately no snapshot migration: MST ignores properties a model no longer
declares, so a session holding `dockviewLayout` or `panelViewAssignments` loads
without error and every view survives, and only the arrangement is lost.

**The workspace is always on.** The session's `useWorkspaces`,
`effectiveUseWorkspaces`, `defaultUseWorkspaces`, `setUseWorkspacesPreference`
and `resetUseWorkspaces`, the `configuration.preferences.useWorkspaces` slot,
and product-core's `workspacesMenuItem` and `bakeSessionCascades` are gone.
`setUseWorkspaces` remains and does nothing. A session saved with
`useWorkspaces: false` opens as the stack it showed.

**The LD display's `showRecombination` option was removed.** It plotted `1 - r2`
between adjacent SNPs and called it a recombination rate, which restated the
triangle's first off-diagonal on an axis of allele frequency.

**The `lollipop` plugin was removed.** A `LinearLollipopDisplay` in a v4 config
is dropped with a console warning, and its track opens on its default display.

**The `arc` plugin was removed.** `LinearArcDisplay` and
`LinearPairedArcDisplay` migrate to the mark display, where an arc is a `link`
mark, and the `logThickness` and `defaultPairedArcColor` jexl functions went
with them. A plugin importing `@jbrowse/plugin-arc` fails to resolve it.

**The CommonJS plugin format was removed.** A plugin entry naming `cjsUrl` fails
to load, naming that plugin. Point it at `umdUrl` or `esmUrl`. Desktop was the
only host that loaded `cjsUrl`, and no store plugin published a CJS build.

**Text search adapters no longer take `textSearchAdapterId`.** A config that
still has the key loads and ignores it. The search manager caches an adapter by
a hash of its config, so an edited index loads fresh.

**`SNPCoverageAdapter`, `LinearComparativeDisplay`, `BasicTrack` and
`LinearBareDisplay` are no longer registered**, and no migration maps them to a
replacement.

**`@gmod/gff-nostream`'s record parser** now returns `{ feature, record }` pairs
(the tabix adapter reads it as `parseRecordsLazy`), and the opaque `_lineHash`
that used to be stamped onto `feature.data` is gone: the adapter derives a
stable per-feature id from the byte offset on its record. Plugin code reading
`_lineHash` off feature data gets `undefined`.

## What to check in your own plugin

Changes to four surfaces raise no error: the re-export ABI, the session, the
accumulating extension points, and a `configSchema` change made from
`Core-extendPluggableElement` on a lazily loaded type. A plugin that hits any of
them keeps loading and stops doing part of its job, so run your bundle against a
v5 build rather than trusting that it still loads, and click the menus you
contribute to rather than only the ones your own tests build.

A few things built during development were removed before release, so you may
have seen them in branch history: an in-tree pangenome/GFA graph-genome viewer
and tube-map view (the graph view is now the external
[`jbrowse-plugin-graphgenomeviewer`](/docs/user_guides/graph_genome_view)), and
a large multi-genome HPRC synteny dataset.

We would especially like to hear about anything that regressed from v4. Open an
issue on [GitHub](https://github.com/GMOD/jbrowse-components/issues) or write to
jbrowse2@berkeley.edu.
