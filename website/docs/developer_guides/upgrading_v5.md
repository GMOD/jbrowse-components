---
title: Upgrading to v5
description: What changed for plugin authors and embedders in JBrowse 2 v5.0.0
guide_category: Plugins
---

**TL;DR:** Sessions and configs from v4 migrate automatically. Plugins do not:
the renderer registry is gone, 46 names left the `@jbrowse/core/*` re-export
ABI, config models were flattened, display types collapsed, and the extension
point APIs changed shape. Run your bundle against a v5 build before your users
do.

## For everyone

- **Web** — `jbrowse upgrade` updates an installation in place.
- **Desktop** — updates itself.
- **Embedded** — bump `@jbrowse/react-linear-genome-view` and friends to their
  v5 line.

A config from v4 loads as it is, and
[`jbrowse validate`](/docs/cli#jbrowse-validate) will tell you if it does not.

## Migrations that happen automatically

Most sessions and configs migrate through `preProcessSnapshot`:

- canvas `color1`/`color2`/`color3` become `color`/`connectorColor`/`utrColor`
- `outline` becomes `outlineColor`
- the old `autoHeight` boolean becomes `heightMode: 'grow'` on the unified
  height slot
- a v4 session's `heightPreConfig` migrates onto the `height` slot
- the alignments `insertSizeGradient` color scheme resolves to `insertSize`

The gradient is gone rather than migrated because it duplicated the scheme it
now maps to: same thresholds, same classifier, same buckets, and two endpoint
hues close enough that a half-ramped read on either side of the band came out
the same faint grey. The `heightOverride` shadow-prop that existed during
development is gone, and there is no `<name>Override` shadow-property system.

Highlight visibility is session-wide in v5 rather than per view, and the v4 keys
that expressed it are **not** migrated. A v4 session carrying a dismissed band —
the LGV's own `highlightsVisible`, or grid-bookmark's
`bookmarkHighlightsVisible`, both written out only when the user turned the band
off — reopens with the band visible, because MST drops a snapshot key the model
no longer declares. Dismissing it again is one click on the
"Bookmarks/highlights" toggle, and it now applies to every view at once. The
setting is the only thing lost; nothing about the session fails to load.

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

## RPC methods that no longer exist

An RPC method is addressed by string — `rpcManager.call(sessionId, name, args)`
— so a plugin naming one of these has nothing that resolves. Six went in v5,
alongside `CoreRender` above:

- `WiggleGetGlobalQuantitativeStats` and
  `WiggleGetMultiRegionQuantitativeStats`. There is no separate stats round trip
  any more: `RenderWiggleData` returns the per-region score arrays and the
  display derives its own domain from them, which is also what makes the new
  local-percentile autoscale possible.
- `MultiWiggleGetSources`. A multi-wiggle track's sources arrive on each
  region's `RenderMultiWiggleData` payload, so a source that only appears in the
  second region is picked up as that region lands.
- `MultiVariantGetSources` and `MultiVariantGetGenotypeMatrix` are
  `MultiSampleVariantGetSources` and `MultiSampleVariantGetGenotypeMatrix`.
- `MultiVariantGetFeatureDetails` read a feature back out of the renderer
  registry (`RendererType.getFeatureById`), so it went with the registry.
  `MultiSampleVariantGetCellData` answers the same question from the display's
  own data.

This is the one removal on this page that fails **loudly**: `getRpcMethodType`
bottoms out in a registry lookup that throws
`RpcMethodType 'X' is not registered`, names the method and lists what this
build does register — which is also the answer to "which plugin is missing".

## Names removed from the re-export ABI

Names left the `@jbrowse/core/*` re-export ABI — the modules an external plugin
resolves through `jbrequire`. A removed name is `undefined` inside a bundle
nobody is going to rebuild, which is the quietest failure on this page. They
fall into groups:

- the renderer registry (`RendererType`, `FeatureRendererType`,
  `BoxRendererType`, `CircularChordRendererType`, `ServerSideRendererType`,
  `GlyphType`, `getParentRenderProps`)
- layout, which moved onto the GPU packing path (`PileupLayout`, `SceneGraph`,
  `calculateLayoutBounds`, `getLayoutId`, `MultiLayout`, `PrecomputedLayout`)
- `AbortSignal` cancellation, which became stop tokens (`abortBreakPoint`,
  `checkAbortSignal`, `observeAbortSignal`, `makeAbortableReaction`)
- the renderer era's RPC retry and progress reporting (`RetryError`,
  `isRetryException`, `updateStatus2`, `getProgressDisplayStr`, `getStatsId`)
- desktop file handles, which the desktop package now owns
  (`getFileHandleCache`, `setFileHandleCache`, `removeFileHandle`,
  `cleanupStaleHandles`, `getPendingFileHandleIds`, `setPendingFileHandleIds`,
  `clearPendingFileHandleIds`, `restorePendingFileHandles`)
