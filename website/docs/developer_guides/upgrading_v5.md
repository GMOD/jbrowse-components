---
title: Upgrading to v5
description: What changed for plugin authors and embedders in JBrowse 2 v5.0.0
guide_category: Plugins
---

**TL;DR:** Sessions and configs from v4 migrate automatically. Plugins do not:
the renderer registry is gone, names left the `@jbrowse/core/*` re-export ABI,
config models were flattened, display types collapsed, and the extension point
APIs changed shape. Run your bundle against a v5 build before your users do.

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
nobody is going to rebuild, which is the quietest failure on this page. The
table is what the 4.3.0 package served and this build does not:

<!-- BEGIN GENERATED ABI_REMOVED_NAMES -->

48 names over 55 entries, since 7 of them were served from two modules each.

<!-- prettier-ignore -->
| What went | Names |
| --- | --- |
| the renderer registry | `RendererType`, `FeatureRendererType`, `BoxRendererType`, `CircularChordRendererType`, `ServerSideRendererType`, `GlyphType`, `getParentRenderProps` |
| layout, which moved onto the GPU packing path | `PileupLayout`, `SceneGraph`, `calculateLayoutBounds`, `getLayoutId`, `MultiLayout`, `PrecomputedLayout` |
| `AbortSignal` cancellation, which became stop tokens | `abortBreakPoint`, `checkAbortSignal`, `observeAbortSignal`, `makeAbortableReaction` |
| the renderer era's RPC retry and progress reporting | `RetryError`, `isRetryException`, `updateStatus2`, `getProgressDisplayStr`, `getStatsId` |
| desktop file handles, which the desktop package now owns | `getFileHandleCache`, `setFileHandleCache`, `removeFileHandle`, `cleanupStaleHandles`, `getPendingFileHandleIds`, `setPendingFileHandleIds`, `clearPendingFileHandleIds`, `restorePendingFileHandles` |
| renames with a survivor | `contrastingTextColor` → `makeContrasting`, `checkStopToken2` → `checkStopToken`, `assembleLocStringFast` → `assembleLocString`, `findLast` → `Array.prototype.findLast`, `findLastIndex` → `Array.prototype.findLastIndex` |
| react-dom, which a rendering library should not ask its host for — react-msaview owns its copy from 71e835ae, so published `jbrowse-plugin-msaview` 3.4.0 and `-tview` 2.2.1 break until they ship a build carrying it | `renderToStaticMarkup` |
| names with no caller left in core, which the last callers inlined or folded away | `forEachWithStopTokenCheck`, `TextSearchManager`, `isContainedWithin`, `iterMap`, `when`, `blobToDataURL`, `cartesianToPolar`, `degToRad`, `getUriLink`, `defaultStops`, `useDebouncedCallback` |
| the config models that were flattened | `isConfigurationSlotType` |

<!-- END GENERATED ABI_REMOVED_NAMES -->

`scripts/check-published-plugins.ts` reads every bundle in the plugin store and
reports what each one actually takes off the host; `abi-watch.yml` refreshes
that answer weekly. A store entry declaring `jbrowseRange: "*"` is offered to a
v5 user as compatible whatever its state here.

<!-- BEGIN GENERATED ABI_PLUGIN_BREAKS -->

4 of the 14 plugins in the store break against this build.

<!-- prettier-ignore -->
| Plugin | What breaks |
| --- | --- |
| Apollo | `@jbrowse/core/util#isContainedWithin`<br />`@jbrowse/core/util/tracks#getParentRenderProps`<br />`worker eval: TypeError: Cannot read properties of undefined (reading 'createElement')` |
| Ideogram | `worker eval: ReferenceError: window is not defined` |
| MsaView | `@jbrowse/core/util#renderToStaticMarkup` |
| TView | `@jbrowse/core/util#renderToStaticMarkup` |

<!-- END GENERATED ABI_PLUGIN_BREAKS -->

