---
name: lightweight-toolkit
description: Bring-your-own is a docs site, not a package, so there is nothing to install when someone wants the engine without the app. The four rungs an escape parachute actually has, the six silent failures a newcomer hits on the way to one track, the 81-member session interface that makes a small host impossible, and the two packages that are 404 on npm.
---

# JBrowse as a lightweight toolkit

The question this doc is written against: **someone starts building a genome
browser today, with an LLM at their elbow. Can JBrowse empower them at all, or
does it only offer to be their whole app?**

Today the honest answer is that the parts which would empower them are the parts
they cannot install, and the parts they can install ask them to adopt an
application before they can draw one track.

The rung-3 half of this — writing your own display — is already scoped in
[deferred-architecture-review.md](deferred-architecture-review.md), which
reached the same blocker from the other direction. Read that one for the
custom-display page; this one is about the layering underneath it.

## What bring-your-own is today

`products/jbrowse-build-your-own` is **a documentation site, not a package.**
There is no `@jbrowse/…` you install to build your own. A reader assembles the
parachute from three places:

- `createViewState` from `@jbrowse/react-linear-genome-view2` — a *product*,
  named after the managed component they are declining to use
- deep subpaths of `@jbrowse/core` — `util/hooks`, `ui/PaletteContext`,
  `util/usePanZoom`
- `@jbrowse/display-ui`, which is not on npm

Eighteen example files, 7,561 lines, and `check-duplication.mjs` reports 3,489
of them as copies beyond the first. That number is the rule working
([EXAMPLES_SITES.md](../reference/EXAMPLES_SITES.md)) and it is also the size of
the ceremony, which is the thing this doc is about.

## The six silent failures between a newcomer and one track

Walk it as someone who has never seen this codebase:

1. `createViewState` returns a **root model**, whose `.session` holds a
   **view**. Three nouns before one pixel, two of which they did not ask for.
2. Drawing a track is `view.getTrack(id)` → `track.activeDisplay` →
   `display.RenderingComponent`. Four hops, none guessable, and `activeDisplay`
   raises a question about inactive ones that nothing answers.
3. That component must sit inside a `TrackOverlaySlot` and a `contain: strict`
   box or its corner controls, colour key, loading scrim and error bar render
   inside the display's own stacking context. **Fourteen of JBrowse's own
   fifteen copies got this wrong**, character-identically, for months.
4. `view.ready` is false in two states, so `ready ? <Track/> : null` shows an
   empty box forever when the assembly 404s. `OneTrack.tsx` ships that gate with
   a comment saying it is the one thing on the page not to copy.
5. Nothing announces that width has to be pushed into the model. Without
   `useWidthSetter` the view draws nothing and reports nothing.
6. Theming needs `SessionPaletteProvider`. Mount `PaletteProvider` instead —
   the discoverable name, and the one an LLM will reach for — and React colours
   correctly while the worker goes on baking feature labels in the old mode.

**All six fail silently.** That is the property that matters for the reader this
doc is about: their loop is "looks wrong, ask again", and none of these six put
a sentence anywhere that could be fed back into it. The ceremony runs to roughly
120 lines before any of their own code starts, of which about 15 are genuinely
theirs.

## Five findings

### 1. The unit of reuse is a product, not a library

`packages/` is layered well. `@jbrowse/render-core` is a real leaf — `mobx` plus
`@jbrowse/mobx-state-tree`, React as a peer, **no `@jbrowse/core`**. But the
*composition* that constitutes an engine — plugin manager, root model, session,
config schema — exists only inside
`products/jbrowse-react-linear-genome-view/src/`. `corePlugins.ts` is a
hardcoded list of 18 plugins and `createViewState`'s `plugins` option only
**adds** to it. You cannot ask for LGV and wiggle.

An engine should be a value you compose; the product should be a preset over
it. The host-chosen plugin set is already proposed from the bundle side in
[build-and-dependencies.md](build-and-dependencies.md) — the conceptual
argument is the stronger one, because a reader who cannot subtract a plugin also
cannot tell which of the 18 their code depends on.

### 2. `getSession()` is an ambient service locator with an 81-member interface

470 call sites across 245 files. What they reach for is small:

