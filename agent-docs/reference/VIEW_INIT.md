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

Each view type registers its launch keys as
`Record<keyof Commands, LaunchKeySpec>`, so a command the view interprets and
nobody registered is a compile error. LGV's keys are `InitState`
(`plugins/linear-genome-view/src/LinearGenomeView/types.ts`).

## An assembly name read off a track config: canonical, **and** screened

Any assembly name from a track config's `assemblyNames` reaching an
**`AssemblySelector` value** or a **view's launch input** must be:

- **canonical** — `canonicalAssemblyNames` (`@jbrowse/core/util/tracks`).
  `AssemblySelector` silently blanks a value that is not one of the session's
  own `assemblyNames`.
- **present** — `assemblyManager.has`, never
  `getCanonicalAssemblyName(...) !== undefined`. A missing name sets the view's
  error, and `showImportForm` replaces the user's stack with an import form.

Keep one derivation per path (`connectedEndpoints`, `syntenyTrackRows`). Nothing
renames assembly names at the RPC boundary, so unlike refNames there is no
worker-side exception. [REFNAME_NAMESPACES.md](REFNAME_NAMESPACES.md)
§"Assembly names are a third namespace" owns the follow and mate-dictionary side
of the same defect.

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

`tracks` and `views` name both an authored recipe and built state, so each
colliding key registers a discriminator that splits one array per entry
(`trackEntries`: a string or `'trackId' in entry`, since `BaseTrackModel`
declares no `trackId` and specs write display types inline; `rows`: an entry
with no `type`). A **row** list cannot be split: `views` indexes against
`levels` and per-level `tracks`, so a mixed list goes whole to the bucket
`afterAttach` reports, and the view comes up on its import form rather than a
misaligned stack.

**`replay`**: a launch key that IS a declared property, but whose launch needs an
ordered imperative step beyond the property write, lands on the prop and rides in
the blob too. The deciding question: _on an already-materialized view, does
writing the property alone produce the correct picture?_ `sameScale` is the only
member: writing it alone skips `applySharedScale()`, which has to run after
`autoDiagonalize` re-centres the rows. `launchInput.test.ts` beside each view
pins its registration.

## The registration is the one declaration

`ViewType.acceptedKeys` — state model properties, launch keys and `passThrough`
— answers "what may an author write on this view". Its consumers are
`loadSessionSpec` (a spec never becomes a snapshot, so it reports through
`unknownKeysMessage` as an error), `jbrowse validate` (ADR-120),
`check-build-scripts.py`, the URL parameters page's `SPEC_KEYS` marker blocks,
and the compiler through `ViewTypeRegistry`: `ViewSnapshotInput<N>` makes
`session.addView('LinearGenomeView', { asembly })` a compile error at the
literal site. A new view earns this by augmenting `ViewTypeRegistry` and
annotating its model (`const stateModel: ViewTypeRegistry['X'] = …`). A spec
built in a variable annotates itself, and a deliberately out-of-contract row list
says so with `addView<string>(…)`.

**An out-of-tree view that registers nothing keeps MST's silent drop**, and a
spec built through untyped indirection still needs the runtime path and the
validator.

## The flow

The launcher sorts nothing: `LaunchLinearGenomeViewF` validates `assembly` and
hands the rest to `addView`, which is what makes a spec, a `defaultSession` view
and an `addView` literal one shape. LGV's `afterAttach` `setupInitAutorun`
waits for `initialized`, then applies tracklist → loc | displayedRegionNames |
all regions → tracks → nav → highlights, then clears. A highlight-only launch
must not clobber existing navigation, but an explicit `displayedRegionNames`
navigates even when regions exist. A bare string where an array belongs
(`tracks: 'genes'`) is one entry, not its characters.

**The URL wire layer restates the param list.** `LgvUrlInit` is an all-string
shape, and app-core cannot import the LGV plugin, so adding a URL param means
touching both it and `InitState`. jbrowse-web's `buildLgvInit` is annotated with
the real type, and that is where the two are checked against each other.

## The shared state machine

