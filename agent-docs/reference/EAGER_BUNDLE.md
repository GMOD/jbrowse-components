---
name: eager-bundle
description: What every JBrowse host downloads before it can run, why plugin registration makes most of it unavoidable, the six pins that were making it pay for far more, and the measured census of what still holds Material UI there. Read before touching a plugin `exports` object, a state model's imports, or anything that claims a bundle number.
---

# The eager bundle

## The number

Measured 2026-08-05 on the build-your-own examples site, whose sparsest page
("Getting started", whose second demo is the bare one) is a measured div, one
wiggle track, and no
JBrowse chrome at all:

<!-- measurement: eager-bundle-chunks -->

| | eager chunks | gzipped |
| --- | --- | --- |
| before | 347 | 667 KB |
| after pins 1-3 | 219 | 523 KB |
| after pin 4 | 218 | 514 KB |
| after pin 5 | 181 | 464 KB |

Same page throughout, rendering the same thing. 203 KB gzipped and 166 chunks
were reachable and never used.

Pin 6 is measured separately, on a different host and in different units — see
its own table below, and don't read the two against each other.

## Where it went

Five pins, in the order they were found. All five are the same mistake at
different scales: **a module that must be evaluated eagerly names a React
component**.

### 1. `LinearGenomeViewPlugin.exports` (small, and the clearest example)

The LGV view type registers its component with `ReactComponent: lazy(() =>
import('./components/LinearGenomeView.tsx'))` — and then the plugin class body
listed the very same component in its `exports` object, for external plugins.
`exports` is evaluated when the class is defined, so the `lazy()` bought
nothing. Now in `plugins/linear-genome-view/src/lazyPluginExports.tsx`, behind
`lazy()` plus a `Suspense` wrapper so an external plugin that renders one sees
no change.

**A `lazy()` at a registration site only holds if nothing else in an eagerly
evaluated module names the same component.** A plugin `exports` object is the
easiest place to name one by accident.

### 2. The view model holding its own Header

`LinearGenomeView/model.ts` opened with `import Header from
'./components/Header.tsx'`, to serve the `HeaderComponent()` /
`MiniControlsComponent()` methods. A view's state model is as eager as a module
gets, so that one line pulled the whole stock header in: `SearchBox` →
`RefNameAutocomplete` → MUI `Autocomplete`, `HeaderZoomControls` →
`SingleSlider` → MUI `Slider`, and `@jbrowse/core/ui` behind both — in every
host, including one that sets `hideHeader`. Now
`LinearGenomeView/lazyChromeComponents.tsx`.

This is the same anti-pattern `BaseDisplayModel`'s `DisplayMessageComponent`
getter was deleted for (DISPLAYCHROME.md §"One element per display"). Deleting
was not repeated here only because these two are documented `#method` entries an
external plugin may override; `lazy()` gets the same bytes without the bet.

### 3. The runtime re-export registry — 126 KB gzipped, the whole of it

`PluginManager` statically imported `ReExports/index.ts` to fill `lib` for
`jbrequire`. That module (`ReExports/modules.ts`) is the ABI external plugins
link against, and it builds it by spreading `import * as` namespaces of
`@jbrowse/core/ui`, `configuration`, `util` and a dozen more into one object.
**A namespace spread names every export**, so nothing downstream of those
barrels can be tree-shaken; the module also throws at top level if `libs` and
`list.ts` disagree, so it cannot be dropped either. Together that put most of
`@jbrowse/core/ui` — and behind it ~400 KB of Material UI — into the first paint
of **every** host, including embedded ones that load no runtime plugin at all.

Nothing can call `jbrequire` before a runtime plugin exists, and the only thing
that can make one exist is `PluginLoader.load()`, which is async. So the
registry is now imported there (`publishReExports`, called at the top of
`loadSettled`, before any plugin script evaluates) and parked in
`ReExports/registry.ts` for the synchronous `jbrequire` to find.
`installGlobalReExports(target)` stayed synchronous and still returns `this` —
it records the target, and all six call sites chain into `load`/`loadSettled`.

Pinned by three tests in `PluginLoader.test.ts`, including one that installs the
repo's own no-build plugin fixture (`test_data/no_build_plugin/esmplugin.js`,
five `jbrequire` calls at the top of `install()`) end to end. All three were
confirmed to fail with the `publishReExports()` call removed.

### 4. The `@jbrowse/core/ui` barrel, and two more elements in descriptors

