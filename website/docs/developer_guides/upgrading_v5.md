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

`jbrowse upgrade` updates a web installation in place; Desktop updates itself;
embedded users bump `@jbrowse/react-linear-genome-view` and friends to their v5
line. A config from v4 loads as it is, and
[`jbrowse validate`](/docs/cli#jbrowse-validate) will tell you if it does not.

## Migrations that happen automatically

Most sessions and configs migrate through `preProcessSnapshot`:

- canvas `color1`/`color2`/`color3` become `color`/`connectorColor`/`utrColor`
- `outline` becomes `outlineColor`
- the old `autoHeight` boolean becomes `heightMode: 'grow'` on the unified
  height slot
- a v4 session's `heightPreConfig` migrates onto the `height` slot
- the alignments `insertSizeGradient` color scheme resolves to `insertSize`

The gradient is gone rather than migrated because it was a worse spelling of the
scheme it now maps to: same thresholds, same classifier, same buckets, and two
endpoint hues close enough that a half-ramped read on either side of the band
came out the same faint grey. The `heightOverride` shadow-prop that existed
during development is gone, and there is no `<name>Override` shadow-property
system.

## The renderer registry is gone

`CoreRender` RPC, the renderer registry, and the server-side renderer and canvas
classes were removed — core no longer renders on the server. A plugin that
registered a custom `RendererType` or hooked into that pipeline has to be
rewritten against [](/docs/developer_guides/creating_gpu_display)
(`RenderLifecycleMixin` and `DisplayChrome`), and there is no compatibility
shim. This is the most painful part of the upgrade for plugin authors with
custom renderers.

In practice the affected set is small: the significant custom renderers were
ones we wrote ourselves, now vendored into core plugins, plus two known external
ones, `jbrowse-plugin-gwas-hoot` and `NucContent`.

## Names removed from the re-export ABI

Names left the `@jbrowse/core/*` re-export ABI — the modules an external plugin
resolves through `jbrequire`. A removed name is `undefined` inside a bundle
nobody is going to rebuild, which is the quietest failure on this page. They
fall into groups:

<!-- BEGIN GENERATED ABI REMOVALS -->

- the renderer registry (`RendererType`, `FeatureRendererType`,
  `BoxRendererType`, `CircularChordRendererType`, `ServerSideRendererType`,
  `GlyphType`, `getParentRenderProps`)
- layout, which moved onto the GPU packing path (`PileupLayout`, `SceneGraph`,
  `calculateLayoutBounds`, `getLayoutId`)
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

That is 46 names over 53 entries, since 7 of them were served from two modules
each. Every one is recorded with its reason in `REMOVAL_GROUPS` in
`packages/core/src/ReExports/knownRemovals.ts`, and checked on every run against
the exports of the previously published package.
<!-- END GENERATED ABI REMOVALS -->

`scripts/check-published-plugins.ts` reads every bundle in the plugin store and
reports the names each one actually takes. One of the fourteen breaks against
this build: Apollo, on `BaseTooltip`, `isContainedWithin` and
`getParentRenderProps`. It declares `jbrowseRange: "*"`, so the store still
offers it to a v5 user as compatible.

## Names removed from the session and from a plugin's `exports`

Two more surfaces a plugin reaches, and both are quieter than the one above. A
session member is looked up on an object at runtime — often behind
`'x' in session` — so removing one throws nothing and the plugin simply stops
asking. A plugin `exports` object is reached as
`pluginManager.getPlugin('X').exports.Y`, where a missing name is `undefined`
and calling it throws inside the reaching plugin's own `install`.

<!-- BEGIN GENERATED SESSION AND PLUGIN REMOVALS -->

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

Each is recorded with its reason in `SESSION_AND_PLUGIN_REMOVALS` in
`packages/core/src/ReExports/knownRemovals.ts`. Unlike the list above, nothing
checks these against a published bundle: `abi.test.ts` pins `@jbrowse/core/*`
module names and `scripts/check-published-plugins.ts` filters its findings on
that same prefix, so a plugin `exports` object is observed by nothing at all and
the session only by the members `pluginFacingSessionApi.test.ts` performs.
Reading them here is the check.
<!-- END GENERATED SESSION AND PLUGIN REMOVALS -->

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

## Extension points changed shape

A point whose `args` are an array is now registered through
`contributeToExtensionPoint`, whose callback takes only the props and returns
its own entries — `undefined` meaning "nothing from me" — instead of being
handed everyone else's array and trusted to hand it back. The old form let a
callback return a bare entry, or its own single-element array, and silently drop
every other plugin's contribution; both look correct in the only install their
author can easily check, because theirs is the only plugin registered. Passing
such a point to `addToExtensionPoint` is now a type error that names the method
to use — unless the call pins its own type argument, which keeps the older arity
compiling and skips the check with it. `addExtensionElement` and
`addExtraTrackMenuItems` moved with it.

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
between adjacent SNPs and called it a recombination rate, which is the triangle
drawn under it restating its own first off-diagonal on an axis that is allele
frequency rather than recombination.

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