`installInitAutorun(self, { name, ready, materialized, apply })`
(`packages/core/src/util/installInitAutorun.ts`) owns the re-entry guard, the
serialized drain, the identity-checked clear and the failure policy for LGV,
dotplot, synteny, circular and spreadsheet. Its doc comment carries the policy.

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

- **Anything `apply` sets up front must be re-declared by the next pass.** A
  superseded apply can stop between its first write and the step that resolves
  it (`beginAutoDiagonalize` declares `pendingAutoDiagonalize` for the current
  pass).
- **A readiness gate must cover its own apply window.** Both comparative views
  fold `initPending` into `settled`: rows exist several awaits before their
  tracks, and an empty one settles vacuously.

## The loading state machine (`model.ts` getters)

Every gate reads `pendingLaunch(self.launch)`, never the raw property: **a
snapshot whose only launch content was a typo (`asembly`, `veiws`) has nothing
to launch**, and a view that thought otherwise would wait on an assembly nobody
named. It returns the blob itself, never a copy, because the autorun clears by
identity. `awaitingInitNavigation` is `!!pendingLaunch && !hasDisplayedRegions`,
not the comparative views' `initPending`, which is the bare `!!pendingLaunch`.

`withLaunchInput`'s `postProcessSnapshot` keeps the blob only while the view's
`materialized` predicate says no, so an autosave before navigation does not
save a view that reloads onto its import form.

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
4. **Name the dataset the launch reads from, where it fits.** With 0 capable
   tracks, show no menu item. A **bounded list** gets one entry whose submenu
   names each, a single track included (`launchTargetsMenuItem`,
   `@jbrowse/core/ui`). An **unbounded list** gets a flat entry with the dataset
   as a field of the dialog; a cascading submenu of every capable track is worse
   than the unnamed item. A launcher with **no dialog** owes the submenu.
5. **Offer a launch on the one assembly the source can be cut on, greyed out
   elsewhere naming it.** A graph track names its reference first, so the view
   refuses the rest and an old saved session cannot draw in the wrong frame.
   Offering all framed a GRCh38 backbone on a haplotype's own contig with no
   error.
6. **Never push a launch entry into a menu top level.** Group with
   `pushLaunchViewMenuItem` (`@jbrowse/core/ui`); in the rubberband menu extend
   `rubberBandLaunchMenuItems()`, which `LinearGenomeView/menuItems.ts` wraps in
   a "Launch" submenu.
7. **Take the widest block, never the first.** `dynamicBlocks.contentBlocks` and
   `getSelectedRegions()` return display order, and a rubberband dragged across a
   region boundary puts a sliver first, so `[0]` frames 3 bp of the region the
   user left. `widestRegion` (`regionLaunchMenuItems.ts`) and `widestBlock`
   (`launchSubgraphView.ts`) pick the widest by bp, ties leftmost. Under a size
   guard this is silent: the sliver puts an illegal window under the cap, so the
   item renders enabled and cuts a degenerate graph. **No figure can cover this**
   (no spec has a multi-region view); the unit tests are the coverage.

### Where the launchers diverge

**The dialog split is real.** A subgraph is fully determined by
`(region, trackId)`; the set of assemblies aligning to a locus is only knowable
by fetching, and their order changes which comparisons exist (ribbons draw
between *adjacent* panels only). Persistence differs too: the graph writes a plain
snapshot the view resolves on mount (`loadedTrackId` + `loadedRegion`); synteny
bakes resolved locstrings into `init`, so a reload cannot re-derive and the
dialog does the RPC up front. Persisting `(trackId, region, ordered assembly
list)` and letting the view resolve would align them.

### Not built, roughly by value

- **A synteny size guard.** The *visible region* entry at whole-chromosome zoom
  is a whole-genome `CoreGetFeatures` against an all-vs-all track. Measure before
  picking a cap; copy the graph pattern (disabled item carrying the size in
  `disabledHelpText`).
- **`connectedViewId` for synteny**, so a launched stack can highlight back into
  its LGV.
- **The closed-track case.** The objection to session-wide discovery was the
  preselection, not the offer: an entry shown when no synteny track is open, with
  the dataset select empty and required, restores "browsing genes, want to
  compare". A product call.

