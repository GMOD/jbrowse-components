---
name: eager-bundle
description: What every JBrowse host downloads before it can run, why plugin registration makes most of it unavoidable, and the four pins that were making it pay for far more. Read before touching a plugin `exports` object, a state model's imports, or anything that claims a bundle number.
---

# The eager bundle

## TL;DR

- The **eager set** is the transitive closure over *static* imports from a
  page's entry. Everything JBrowse defers — renderers, display bodies, dialogs
  — is already behind `lazy()`/`import()`, so what remains is plugin
  registration plus whatever accidentally got pinned to it.
- Menu-item builders live in **`@jbrowse/core/ui/menuItems`**, which is React-free
  and guarded by a test. Import builders from there, components from
  `@jbrowse/core/ui`.
- Plugin registration is **genuinely eager and not reducible**: every plugin's
  models, adapters and config schemas must be registered before a session
  snapshot can be read.
- What *is* reducible is the set of **React components a registration-time
  module names**. Three shapes cause almost all of it, none visible in a diff: a
  plugin's `exports` object, a state model importing a component, and a menu-item
  builder returning an element where a description would do.
- Measured and guarded per page by
  `products/jbrowse-build-your-own/examples-site`'s
  `pnpm measure-eager-bundle`, run by that site's `pnpm smoke`. It is a
  **ceiling with a ratchet** — going far enough under a budget fails too.
- Don't reason from chunk *names*. A rolldown chunk is named after one of its
  modules and routinely contains unrelated ones; a chunk called
  `LinearGenomeView` turned out to be the `@jbrowse/core/ui` barrel.

Related: `reference/DISPLAYCHROME.md` "Reach vs weight" (what the two
bring-your-own seams do and don't buy), `reference/PLUGIN_ABI_STABILITY.md` (why
an `exports` entry is hard to remove and easy to make lazy instead),
`OTHER_IDEAS.md` "A theme-free `makeStyles`".

## The number

Measured 2026-08-05 on the build-your-own examples site, whose sparsest page
("One track, no interaction") is a measured div, one wiggle track, and no
JBrowse chrome at all:

| | eager chunks | gzipped |
| --- | --- | --- |
| before | 347 | 667 KB |
| after pins 1-3 | 219 | 523 KB |
| after pin 4 | 218 | 514 KB |

Same page throughout, rendering the same thing. 153 KB gzipped and 129 chunks
were reachable and never used.

## Where it went

Four pins, in the order they were found. All four are the same mistake at
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
getter was deleted for (DISPLAYCHROME.md, "What was deleted with it"). Deleting
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
- **`endAdornment` → `defaultForAll` for the promotable pin.** The two
  `promotable*Item` builders returned a `<DefaultForAllAdornment>` **element**,
  so the module — and every state model calling it — pulled MUI's `ToggleButton`,
  `Tooltip` and two icons. The row now carries a *description*
  (`MenuItemDefaultForAll`) and `menuItemAdornment.tsx` builds the element where
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

## What is left, and what is not worth chasing

**Not worth chasing:** the ~1.5 MB raw that remains is dominated by plugin
registration — models, adapters, config schemas for all 18 core plugins — plus
React and MST. That is the engine, and `createViewState`'s contract is that all
of it is registered before a session snapshot can be read.

**The next two, measured 2026-08-05 after the pass above.** Both are the same
shape as pins 1, 2 and 4, one level further out:

- **Dialog and form components reached from eager models.** The `createViewState`
  chunk statically imports `SubmitDialog`, `NumberTextField` and
  `AddFiltersDialog`, and through them MUI's `TextField` → `Select` → `Modal` →
  `Popover` cluster (~90 KB). The routes are an internet-account model naming its
  login form (`plugins/authentication`'s `ExternalTokenEntryForm`,
  `HTTPBasicLoginForm`) and a display model naming its filter dialog. Each is a
  `lazy()` at the model, the same edit as pin 2.
- **`@mui/material/styles` (~51 KB), now the largest single area.** Reached by
  every `@mui/icons-material` import — ~39 eager menu modules name an icon for a
  row's `icon` field — and by `makeStyles`. `BaseMenuItem.icon` is
  `React.ElementType`, i.e. an element type rather than a name, which is the
  descriptor rule again at a scale worth arguing about before starting: it is the
  field DISPLAYCHROME.md already forbids for track controls. Doing it means a
  name→component registry on the render side. See also OTHER_IDEAS.md, "A
  theme-free `makeStyles`", which is the other half of the same 51 KB.

## How to measure it

`products/jbrowse-build-your-own/examples-site/scripts/measureEagerBundle.mjs`
does it from the built `dist/`, with `es-module-lexer` — which is the one thing
that reliably tells a static import from a dynamic one in minified output. Two
traps cost real time on the way to the numbers above:

- **Chunk names lie.** A rolldown chunk takes the name of one of its modules and
  may contain many unrelated ones. "Cutting the `LinearGenomeView` chunk saves
  239 KB" was measured, published to a scratch file, and wrong: that chunk was
  mostly `@jbrowse/core/ui`. Attribute at module level, via rolldown's own
  `chunk.modules`, or don't attribute.
- **esbuild is not a stand-in for the real build.** An esbuild
  `splitting: true` metafile is far quicker to produce and disagreed with
  rolldown in both directions — it called `@mui/x-data-grid` eager when the real
  build splits it out, and missed pins the real build keeps. Use it to explore;
  measure on `dist/`.

For attribution, the tool worth rebuilding is a throwaway Vite plugin dumping
`this.getModuleInfo(id).importedIds` in `buildEnd` and `chunk.modules` in
`generateBundle`, then a BFS over that. Note that the pre-treeshake graph
(`getModuleInfo`) and the post-treeshake one (`chunk.modules`) answer different
questions and neither alone is enough: intersecting them is what turns "is
statically reachable" into "is actually paid for".