| member | sites |
| --- | --- |
| `assemblyManager` | 55 |
| `queueDialog` | 49 |
| `rpcManager` | 36 |
| `notify` + `notifyError` | 27 |
| `palette` | 11 |

What the *type* hands them is `AbstractSessionModel` — 78 own members plus 3
inherited from `AbstractViewContainer`: drawer widgets, connections, admin mode,
session duplication, theme registries, track action menus, config editing.

So "a display needs a session" is true, and what it means in practice is "a
display needs an app." That is the largest single reason the system reads as
heavy to someone using a tenth of it: a small host cannot supply a smaller
thing, because the interface belongs to the application.

The fix is not a rewrite. Split the interface by what a caller actually wants —
`RenderingServices` (assemblyManager, rpcManager, palette, themeOptions),
`NotificationSink` (notify, notifyError, queueDialog), `PreferenceStore` — and
retype the plugin-side call sites to the narrow ones. `getSession(self)` keeps
working unchanged. The measurable goal is that **no plugin names
`AbstractSessionModel`**, at which point "what does a display require of its
host" has an answer a third party can implement.

### Done, 2026-08-23: the split landed, and the cost is where the guess said it wasn't

Six interfaces in `packages/core/src/util/types/`, and `AbstractSessionModel`
extends all of them, so nothing that already compiled changed type:

| slice | members | file |
| --- | --- | --- |
| `RpcHost` | `rpcManager: RpcCaller` | `types/services.ts` |
| `PaletteHost` | `palette`, `themeOptions` | `types/services.ts` |
| `NotificationSink` | `notify`, `notifyError` | `types/services.ts` |
| `DialogHost` | `queueDialog`, `DialogComponent`, `DialogProps` | `types/services.ts` |
| `AssemblyHost` | `assemblyManager`, `assemblyNames` | `types/renderingServices.ts` |
| `TrackCatalog` | `tracks`, `assemblies`, `connectionInstances`, `getTrackById` | `types/index.ts` |

`getRpcHost`, `getNotificationSink`, `getDialogHost` and `getPaletteHost` in
`util/sessionServices.ts` return them off the same cached ancestor walk
`getSession` uses; `getAssemblyHost` and `getRenderingServices` sit in
`mstUtils.ts` with `getSession`, for the reason below.

**Three of the six cost nothing to name, and three cost the whole application.**
That split is the finding, and it is not the one the guess above makes. An
`RpcCaller`, a `JBrowsePalette` and a notification signature are ordinary types.
An `AssemblyManager` is an MST model a `PluginManager` built, and a
`TrackCatalog` is `AnyConfigurationModel`, which is the configuration schema
machinery — so those two put ~370 files in any caller's type graph however
narrowly they are asked for. Keeping them in separate files from the cheap four
is the whole reason the numbers below move.

Type closure, files, before → after (`scripts/moduleClosure.ts`; ceilings in
`moduleClosure.test.ts`):

| entry | before | after |
| --- | --- | --- |
| `util/fetchContext.ts` | 369 | 35 |
| `util/installFetch.ts` | 373 | 40 |
| `util/installInitAutorun.ts` | 373 | 35 |
| `BaseLinearDisplay/models/FetchMixin.ts` | 375 | 44 |
| `BaseLinearDisplay/models/fetchEachRegion.ts` | 379 | 48 |

Two edges outside the split were in the way and are gone: `RpcRegistry.ts` took
`NoAssemblyRegion` from the session barrel rather than `types/data.ts`, which
was 368 of its 368 type files, and `regionTooLargeUtils.ts` reached one byte
formatter through `@jbrowse/core/util`.

**Plugin files naming `AbstractSessionModel`: 53 → 7.** One is a comment. The
six real ones are the administration UI — the assembly manager
(`AssemblyAddForm`, `AssemblyManager`, `AssemblyTable`), the connection manager
(`ManageConnectionsDialog`), the plugin store (`PluginStoreWidget/util`) and the
session manager (`SessionManager/util`) — and each wants `adminMode`,
`addAssembly`/`removeAssembly`, `sessionConnections` or `sessionPlugins`. Those
are the application, and asking for it there is correct. **No display, no
launcher and no menu names it any more.**