- renames with a survivor — `contrastingTextColor` is `makeContrasting`,
  `checkStopToken2` is `checkStopToken`, `assembleLocStringFast` is
  `assembleLocString`, `findLast`/`findLastIndex` are the `Array.prototype`
  methods
- `BaseTooltip`, which moved to its own `@jbrowse/core/ui/BaseTooltip` module to
  keep @floating-ui off the startup path
- names with no caller left in core, which the last callers inlined or folded
  away (`forEachWithStopTokenCheck`, `TextSearchManager`, `isContainedWithin`,
  `iterMap`, `when`, `blobToDataURL`, `cartesianToPolar`, `degToRad`,
  `getUriLink`, `defaultStops`, `useDebouncedCallback`)
- `isConfigurationSlotType`, with the config models that were flattened

That is 48 names over 55 entries, since 7 of them were served from two modules
each.

`scripts/check-published-plugins.ts` reads every bundle in the plugin store and
reports the names each one actually takes. One of the fourteen breaks against
this build: Apollo, on `BaseTooltip`, `isContainedWithin` and
`getParentRenderProps`. It declares `jbrowseRange: "*"`, so the store still
offers it to a v5 user as compatible.

## Subpaths removed from `@jbrowse/core`

The deep-import surface: `import QuickLRU from '@jbrowse/core/util/QuickLRU'`
resolves through the `exports` map in `@jbrowse/core`'s `package.json`, and a
subpath that map no longer serves fails to resolve at your next build. A bundle
you already published inlined the module and keeps working. Where the code
merely moved, the entry says which import to use instead.

- the renderer registry, whose modules went with the server-side render path:
  - `@jbrowse/core/pluggableElementTypes/GlyphType` — glyphs are drawn by the
    GPU displays, not registered
  - `@jbrowse/core/pluggableElementTypes/renderers/RendererType` — renderer
    registry removed; displays compose RenderLifecycleMixin + DisplayChrome
  - `@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType` —
    renderer registry removed
  - `@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType` — renderer
    registry removed
  - `@jbrowse/core/pluggableElementTypes/renderers/CircularChordRendererType` —
    renderer registry removed
  - `@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType` —
    renderer registry removed, core no longer renders on the server
  - `@jbrowse/core/pluggableElementTypes/renderers/LayoutSession` — the block
    layout cache the box renderer kept; layout moved onto the GPU packing path
  - `@jbrowse/core/pluggableElementTypes/renderers/util` — helpers for the
    classes above, deleted with them
- modules deleted outright, along with the code that reached them:
  - `@jbrowse/core/data_adapters/BaseAdapter/BaseOptions` — the adapter options
    bag, folded into `data_adapters/BaseAdapter` itself, which still exports
    `BaseOptions` and is still a published subpath
  - `@jbrowse/core/rpc/methods/util` — renderer-era RPC helpers, removed with
    `CoreRender`
  - `@jbrowse/core/util/offscreenCanvasUtils` — the server-side canvas helpers
    behind `renderToAbstractCanvas`
  - `@jbrowse/core/util/compositeMap` — dead, with no caller in or out of the
    tree
  - `@jbrowse/core/util/layouts/BaseLayout` — the interface `GranularRectLayout`
    implemented for `MultiLayout` and `PrecomputedLayout` to share; deleted with
    them, along with the serialization types (`SerializedLayout`, `RectTuple`)
    that only the worker-to-main layout handoff used
- modules that still exist, un-published because the last in-repo deep import
  went:
  - `@jbrowse/core/rpc/coreRpcMethods` —
    `packages/core/src/rpc/coreRpcMethods.ts` is alive and `CorePlugin` imports
    it relatively; nothing imports it by subpath any more
  - `@jbrowse/core/ui/ErrorMessage` — alive, and `@jbrowse/core/ui` still
    exports it as `ErrorMessage` — import it from the barrel
  - `@jbrowse/core/util/mst-reflection` — alive, and still served over
    `jbrequire` as `@jbrowse/core/util/mst-reflection`; only the deep-import
    path went

That is 16 subpaths the published `exports` map no longer serves. The map is
generated from in-repo import sites
(`packages/core/scripts/generateExports.mjs`), so a subpath leaves it whenever
its last in-repo importer does — this list is a one-time record of the ones that
already left, not a live check.

## Names removed from the session and from a plugin's `exports`

The surfaces a plugin reaches without importing anything, which is what makes
them quieter than the one above. A session member is looked up on an object at
runtime — often behind `'x' in session` — so removing one throws nothing at all
and the plugin simply stops asking. A plugin `exports` object is reached as
`pluginManager.getPlugin('X').exports.Y`, where a missing name is `undefined`
and calling it throws inside the reaching plugin's own `install`.

