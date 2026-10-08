---
name: view-init
description:
  How does a view take its launch input, and how does one view open another on
  a region? Covers the withLaunchInput partition, launch state machine, loading
  gates and the "open view X for this locus" convention. Read when touching view
  launch, URL params or createViewState.
kind: spec
---

# View launch

Every surface — URL params, a session spec, a config `defaultSession`, an
`addView` literal, embedded `createViewState` — hands the view **one object**,
and one processing path turns it into state.
[ADR-099](../architecture-decision-records/adr-099-a-view-takes-one-authored-object.md)
records why, and the per-surface shapes it retired; read it before proposing
that a surface get its own shape back. The region-launch half starts at
"Launching a view on a region".

## One object, every surface

`withLaunchInput` (`packages/core/src/util/withLaunchInput.ts`) splits the view
object at snapshot time. A key naming something to resolve — `loc`, `tracks`,
`highlight` — moves into the internal `launch` blob, applied once and cleared.
Everything else stays on the snapshot, where MST validates it against the
registered view type's property list (including a property `extendViewType`
composes). **Declaring a property is declaring it authorable**; no per-setting
arm exists to forget.

## An assembly name read off a track config: canonical, **and** screened

Any assembly name from a track config's `assemblyNames` reaching an
**`AssemblySelector` value** or a **view's launch input** must be:

- **canonical** — `canonicalAssemblyNames` (`@jbrowse/core/util/tracks`).
  `AssemblySelector` silently blanks a value that is not one of the session's
  own `assemblyNames`.
- **present** — `assemblyManager.has`, never
  `getCanonicalAssemblyName(...) !== undefined`. A missing name sets the view's
  error, and `showImportForm` replaces the user's stack with an import form.

## The partition

`withLaunchInput` is a `preProcessSnapshot` and it is **pure**: a session's view
type is a `types.union`, so MST runs every member's preprocessor against every
candidate snapshot, and a warning from there fires for view types the author
never wrote. `afterAttach`, reached only by the snapshot that won, reports what
the partition captured (`reportUnknownKeys`, `reportMalformedRows`).

- **`.preProcessSnapshot` with a terminal cast, never `types.snapshotProcessor`**,
  which stops being a `ModelType` — `PluginManager.pluggableMstType` then drops
  the view from the session's view union without a word.
- **Order.** MST runs preprocessors in reverse of the order added, so this goes
  on the chain BEFORE a view's own legacy-key preprocessor.
- **The widening cast is the last link that may change the creation type.** It
  replaces `CustomC`, so a `.props()` added after it is invisible to
  `SnapshotIn`.

**The URL wire layer restates the param list.** `LgvUrlInit` is an all-string
shape, and app-core cannot import the LGV plugin, so adding a URL param means
touching both it and `InitState`. jbrowse-web's `buildLgvInit` is annotated with
the real type, and that is where the two are checked against each other.

## The shared state machine

### Mid-apply waits, and why there is no timeout

`apply` gets `{ superseded }` — true once the node is gone or a newer
`setLaunch` replaced this input. Any wait inside `apply` that can park
indefinitely **must** fold it in:

```ts
await when(() => superseded() || cond() || !!self.error) // waiting on SELF
await whenViewsSettled(self.views, superseded) // rows that carry no launch
```

**`whenViewSettled(self, superseded)` is not the first of those.** Its
`pendingLaunch === undefined` term cannot go true inside your own `apply`,
because the blob clears only after `apply` returns.

A fixed timeout is not a substitute: it expires on a slow-but-healthy load and
silently drops the navigation. **One timer survives deliberately**: LGV's
`openTracklist` waits for a width change that never comes in embedded and
modal-drawer layouts. Use MobX's `when(..., { timeout })`, which disposes its
timer, never `Promise.race([when(cond), setTimeout])`, whose losing timer
outlives the race.

## The loading state machine (`model.ts` getters)

Every gate reads `pendingLaunch(self.launch)`, never the raw property: **a
snapshot whose only launch content was a typo (`asembly`, `veiws`) has nothing
to launch**, and a view that thought otherwise would wait on an assembly nobody
named. It returns the blob itself, never a copy, because the autorun clears by
identity. `awaitingInitNavigation` is `!!pendingLaunch && !hasDisplayedRegions`,
not the comparative views' `initPending`, which is the bare `!!pendingLaunch`.

## A nested view's `bodyMounted` reads true while it is out of the DOM