Where a plugin needed several services, the intersection is named once rather
than repeated: `UcscHost` (BLAT), `BreakpointSplitViewHost` (sv-core),
`SyntenyLaunchHost` (synteny-from-region).

**Not done, and the next thing in the way**: the `SessionWithX` family —
`SessionWithWidgets`, `SessionWithDrawerWidgets`, `SessionWithConnections` and
eleven others — still `extends AbstractSessionModel`. Naming one is therefore
still naming the application, and a plugin retyped to `SessionWithWidgets` reads
better without weighing less. Cutting that base was tried: 44 errors, all in
`packages/app-core`, because the app shell uses `SessionWithDrawerWidgets` as
its name for the whole session. The fix belongs there, not in plugins.

### 3. `queueDialog`, at 49 sites, is the application leaking downward

A dialog is the most app-shaped concept there is: it assumes a modal layer, a
component type, and a React tree the host owns. It is also the single
most-called session member from plugin code.

Nearly all 49 are a display saying *the user wants to configure something* —
which is a request, not a modal. As written, a host drawing its own UI either
gets JBrowse's Material dialogs or gets nothing, with no error either way. That
is the same hole the Loading-and-error-states page exists to document for
notifications, one level further down, and it is where "bring your own UI"
currently stops being true.

**Partly addressed, 2026-08-23**: `queueDialog` now has a slice of its own, so a
host that draws its own UI has exactly one named member — `DialogHost` — to
implement rather than an 81-member session, and every one of the 50 call sites
asks for it by name through `getDialogHost(self)`.

That is the seam, not the redesign. A dialog is still a component the display
hands over, so the host that implements `DialogHost` still has to mount JBrowse's
React tree. Making it a *request* instead — the display names the settings it
wants edited and the host renders them however it likes — is a real design and is
not started. The shape to look at first, noted here rather than built: nearly all
50 callbacks return `[SomeDialog, { model: self, handleClose }]`, i.e. the
payload is already just "this model, edited". A `requestSettings(self, schema)`
whose default implementation is today's `queueDialog` would cover the majority
without touching the minority that pass real arguments.

### 4. The view has a lifecycle and publishes it as nine unrelated getters

`ready`, `error`, `initialized`, `showLoading`, `loadingMessage`,
`loadingProgress`, `hasSomethingToShow`, `assemblyErrors`,
`assembliesInitialized`. Every example on the site re-derives a gate from them,
and they do not agree.

Displays already solved this. `displayPhase`
(`packages/render-core/src/displayPhase.ts`) is one discriminated getter whose
docstring gives the reason: the precedence lives in a single function "instead
of being re-encoded by subtraction (`&& !regionTooLarge && !error &&
!renderError`) in every display model." **`view.ready` is exactly that
subtraction** — `!showLoading && !this.error` — and the subtraction is being
re-encoded in every host instead of every display.

A `view.status` getter of the same shape makes the gate a `switch`, makes the
trap unrepresentable, and tells a reader the states exist. It is finishing a
pattern rather than introducing one. **Landed** — see item 3 below, including
the fourth state the two-state framing above misses.

### 5. The engine kernel is the most reusable thing here, and it is 404 on npm

`@jbrowse/render-core` carries the HAL, the WebGPU → WebGL2 → Canvas2D ladder,
the upload/render lifecycle, instance passes, hi-DPI handling, context-loss
recovery, the float32 bp-precision math, and the Slang toolchain. It is
unpublished. So is `@jbrowse/display-ui`, which the bring-your-own examples
import 19 times — **on a site whose one inviolable rule is that an example
imports only from published packages.**

Both are non-private, so `publish.yml`'s bare `pnpm publish -r` ships them on
the next tag; `PUBLISHING.md` already names them as the standing case and says
to grep the docs that assume their absence. Until that happens, everything below
is unshippable and the site's central rule is quietly broken.

Worth saying plainly because it reads as a limitation and is not: `render-core`
is a **genomic** visualization engine, not a general one. `hpmath`,
`regionRegistry`, `perRegionRenderingBackend` and `blockClipUtils` are all
coordinate-system concepts. That is the differentiator.

## The escape parachute is a ladder, and the site sells one rung