A `worker eval:` line is a different failure from the rest of this page, and not
one an ABI change can reach: the bundle threw while the RPC worker evaluated it,
reading the DOM at module scope. Only the plugin can fix that.

## Subpaths removed from `@jbrowse/core`

The deep-import surface: `import QuickLRU from '@jbrowse/core/util/QuickLRU'`
resolves through the `exports` map in `@jbrowse/core`'s `package.json`, and a
subpath that map no longer serves fails to resolve at your next build. A bundle
you already published inlined the module and keeps working. Where the code
merely moved, the entry says which import to use instead.

<!-- BEGIN GENERATED ABI_REMOVED_SUBPATHS -->

16 subpaths the published `exports` map no longer serves, against what 4.3.0
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

<!-- END GENERATED ABI_REMOVED_SUBPATHS -->

The map is generated from in-repo import sites
(`packages/core/scripts/generateExports.mjs`), so a subpath leaves it whenever
its last in-repo importer does, with nobody deciding to drop it.

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
  - `addTrackConf` — **still there, writing somewhere else.** It wrote the
    jbrowse config in v4; it is a deprecated alias of `addSessionTrackConf` now,
    so the track lives for the session rather than landing in the `config.json`
    every visitor is served. Say which you mean: `addSessionTrackConf` for a
    track your plugin stands up on the user's behalf, `publishTrackConf` for an
    Add-track workflow where an admin means to add it for the whole site
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
- A snapshot or URL spec naming `bpPerPx`/`offsetPx` is still accepted.
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

## A view says when it does not know a key

v4 dropped an undeclared key on a view snapshot silently: no error, no warning,
the view rendered its default. A `defaultSession` written with a setting one
level out from where it belonged therefore shipped looking correct and behaving
wrong, and several published demos did.

Every view type now reports one. The key is kept rather than discarded, and the
view names it once on attach, in the console and in a notification:

```
LinearGenomeView ignored unknown key(s): asembly
```

Nothing about a correct snapshot changed, and a view whose only unrecognized key
is a typo still opens — on its import form, saying why, rather than waiting on
data that is never coming.

## Every setting goes directly on the view object

A view carried two authoring shapes in v4, and which one was correct depended on
where you were writing. Flat on the view is what a session spec, a URL and a
jbrowse-img spec took; nested under `init` is what a `defaultSession` took.
Nothing said so at the point of writing.

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

The same object works in a `defaultSession`, in a `?session=spec-` URL, in
`addView` and in an embedded `createViewState`. A view snapshot restored from a
saved session is unaffected: `tracks` holding built track models still restores
as built track models, and `tracks` holding trackIds is read as the request to
open them, which is how the two shapes coexist under one name.

**`init` is deprecated, and every surface says so in the same words.** A view
snapshot naming it is unwrapped on the way in, so the settings under it still
apply and a v4 `defaultSession` keeps working; the console names the spelling to
fix, and `jbrowse validate` reports it as a warning and checks the keys inside
it the way it checks the flat ones:

```
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

Two behavior changes carry no migration:

- **A pre-`levels` `LinearSyntenyView` session** — one with a top-level `tracks`
  array of built track snapshots, the shape that predates synteny levels — is
  now read as a request to open those tracks rather than converted to
  `levels[0]`. Write `levels: [{ "level": 0, "tracks": [...] }]` instead.
- **`sameScale` re-fits on launch.** Setting it in a spec latched the shared
  zoom limit without re-zooming the rows, so rows placed by `loc`, and rows
  after an `autoDiagonalize`, kept a scale the mode said they should not have.
  Restoring a saved session still only latches, since those rows carry their own
  window.

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

## A state model is a lazy loader, so extending one is asynchronous

View and display state models are registered as loaders now, fetched when a
session first names the type rather than at plugin install. The model is
therefore **not there yet** when your extension runs, and the `stateModel`
getter on a `ViewType` or `DisplayType` reads `undefined` until the loader
resolves. The v4 idiom breaks on it:

```js
// v4 — throws, or silently extends nothing, depending on the element
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