### Launcher gotchas

- **A CIGAR-less alignment is still clipped to the selection, by
  interpolation.** `resolveSpans` (`resolvePanel.ts`) walks the CIGAR when there
  is one and interpolates otherwise. Framing on the whole block ignored the
  selection. Not an edge case: PAF without `-c`, MashMap, MCScan and the coarse
  PIF tier carry no `cg`.
- **A panel is every block its mate aligns the region with, not the widest.**
  `pickMatesForRegion` groups and `resolvePanel` unions spans, since an HSP table
  is one row per hit. Three rules bound the union: the mate **contig** covering
  most of the region wins; the panel opens reversed only when the minus strand
  carries most of it; and `keepNearMedian` (shared with the multi-way lane frame)
  drops a hit further than 1.5 regions from the length-weighted median as repeat
  noise.
- **Only coordinates cross the RPC.** `SyntenyDiscoverMates` returns
  `ResolvedPanel[]`, since the CIGAR is unbounded. **Round outward, in
  `resolvePanel` and nowhere else**: a span rounded in opens inside the row the
  user read.
- **A mate that is not a declared assembly is dropped from the launch, and the
  dialog has to say so.** `assemblyForPanSNName` falls back to the bare PanSN
  sample name, so an all-vs-all file yields mates the display draws and the
  launch cannot open. `pickMatesForRegion` returns `{ mates, unconfigured }`. An
  *anchor* name not matching a PanSN prefix is an adapter error
  (`noPanSNMatchError`, `plugins/comparative-adapters/src/util.ts`), since both
  all-vs-all adapters answer `hasDataForRefName` with `true`.
- **A launch RPC that does not rename its region silently opens an empty view.**
  A plain `RpcMethodType` gets no refName mapping (`GetSubgraph` extends
  `RpcMethodTypeWithRenameRegion`; see
  [REFNAME_NAMESPACES.md](REFNAME_NAMESPACES.md)). Hosted GRCh38 FASTAs use bare
  `1`/`6` names while graph stable names are `GRCh38#0#chr6`.
- **The graph adapters live in the plugin repo.** A subgraph comes from an
  adapter declaring `getSubgraph` (`RgfaTabixAdapter`, `GbzBaseSyntenyAdapter`);
  `MinigraphBubbleAdapter` reads a summary index and cannot cut one.
- **Menu rows have stable testids** from `makeTestId` (`CascadingMenu.tsx`):
  `cascading-submenu-<label>` / `cascading-menuitem-<label>`. Use them, not text:
  a track's name is usually also its view label and a text match resolves to that.
- **Launching by `session.addView` bypasses invariants.** Synteny routes through
  `launchSyntenyView` (`packages/synteny-core`), which owns the "≥2 views"
  check.
- **`getSession()` throws on a track *config* node.** Session-wide discovery
  hands back `AnyConfigurationModel`s outside the session tree; pass the session
  in. It fails as `no session model found!` rendered inside the dialog, looking
  like an empty result.

### Verifying a launcher

The jsdom test `products/jbrowse-web/src/tests/LGVSynteny.test.tsx` drives
`view.rubberBandMenuItems()` and still missed that nothing *rendered*; generating
the figure (`multiway_synteny/ecoli_launch_from_selection`; regen loop in
`website/scripts/screenshot-review-plan.md`) caught the rest. Pick the demo
window with care: a window inside the paa operon island makes discovery return
one mate and degenerates to the pairwise case. Graph figure specs assert only a
picture, so review by eye:

- **Pick the clicked feature from the index.** A segment with no rank>0
  neighbour cuts a straight run of backbone.
- **Target the rendered label, not a coordinate**:
  `[data-testid="feature-name-<label text>"]`.
- **A graph canvas is too sparse for the content-stable diff gate.** Regenerate a
  deliberate layout change with `--force`.

**Figures cover only what is published.** The tutorials load the plugin from the
plugin list's `latest/` url, a code-split bundle: grep the entry *and every chunk
it references* and diff the entry's md5 against the local `dist/`.