- **the session**, which a plugin reaches by member lookup (`'x' in session`)
  rather than by import, so nothing fails at build time:
  - `removeReferring` — deleted, along with the reference-clearing pass it
    drove; `undefined is not a function` at the call
  - `prepareToBreakConnection` — deleted with the "N tracks will close"
    pre-flight it computed; `breakConnection` now closes them without the
    confirmation step
  - `hasWidget` — deleted; the same question is `session.widgets.has(id)`, which
    is what it wrapped
  - `getReferring` — **still there, with a signature a v4 caller does not
    satisfy.** It takes a `trackId` string now, not the config object it used to
    take. A v4 caller passing the object reaches `getReferringMultiple`, which
    tests its `Set` of objects against `node[key]?.trackId` — a string — so
    every comparison misses and the answer is `[]`. Nothing throws: the caller
    concludes no view refers to the track and closes it out from under whatever
    was showing it
- **`@jbrowse/product-core`'s `Session` barrel**, which is a named allowlist now
  rather than `export *` over nine modules — so a name the allowlist omits is
  gone from the package even where its own module still declares it:
  - `DialogQueueSessionMixin` — `Session/DialogQueue.ts` was folded into
    `BaseSessionModel`, which declares `queueDialog`, `removeActiveDialog`,
    `DialogComponent` and `DialogProps` itself. The members survive on every
    session; the composable mixin does not, so a product assembling its own
    session from mixins has to compose `BaseSessionModel` for them
  - `isSessionWithDialogs` — same file. Every session that composes
    `BaseSessionModel` has the dialog members, so there is no longer a narrowing
    to do
  - `SessionWithDialogs` — same file; the mixin it was an `Instance` of is gone
  - `SessionWithDialogsType` — same file; it was the `ReturnType` of that mixin
- **`LinearGenomeViewPlugin.exports`**, reached at runtime as
  `pluginManager.getPlugin('LinearGenomeViewPlugin').exports.X`:
  - `BaseLinearDisplay` — the legacy block-render state model, removed with the
    server-side render path. A v4 plugin composing `exports.BaseLinearDisplay()`
    throws while its `install` runs, so its track type never registers and the
    user opens a saved session with the track simply absent
  - `BaseLinearDisplayComponent` — the React half of the same pair, and the last
    reader of the `DisplayMessageComponent` getter on `BaseDisplayModel`, which
    went with it. A display model no longer holds a React component at all
- **`@jbrowse/plugin-linear-genome-view`'s type exports**, which a plugin built
  against the published package imports rather than looking up at runtime — so
  these break a build, not a session:
  - `LayoutRecord` — the 4-tuple `[minX, minY, maxX, maxY]` the block layout
    handed back, exported from the plugin entry and the `BaseLinearDisplay`
    barrel with no consumer left in the tree. Its 5-tuple
    `LayoutFeatureMetadata` variant went with the floating-label code, so what
    was published in v5 was already the narrowed shape.
    `@jbrowse/plugin-breakpoint-split-view` declares an identical one of its own
    and still exports it, which is the import to move to
  - `Layout` — the named-rectangle interface beside it
    (`minX`/`minY`/`maxX`/`maxY`/`name`), declared in the same file and never
    exported past it or read anywhere

Neither surface is checked against a published bundle: `abi.test.ts` pins
`@jbrowse/core/*` module names and `scripts/check-published-plugins.ts` filters
its findings on that same prefix, so neither reaches a plugin `exports` object
or the session. `pluginFacingSessionApi.test.ts` pins the fifteen session
members published bundles actually call, and performs the call rather than just
asserting the member exists, which is why `getReferring`'s changed signature is
on this list rather than caught by a presence check. For everything else,
reading them here is the record.

## Display types collapsed

Pileup, SNPCoverage, ReadArcs and ReadCloud are now one
`LinearAlignmentsDisplay`, which registers the four old names as aliases and
migrates their settings across, so a saved config's `type:` still resolves. A
plugin that extended or referenced the old display classes directly needs
updating.

## Config models were flattened

Config slots are no longer each their own MST instance; one model holds many
slots in a flat layout, so plugin code calling `configSlot.set(value)` must use
`setConf(model, 'slotName', value)`. Not `configuration.setSlot`, which writes
past the resolution a promotable slot only gets through `resolveConf` — the lint
rule names it.

Config slots were also renamed. End-user JSON migrates automatically, but plugin
code that reads a renamed slot directly — `getConf(self, 'color1')` — needs
updating.

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
- A snapshot, URL spec or `init` naming `bpPerPx`/`offsetPx` is still accepted.
  `windowStartBp` converts exactly, and the scale rides to the first measure and
  is adopted at whatever width arrives — bit for bit what v4 did, so an old link
  keeps its old behavior rather than being reinterpreted. That covers the
  several places in the tree that build a view from such a snapshot (a synteny
  row, a split view), so none of them changed.