This is the quietest breakage in this guide. Not every type is lazy — a plugin
extending an eagerly registered one keeps working — so a bundle can pass its own
tests and lose only the menu items it contributes to a lazy display, with no
error anywhere. `extendViewType` / `extendDisplayType` do this for you, and are
the better road if you are touching the code anyway.

`Core-extendPluggableElement` fires when the loader resolves rather than at
install, so a callback that only extends a state model still sees a loaded one.
A callback that changes something the host reads before any model loads — a
display's `configSchema` — runs too late for a lazy element.

### Opening a view or a track is asynchronous too

The same loader sits under the session's own API. Each v4 call still exists, and
what it does when the model is not loaded is the second column:

<!-- prettier-ignore -->
| The v4 call | Without a loaded model | The v5 call |
| --- | --- | --- |
| `session.addView('DotplotView', snap)` | throws, naming the type | `await session.launchView('DotplotView', snap)` |
| `view.showTrack(trackId)` | starts the load and returns `undefined`, so the track lands a tick later and a synchronous caller gets nothing back | `await view.launchTrack(trackId)` |
| `view.toggleTrack(trackId)` | same | `await view.launchToggleTrack(trackId)` |
| `pluginManager.getViewType(name).stateModel` | `undefined` | `await pluginManager.getViewType(name).loadStateModel()` |
| `pluginManager.getDisplayType(name).stateModel` | `undefined` | `await pluginManager.getDisplayType(name).loadStateModel()` |

`isStateModelLoaded` is the question to ask when you cannot await: it is what
`addView` checks before throwing.

## The `Launch view` menu is now `Launch`

The submenu that `pushLaunchViewMenuItem` collects contributions under is
labelled `Launch`, because half of what it opens is no longer a view. The
function keeps its name — it is pinned by the re-export ABI, so a published
bundle reads it off the host at module scope — and contributions still land in
one place, so this matters only where you spelled the label yourself. That is
usually a test walking a menu, where the failure reads as "my item was never
added" rather than "the submenu is called something else". Import `LAUNCH_LABEL`
from `@jbrowse/core/ui` rather than repeating the string.

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

**`LinearSyntenyView` no longer has `drawCurves` or `drawLocationMarkers`.**
Both are promotable config slots on `LinearSyntenyDisplay` now, so the settings
menu, the pin, the config editor's reset and `displayDefaults` all reach them
through one mechanism. Authoring them keeps working — a session spec, a
`defaultSession`, a share link or `--drawCurves` in jbrowse-img writes the slot
on the tracks the launcher opens — but as a **view property** in a saved session
they are gone, and MST drops a property a model no longer declares, so such a
session loads without error and draws straight chords. Re-author the value in
the track's `displays` block, or set it from the view's settings menu.

**`gff-nostream`'s record parser** now returns `{ feature, record }` pairs — the
tabix adapter reads it as `parseRecordsLazy` — and the opaque `_lineHash` that
used to be stamped onto `feature.data` is gone: the adapter mints its stable
per-feature id from the byte offset on its own record. Plugin code reading
`_lineHash` off feature data has nothing to read.

## What to check in your own plugin

Four surfaces fail quietly rather than loudly — the re-export ABI, the session,
the accumulating extension points, and a lazily loaded state model you extended
the v4 way. A plugin that hits any of them keeps loading and just stops doing
part of its job, so run your bundle against a v5 build rather than trusting that
it still loads, and click the menus you contribute to rather than only the ones
your own tests build.

A few things were built during development and removed before release, worth
knowing about if you saw them in branch history: an in-tree pangenome/GFA
graph-genome viewer and tube-map view (the graph view now lives in the external
[`jbrowse-plugin-graphgenomeviewer`](/docs/user_guides/graph_genome_view)), and
a large multi-genome HPRC synteny dataset.

We would especially like to hear about anything that regressed from v4. Open an
issue on [GitHub](https://github.com/GMOD/jbrowse-components/issues) or write to
jbrowse2@berkeley.edu.