- **Rung 1 — the app.** `<JBrowseLinearGenomeView>`. Fine as it is.
- **Rung 2 — your own chrome.** What bring-your-own documents today: JBrowse's
  engine, your pixels around the data.
- **Rung 3 — your own display.** Your marks on JBrowse's coordinate system and
  fetch pipeline. Already cheap and undocumented — `HicRenderer.ts` is 19 lines
  of `ctx` calls, `Canvas2DSequenceRenderer.ts` 37,
  `Canvas2DManhattanRenderer.ts` 117, and `createCanvas2DBackend` is a
  first-class path rather than a fallback. Scoped in
  [deferred-architecture-review.md](deferred-architecture-review.md).
- **Rung 4 — your own everything.** `render-core` alone: you have your own data
  pipeline and you want the backend ladder, the precision math, and the
  context-loss and tab-visibility handling. This is the rung that answers "can
  JBrowse be a genomic visualization engine", and the work there is **packaging
  and naming, not architecture** — the package already exists and already has
  the right dependency shape.

## Work, in order of leverage over cost

1. **Publish `render-core` and `display-ui`.** No design work. Everything else
   here depends on it, and the examples site is out of compliance with its own
   rule until it lands.
2. **Name the engine and export its types.** Move the `createViewState`
   composition somewhere whose subject is the headless engine, taking the plugin
   set as an argument; `@jbrowse/react-linear-genome-view2` keeps its API and
   becomes a preset over it. Export the view and session types — all 18 examples
   write `type BrowserView = ReturnType<typeof makeView>['view']` because there
   is no name to import.
3. ~~**`view.status`**, shaped like `displayPhase`.~~ **Done**, on
   `LinearGenomeView` and `LinearSyntenyView`. `computeViewStatus` in
   `@jbrowse/core/util/viewStatus` holds the precedence and takes the loading
   term as a thunk, so dotplot and circular — which re-spell the same four
   getters, `loadingMessage` and `loadingProgress` character-identical across
   all four — adopt it in eight lines whenever someone touches them.

   Two things came out of building it that reading did not. `noRegions` is a
   fourth state, not a rename: `view.ready` is true when nothing has navigated
   the view, so a host gating on it mounts tracks over an empty view. And that
   state was unreachable on the whole examples site, because all eighteen
   `createViewState` calls passed `init` — including on the page whose argument
   for `status` over `ready` is that state.
4. **Publish the display-mount contract.** `check-duplication.mjs`'s `COPIED`
   entry calls `TrackRow` the reader's own to write, which conflates the box
   (theirs, to style) with the slot/containment/Suspense contract (not theirs).
   The repo's own "publish the block" rule has fired six times; the 14-of-15
   evidence says this is the seventh, and it is the one case where every copy
   agreed and every copy was wrong.
5. ~~**Narrow the session at the display boundary**~~ — finding 2. **Done**,
   2026-08-23; see the status under that finding for the numbers and for the
   `SessionWithX` family, which is what is left. This is what
   makes a small host possible rather than merely tidy.
   [barrels-block-extraction](barrels-block-extraction.md) reaches the same
   `util/types/index.ts` split from the packaging side, where the blocker is
   that a 300-line coordinate utility cannot leave `@jbrowse/core` while
   `Region` shares a file with `AbstractSessionModel`. Two independent arguments
   for one move, so this ranks above its position here.
6. **Make `queueDialog` and `notify` seams rather than calls** — finding 3.
   Highest effort here, and it decides whether "your own UI" is true below the
   view.
7. **A custom-display page**, once (1) lands.

One small item with disproportionate effect: the
`readSiteMode`/`watchSiteMode`/`useSiteMode` trio is **50 lines in every one of
the 18 example files**, a fifth of the floor example. If `SessionPaletteProvider`
read `prefers-color-scheme` itself when given no `mode`, that goes to zero
everywhere — and unlike the rest of the list it costs nothing but a default.

## What this is not

Not a bundle-size argument. [EAGER_BUNDLE.md](../reference/EAGER_BUNDLE.md)
owns that axis and its remaining item is a different one; the two are easy to
quote for each other and should not be. A host can pay every byte JBrowse ships
and still be unable to express what it wants, which is the problem here.