Two things did change:

- **`zoomTo` lost its third parameter.** It was
  `zoomTo(bpPerPx, offset, centerAtOffset)`; `centerAtOffset` was unread and is
  gone. A call passing three arguments now passes one the action does not take.
- **To frame a specific window, say so in bp.**
  `setWindow(windowWidthBp, windowStartBp)` is the action, and a snapshot naming
  `windowWidthBp` is restored as that window at any width. Building one out of
  `bpPerPx` means inventing a width for the scale to be relative to, which is
  what the old pair made unavoidable — `buildReadVsRefSpec` and
  `buildDerivativeVsRefSpec` both computed `bpPerPx: refLen / viewWidth` from a
  width threaded in from their caller, and both now say `windowWidthBp: refLen`
  and take no width at all.

## Extension points changed shape

A point whose `args` are an array is now registered through
`contributeToExtensionPoint`, whose callback takes only the props and returns
its own entries — `undefined` meaning "nothing from me" — instead of being
handed everyone else's array and trusted to hand it back. The old form let a
callback return a bare entry, or its own single-element array, and silently drop
every other plugin's contribution; both look correct in an install where theirs
is the only plugin registered. Passing such a point to `addToExtensionPoint` is
now a type error that names the method to use — unless the call pins its own
type argument, which keeps the older arity compiling and skips the check with
it. `addExtensionElement` and `addExtraTrackMenuItems` moved with it.

The UI points went the other way, from one helper per point to one mechanism per
shape. A single-component slot — `Core-replaceWidget`, `Core-replaceAbout`, the
desktop start-screen panels — is filled with `wrapComponent`, which hands your
component whatever fills the slot so far, so replacing is wrapping without
rendering what you were handed and wrappers from two plugins nest instead of one
disappearing. Which tracks any of them applies to is `matchesTrackSelector`, one
predicate your contribution asks before it draws, and it reads a track config as
readily as a widget model — so an About panel now gets the copy-safe `trackId`
matching only feature panels used to have, and so does `Core-customizeAbout`,
which renders nothing at all. Both come from `@jbrowse/core/ui`, and between
them they replace `addFeaturePanel`, `addReplaceWidget` and `addWidgetWrapper`.

Extending a view or display has its own entry point now.
`Core-extendPluggableElement` fires for every kind of pluggable element there
is, so a callback had to match a name, assert the element was the kind that name
implies, and remember to return it. `extendViewType` / `extendDisplayType` check
the group and the name against a registry instead, so the state model arrives
typed and a typo is a compile error rather than an extension that silently stops
applying. `addViewMenuItems` / `addDisplayMenuItems` sit on top of those, so
appending a menu item no longer means replacing someone else's state model and
remembering to hand their items back.

See [](/docs/developer_guides/extension_points) for the current API.

## Removals with no replacement

**dockview is gone from the workspace.** `useDockviewController`,
`DockviewLayout`, `DockviewContext`, both header-action components,
`JBrowseViewTab`, `JBrowseViewPanel` and the `dockview-react` dependency itself
were deleted when the layout became an MST tree. A plugin reaching for any of
them, or for dockview's imperative api, has nothing to reach. There is
deliberately no snapshot migration: MST ignores properties a model no longer
declares, so a session holding `dockviewLayout` or `panelViewAssignments` loads
without error and every view survives — only the arrangement does not.

**The LD display's `showRecombination` lane was removed.** It plotted `1 - r2`
between adjacent SNPs and called it a recombination rate, which restated the
triangle's own first off-diagonal on an axis of allele frequency.

**The `lollipop` plugin was removed.** A `LinearLollipopDisplay` track in a v4
config no longer resolves.

**`gff-nostream`'s record parser** now returns `{ feature, record }` pairs — the
tabix adapter reads it as `parseRecordsLazy` — and the opaque `_lineHash` that
used to be stamped onto `feature.data` is gone: the adapter mints its stable
per-feature id from the byte offset on its own record. Plugin code reading
`_lineHash` off feature data has nothing to read.

## What to check in your own plugin

Three surfaces fail quietly rather than loudly — the re-export ABI, the session,
and the accumulating extension points. A plugin that hits any of them keeps
loading and just stops doing part of its job, so run your bundle against a v5
build rather than trusting that it still loads.

A few things were built during development and removed before release, worth
knowing about if you saw them in branch history: an in-tree pangenome/GFA
graph-genome viewer and tube-map view (the graph view now lives in the external
[`jbrowse-plugin-graphgenomeviewer`](/docs/user_guides/graph_genome_view)), and
a large multi-genome HPRC synteny dataset.

We would especially like to hear about anything that regressed from v4. Open an
issue on [GitHub](https://github.com/GMOD/jbrowse-components/issues) or write to
jbrowse2@berkeley.edu.