`ViewContainer`'s effect is the only writer of `bodyMounted`, and it never
reaches a view nested in another view's rows (synteny rows, breakpoint panels),
so every display inside waits for a paint nothing will make. Readiness asks
`effectiveBodyMounted` (`BaseViewModel`), which folds in every enclosing view;
`computeActivityPhase` takes it as the `hostMounted` thunk. A view collapsed to
its ruler (`scalebarOnly`, synteny rows after `compactAllViews`) says it renders
no displays through the `rendersDisplays` hook, folded in for that view alone.

## Verified in a browser

jsdom cannot see a view that comes up blank or parks on a readiness gate.
`products/jbrowse-web/browser-tests/probe-view-launch-surfaces.ts` drives each
view type on each surface against the built app. A `CircularView` body is not
bit-stable between loads, so the probe compares SVG body pixel counts within a
tolerance and every canvas count exactly.

## Launching a view on a region

**Take a locus in a linear view, open a different kind of view on it, sourced
from some track.** Linear synteny does this in
`plugins/linear-comparative-view/src/LaunchSyntenyView/`; the graph plugin's
launcher came first and synteny follows its convention (since plugin 4.0.0 the
graph is a track of the linear view and launches nothing).

### The convention

1. **Hook `Core-extendPluggableElement`**, not a display-specific seam. Override
   `menuItems()` (visible region) and/or `rubberBandLaunchMenuItems()`
   (selection) on `LinearGenomeView`; override `trackMenuItems()` or
   `contextMenuItems()` on a `DisplayType` when the entry point belongs to one
   track.
2. **Discover from tracks, not displays.** Read track *configs*, so connection
   tracks count. A display-contributed `regionLaunchItems()` seam was rejected:
   it cannot serve a track with no display. **Scan width is the launcher's
   call.** Synteny is **view-scoped** (`launchableTracks` filters the view's open
   tracks) because session-wide preselected the first track in *config order*, a
   choice the user never made. Read `launchableTracks`'s comment before widening
   it.
3. **Discover by declared capability, not adapter name**:
   `pluginManager.getAdapterType(t).adapterCapabilities.includes('getSubgraph')`.
   Hardcoded adapter names left the graph launcher dead when those adapters were
   removed. Check registration first: `getAdapterType` throws on an unregistered
   type.
4. **Take the widest block, never the first.** `dynamicBlocks.contentBlocks` and
   `getSelectedRegions()` return display order, and a rubberband dragged across a
   region boundary puts a sliver first, so `[0]` frames 3 bp of the region the
   user left. `widestRegion` (`regionLaunchMenuItems.ts`) picks the widest by
   bp, ties leftmost. Under a size guard this is silent: the sliver puts an
   illegal window under the cap, so the item renders enabled and opens a
   degenerate view. **No figure can cover this** (no spec has a multi-region
   view); the unit tests are the coverage.

### Launcher gotchas

- **A CIGAR-less alignment is still clipped to the selection, by
  interpolation.** `resolveSpans` (`resolvePanel.ts`) walks the CIGAR when there
  is one and interpolates otherwise. Framing on the whole block ignored the
  selection. Not an edge case: PAF without `-c`, MashMap, MCScan and the coarse
  PIF tier carry no `cg`.
- **A mate that is not a declared assembly is dropped from the launch, and the
  dialog has to say so.** `assemblyForPanSNName` falls back to the bare PanSN
  sample name, so an all-vs-all file yields mates the display draws and the
  launch cannot open. `pickMatesForRegion` returns `{ mates, unconfigured }`. An
  *anchor* name not matching a PanSN prefix is an adapter error
  (`noPanSNMatchError`, `plugins/comparative-adapters/src/util.ts`), since both
  all-vs-all adapters answer `hasDataForRefName` with `true`.
- **A launch RPC that does not rename its region silently opens an empty view.**
  A plain `RpcMethodType` gets no refName mapping (the graph plugin's
  `GetSubgraph` extends `RpcMethodTypeWithRenameRegion`; see
  [REFNAME_NAMESPACES.md](REFNAME_NAMESPACES.md)). Hosted GRCh38 FASTAs use bare
  `1`/`6` names while graph stable names are `GRCh38#0#chr6`.
- **`getSession()` throws on a track *config* node.** Session-wide discovery
  hands back `AnyConfigurationModel`s outside the session tree; pass the session
  in. It fails as `no session model found!` rendered inside the dialog, looking
  like an empty result.