Done in a follow-up pass; 523 → 514 KB gzipped. **A small number, and worth
knowing why it is small**, because the obvious reading of pin 3 was wrong: while
`ReExports/modules.ts` was spreading the barrel's namespace, *every* member of
`@jbrowse/core/ui` was retained, and it looked like ~38 eager menu modules were
each dragging in a share of ~585 KB of Material UI. Once the spread was gone the
barrel tree-shook per-export, and what those 38 modules actually named turned out
to be 16 symbols, mostly free. So this pass is about the architecture, not the
bytes: it is what stops the barrel becoming a pipe again.

Three parts:

- **`@jbrowse/core/ui/menuItems`**, a React-free entry holding the four builders
  eager code needs (`checkboxItem`, `radioItems`, `promotableRadioItem`,
  `promotableToggleItem`) plus the menu types. 23 call sites repointed. The rule
  is *menu builders from here, components from `@jbrowse/core/ui`*.
- **`endAdornment` → `pin` for the promotable pin.** The two
  `promotable*Item` builders returned a `<PinAdornment>` **element**,
  so the module — and every state model calling it — pulled MUI's `ToggleButton`,
  `Tooltip` and two icons. The row now carries a *description*
  (`MenuItemPin`) and `menuItemAdornment.tsx` builds the element where
  the menu is drawn. `endAdornment` stays for genuinely arbitrary content
  (synteny's colour swatch), which is what it was added for.
- **`makeSizeMenu`'s slider row behind `lazy()`.** `type: 'custom'` already made
  `render` a thunk, so the row was lazy at call time and eager in the module
  graph — which is where it counted. MUI `Slider` was the single largest
  Material component in the eager set (38 KB); it is now gone from it.

`menuItems.purity.test.ts` walks the new entry's static graph — `import` **and**
`export … from`, which is what a barrel is made of — and fails on react, @mui or
@emotion, printing the trail. Its second case runs the tracer over `ui/index.ts`,
the barrel this was split from, and requires it to *fail*: a purity test that
cannot see a violation is worth nothing, and the first version of this one
couldn't (it missed `export … from` and passed both ways).

### 5. Dialogs named by the models that open them

The largest of the five after the registry, and the cheapest: **523 → 464 KB
gzipped, 218 → 181 chunks**, for three import lines.

Three state models named a dialog at module scope:

- `plugins/variants/src/LDDisplay/shared.ts` → `LDFilterDialog` and
  `JexlFilterDialog`, and through them `SubmitDialog` → `Dialog`
- `plugins/authentication`'s `HTTPBasicModel/model.tsx` and
  `ExternalTokenModel/model.tsx` → their token-entry forms

15 KB of first-party dialog code, and behind it MUI's whole form cluster —
`TextField` → `Select` → `Modal` → `Popover` → `InputBase` → `OutlinedInput`.
Every host shipped it before anything could have opened a filter menu, and most
sessions never authenticate at all. Now `plugins/variants/src/shared/lazyDialogs.ts`
and `plugins/authentication/src/lazyLoginForms.ts`, following
`plugin-linear-genome-view`'s `lazyDialogs.ts`.

**Nothing else was needed, which is the part worth knowing.** Both routes reach
the dialog through `session.queueDialog`, and `DialogQueue`
(`packages/app-core/src/ui/App/DialogQueue.tsx`) already renders it inside a
`Suspense` boundary. **A dialog opened through `queueDialog` can always be
`lazy()`**; if one still isn't, that is an oversight rather than a constraint.

One snag worth remembering: `lazy()` infers a type naming the component's props,
so a props interface local to the dialog module fails the declaration emit with
TS4023 (`LDFilterModel` here). Export the interface.

### 6. Desktop's start screen holding the whole plugin graph

The first five pins are one mistake — an eagerly evaluated module naming a React
component. This one is a different shape, and it is the exception to the rule
that plugin registration is not reducible: **a screen that renders no session
does not need the registry before it paints**, and JBrowse Desktop opens on
exactly such a screen.

Before it paints, not never — see "the part that did not work" below.

`products/jbrowse-desktop/src/components/StartScreen/util.tsx` was the one static
path from the desktop renderer's entry to `corePlugins`, and through it to every
plugin's models, adapters and config schemas plus the root and session models.
Four modules imported it — the Loader, `StartScreen`, `LeftSidePanel`,
`RecentSessionsPanel` — so launching the app parsed and evaluated the entire
plugin graph before the start screen could draw a pixel.

The heavy half is now `StartScreen/pluginManagers.tsx`, and `util.tsx` is a
facade reaching it through `import()`. Its three entry points
(`loadPluginManager`, `openSpecLink`, `createStartScreenPluginManager`) were
already async and awaited at every call site, so the deferral costs a chunk load
on a path that was going to wait on IPC and plugin fetches anyway.

Measured 2026-08-05 on `products/jbrowse-desktop`'s production webpack build.
**Raw bytes of `main.js`, the only script `index.html` loads** — not the gzipped
chunk counts above, so don't compare the two tables:

| | `main.js` | plugin graph in it |
| --- | --- | --- |
| before | 2,695,539 B | yes |
| after | 1,357,165 B | no |

Checked by grepping `main.js` for `LinearGenomeViewPlugin`, `BamAdapter`,
`CramAdapter`, `DotplotView` and `JBrowseDesktopRootModel` — one hit each before,
none after. Roughly 130 KB of that came from three smaller lazies made in the
same pass: `JBrowse.tsx` (app-core's `App`, dockview, drawer widgets) in the
Loader, and the start screen's two dialogs-behind-buttons.

`StartScreen/pluginManagers.eager.test.ts` guards it, because one static import
anywhere puts the graph back and nothing about that diff would say so.

**The part that did not work, because you will think of it too.** The start
screen still *loads* the graph — just after first paint, when its own plugin
manager is built, rather than before. `createStartScreenPluginManager` needs no
corePlugins (it exists for the three `Desktop-StartScreen*` extension points, and
a plugin contributing a panel has no use for `BamAdapter` being registered), so
splitting it into a module of its own should have deferred the graph all the way
to session-open. It was tried, and reverted:

- it bought **nothing** — `main.js` measured 1,357,376 B with the split against
  1,357,165 B without, i.e. identical, since the graph was already behind the
  dynamic import either way. The only prize was *when* the graph loads, and on
  Desktop that is `file://`, so it is parse/eval time and never bytes;
- it **broke the packaged app**. The volvox assembly hung at
  `initialized: false` with an empty error — an RPC worker that never answers.

Typecheck, 3135 unit tests and every bundle measurement stayed green through
that, because unit tests use MainThreadRpc and never exercise worker chunk
loading. Only `pnpm package:linux:no-installer && pnpm test:e2e:headless` caught
it. Suspected mechanism, unconfirmed: `src/util.tsx` (`fetchCJS`) is imported by
`rpcWorker.ts`, a **separate webpack entry**; a second async renderer consumer
appears to tip `splitChunks` into extracting a shared chunk the worker must then
load at runtime, which is what `products/jbrowse-desktop/scripts/config.ts`
already warns about for `publicPath: './'` under `file://`. Confirm that before
retrying.

**The general form, for the next host that opens on something other than a
session:** the registry is eager relative to *reading a session snapshot*, not
relative to first paint. Anything a host draws before a session exists — a start
screen, a config picker, a login — can paint without it, and the thing that
usually prevents that is one static import on a module that had no other reason
to be light. Going further, to not *loading* it at all, is a separate and much
riskier claim on a host whose workers share a chunk graph with its renderer.

## Theme-free `makeStyles`

`makeStyles` used to hand a component Material UI's `Theme`, fetched by a
six-line shim (`util/tss-react/mui/mui.ts`) whose whole content was `import
{ useTheme } from '@mui/material/styles'`. 268 call sites made that shim eager,
and `useTheme` falls back to `createTheme()`'s default theme, so the theme
factory was in every host's first paint.

It now hands them **`ui/styleTheme.ts`'s `JBrowseStyleTheme`** — plain data, no
toolkit — read through `useStyleTheme()` on the context `PaletteProvider`
already published. `palette.ts` is the colour half and was already there; this is
the rest, and it is deliberately a *subset* of MUI's theme rather than a copy, so
a call site reaching further is a compile error naming the file.

**What the 268 call sites actually read**, counted before designing anything —
the hour of work the previous handoff said would settle it, and it did:

| | call sites |
| --- | --- |
| read nothing from the theme | 111 |
| `palette.*` and/or `spacing` only | 141 |
| anything else | 16 |

Of the 16: `shape.borderRadius` (5), `typography.*` (9), and five sites reaching
`transitions`, `zIndex` or `shadows`. So the theme carries palette, spacing,
shape and the type scale, and the last five were rewritten — two `transitions`
to the literal Material emits, `shadows[2]` likewise, and the two `zIndex` reads
to named constants in `ui/zIndexes.ts`, which is where layering was already
decided.

**`palette.ts` had to grow, and that is the half worth knowing about.** Its
census covered the colors JBrowse *renders*; `error`, `warning`, `info`,
`success`, the grey scale and the `action` opacities were never in it, because
`createTheme` filled them in on the way past. 100 call sites read one. They are
JBrowse's own now, at Material's values, and a config `theme` can override them
where before only the Material half saw it.

The values reproduce Material's exactly, because JBrowse's own chrome *is*
Material UI and a `makeStyles` row sits next to a `<Typography>`.
`styleTheme.test.ts` asserts that against a real MUI theme the way
`palette.test.ts` does for colour, including under a config `theme` that sets
`spacing` or `typography.fontSize` — both documented in the theming guide, both
still reaching `makeStyles`, because a session's new `styleTheme` getter is
derived from the same `themeOptions` as its `theme`.
`util/tss-react/muiFree.test.ts` fails if anything reachable from `makeStyles`
imports `@mui/*` again.

**It cost 1 KB, and that is the point of the next section.** 470 KB gzipped
before, 471 after, for the module the style theme adds. The 51 KB it was supposed
to release did not move, because the premise was wrong.

## What still holds Material UI in the eager set

The claim above — "`@mui/material/styles` is held by `mui.ts`" — was checked the
way this file recommends, by grepping for the first-party module that names it.
That check is right and was run wrong: on **one** suspected module rather than
over the whole eager set, which finds the holder you thought of and no others.
`pnpm probe-eager-graph` now runs it over the set.

Measured 2026-08-06 on the sparsest page, **48 first-party eager modules import
Material UI**, and they hold overlapping parts of it, so cutting any one group
banks nothing. The count is per page and the sparsest one flatters it — `synteny`
carries 42 first-party holders of `@mui/material` alone:

| holder | count | what it names |
| --- | --- | --- |
| menu-item modules, plugin indexes, state models | 31 | `@mui/icons-material/*` |
| the SVG export path, reached from the LGV plugin index | 9 | `useTheme`, `ThemeProvider` |
| `ui/theme.ts` | 1 | `createTheme`, for the session's `theme` getter |
| `ui/InlineMenuControls.tsx`, `wiggle-core/ResolutionStepper.tsx` | 2 | `Tooltip`, `IconButton`, `Button`, `Typography` |
| the two auth account icons | 2 | `SvgIcon` |
| `HoverPositionHighlight`, `OverviewScalebarPolygon`, `ui/LoadingOverlay.tsx` | 3 | `alpha` — **fixed**, `ui/palette` exports it |
| `util/color/index.ts` | 1 | `lighten`/`darken`/`getLuminance` — **fixed**, same |

That is ~277 KB uncompressed (`@mui/material` 159, `@mui/system` 78,
`@mui/icons-material` 21, `@mui/utils` 19) and it comes out only if every group
does. Two corrections fall out of it:

- **`ButtonBase`, `Tooltip`, `Button`, `CircularProgress` (~58 KB) are not
  chunk co-location**, which is what this file said. `Tooltip` is named by
  `InlineMenuControls.tsx` and `Button` by `ResolutionStepper.tsx`, both eager
  through a barrel. The earlier check asked which module imports
  `@mui/material/Button/Button.mjs` and got node_modules only — a named import
  from a package barrel records an edge to the barrel, and the barrel imports the
  component. `probe-eager-graph --holds` reports the barrel importers as a
  shortlist for exactly this reason.
- **The icon-name registry stays decided-against**, and the reason it was
  deferred is gone rather than satisfied. It was parked because it would be worth
  ~72 KB *after* a theme-free `makeStyles` released `@mui/material/styles`;
  `styles` is held by `ui/theme.ts` independently, so it is still worth its own
  ~21 KB of source — under 10 KB gzipped — for a public ABI change across ~39
  modules. Its design, if the whole knot is ever cut at once: follow
  `TrackControlIcon`
  (`packages/display-ui/src/trackControl/types.ts`),
  a closed string union with a `satisfies Record<Name, unknown>` map per
  implementation, widening the field to `React.ElementType | MenuIconName` so
  external plugins keep working (PLUGIN_ABI_STABILITY.md). The resolver goes on
  the render side, which is already lazy — `CascadingMenu`, `MenuItems` and
  `CascadingMenuButton` are all outside the eager set.

**So the remaining work is one item, not three.** Get Material UI out of the
eager set, which needs every row of that table, and the two hard ones are the
SVG export path (its components are value exports of the LGV plugin index, so
deferring them is an ABI change) and `session.theme` (a synchronous getter, so
deferring it means moving theme construction to the products — which already
import Material UI, and where it costs a bring-your-own host nothing). Neither
is worth starting without deciding both.

## "0 Material elements" and "no Material UI" are different claims

The BYO site measures two things and it is easy to quote one for the other.

`MUI_BUDGET` in `smoke.mjs` counts **rendered elements** — outermost `Mui*`
classes in the DOM, sampled from before the page's own scripts run. That is the
right measure for an embedder's *look*, and the one that found the progress bar.
It cannot see the bundle at all, by construction: `alpha()` and `useTheme()` draw
no element, and neither does a component that is imported but never mounted.

The gap is not small. Measured 2026-08-16:

| page | `MUI_BUDGET` | eager modules importing `@mui/material` | gzip |
| --- | --- | --- | --- |
| `removing-material-ui` | 0 | 94, of them 33 first-party | 573 KB |
| `synteny` | 0 | 105, of them 42 first-party | 691 KB |
| `ultraminimal` | 0 | — | 523 KB |

So the page named for removing Material UI ships it, and ships 50 KB *more* than
`ultraminimal` — page coupling, not Material. Both pages score a legitimate zero
on the axis the census measures, and neither is close to zero on the other.

**Say which axis when recording a win.** "The hole is closed" about a rendered
element is true and worth having; the same sentence reads as a bundle claim, and
the bundle claim is the table two sections up — 48 eager modules, ~277 KB, out
only if every group goes.

## A duplicate is how a bundling split looks from the inside

The pins above are things to remove. This is the opposite: a place where the
duplication is the fix, and reads exactly like an oversight.

`breakpoint-split-view`'s `components/overlayGeometry.ts` holds four small
helpers that also exist in `../util.ts` — a 3, a sentinel, and two four-line
functions, character for character the same. `model.ts` is eager, `components/`
is behind a `lazy()`, and a React-free module imported by both gets grouped with
the lazy chunk, so the eager import drags it in. Duplicating the helpers is what
keeps the two sides from sharing a module.

A duplication sweep deleted three of the four (`24aba4d012`) and pointed the
lazy side at `../util.ts`. **Nothing in the ordinary workflow disagreed**: tsc
passed, every suite passed, lint passed. The synteny page went 678 -> 690 KB
gzip eager and broke its own committed budget, and the only thing that says so
is `pnpm smoke` here, which needs a full Astro build. Restored in `0e8f92550f`.

Two things follow, and the second is the general one:

- That plugin now has `eagerBoundary.test.ts`, which greps `components/` for a
  static `from '../util.ts'` and fails in 1.3s. Any other module pair holding a
  split like this deserves the same — the boundary is invisible to every other
  check.
- **Identical trivial copies are the expected shape of a deliberate split, not
  evidence against one.** Read the file header before deleting one. If a helper
  genuinely needs sharing, move it to a *third* module neither side's eager
  entry imports; do not point the lazy side at the eager one.

## A namespace import is the unit, so a module is as eager as its cheapest consumer

`import * as x from './m.ts'` marks every export of `m` used. Rolldown then
includes or excludes `m` **whole**, so if any eager module imports one name from
it, the always-loaded chunk pays for all of it — and nothing in tsc, lint or the
test suite says so.

That is a *module-splitting* problem, not an import-fixing one, and the generated
shader modules are the worked example. `pnpm gen:shaders` emits three files per
shader with entry points — the WGSL/GLSL strings (`x.generated.ts`), the layout
and packers (`x.iface.generated.ts`), and the `//! export-consts` integers
(`x.consts.generated.ts`) — with the re-export chain running one way, strings →
iface → consts, so a render path's namespace import still sees everything.

The consts module exists because of what a survey found: **all 33 sites in the
tree that imported a shader constant wanted nothing else from the module they
were importing from.** Three eager modules in plugins/alignments held all 16 KB
of `read.iface.generated.ts` — `writeUniforms` and the packers included — for
`CS_*`, `RC_*` and one pixel threshold. Splitting the constants out and pointing
those sites at the new module took **5-6 KB gzip off every page** of the byo
examples site, chunk counts unchanged; `read.iface.generated.ts` is no longer in
the eager set at all.

Two things generalize from it:

- **Read a hand-written re-export barrel next to generated code as a report of
  this bug.** `plugins/canvas` had two hops (`passes/constants.ts` →
  `components/sharedRendererConstants.ts`) doing by hand what the consts module
  now does, with a header quantifying the ~67 KB it was dodging. Both are gone.
  If you find a third, check whether the generator can own it before adding to it.
- **A shader constant now comes from `x.consts.generated.ts`, and there is no
  reason to reach past it.** Importing the same name from `x.generated.ts`
  compiles, passes every test, and drags the shader source — which is exactly
  what `plugins/hic`'s `colorRamp.ts` was doing.

## A multi-page site's budgets are coupled: adding a page moves all of them

On the examples sites, each page's eager figure is measured independently and
ratcheted in `eagerBundleSizes.json` — but the numbers are not independent.
Rolldown cuts chunks by which pages reach a module together, so a new entry
re-partitions chunks across the whole site and every page's figure moves.

**It is re-partitioning, not modules.** The obvious reading — pages start
downloading co-located modules they don't use — is measurable and nearly false:
`probe-eager-graph` now reports how much of a page's eager set its own static
graph reaches, and on `synteny` that is **1714 of 1715 modules, 3553 of 3555
KB**. A page's eager chunks are its own imports. What a neighbouring page
changes is where the cuts fall and therefore how well it all compresses —
removing `synteny.astro` takes `ultraminimal` from 253 chunks to 221.

Measured, since the figure is what makes a budget move readable: building
`jbrowse-build-your-own`'s site with and without `synteny.astro` moves each of
the other eleven pages by **~13 KB gzip**. Nothing about those pages changed.

So when a budget moves and the page it names is not the page anyone touched,
check whether a page was added or removed before hunting an import. Two such
steps are banked in that site's committed figures — `synteny` (~11 KB a page,
the only page on a second product) and `track-settings` (1-2 KB, a twelfth entry
on the same product) — and both were attributed rather than assumed, with
`pnpm probe-eager-graph --page ultraminimal --holds <pkg>` reporting **zero**
eager modules importing the new page's product. The ratchet is normal again from
a banked step; a further rise is a real regression.

### The noise is larger than the band, which is why this keeps costing a session

`OVER_KB` is 10. A page addition moves every other page 12-14 KB. So the
confound is not merely present, it is **bigger than the threshold it hides in**:
adding one page fails the over-budget check everywhere, and a genuine 13 KB
regression looks exactly like it.

The same probe run, on the same two builds, gives a figure that mostly does not
move — `ultraminimal`'s own-graph total goes 2744 KB → 2727 KB when
`synteny.astro` is deleted, **0.6%**, against gzip's 2.3%:

| `ultraminimal` | with `synteny` | without | move |
| --- | --- | --- | --- |
| eager gzip (delivered) | 523 KB | 511 KB | 2.3% |
| own-graph, uncompressed | 2744 KB | 2727 KB | 0.6% |

The residual 17 KB is not co-location either — it is treeshaking granularity. A
module keeps more of itself when something else in the bundle uses more of it,
so its `renderedLength` genuinely differs between the two builds. **No
measurement over a shared build removes that**, which is the honest ceiling on
this approach.

Building each page as its own bundle would remove the confound completely, and
it is the wrong trade twice over: twelve builds instead of one, and the number
you get describes a bundle nobody ships — the same page measured alone
treeshakes *smaller*, because less of each shared module is alive. Prefer the
coupled build with an attribution number over an isolated build with a delivered
one.

**If the ratchet moves to it, ratchet proportionally** (~1%), not in absolute KB.
That fits a page addition inside the band while still failing on a 38 KB module
— the size of the MUI `Slider` that section 5 removed. Not done: the delivered
gzip figure is what a reader downloads and is worth continuing to report, so the
change is which number CI *gates* on, and that is a call to make deliberately.

## What is not worth chasing

**Not worth chasing:** the ~1.4 MB raw that remains is dominated by plugin
registration — models, adapters, config schemas for all 18 core plugins — plus
React and MST. That is the engine, and `createViewState`'s contract is that all
of it is registered before a session snapshot can be read.
