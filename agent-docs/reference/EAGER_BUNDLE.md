---
name: eager-bundle
description: What every JBrowse host downloads before it can run, why plugin registration makes most of it unavoidable, and the five pins that were making it pay for far more. Read before touching a plugin `exports` object, a state model's imports, or anything that claims a bundle number.
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
- **A dialog opened through `session.queueDialog` can always be `lazy()`** —
  `DialogQueue` already Suspense-wraps it. A model naming one directly was the
  single cheapest win of the five.
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
| after pin 5 | 181 | 464 KB |

Same page throughout, rendering the same thing. 203 KB gzipped and 166 chunks
were reachable and never used.

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

### 5. Dialogs named by the models that open them

The largest of the five after the registry, and the cheapest: **523 → 464 KB
gzipped, 218 → 181 chunks**, for three import lines.

Three state models named a dialog at module scope:

- `plugins/variants/src/LDDisplay/shared.ts` → `LDFilterDialog`,
  `AddFiltersDialog`, and through them `JexlFilterDialog` → `SubmitDialog` →
  `Dialog`
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

## What is left, and what is not worth chasing

**Not worth chasing:** the ~1.4 MB raw that remains is dominated by plugin
registration — models, adapters, config schemas for all 18 core plugins — plus
React and MST. That is the engine, and `createViewState`'s contract is that all
of it is registered before a session snapshot can be read.

**Also not worth chasing: `ButtonBase`, `Tooltip`, `Button`, `CircularProgress`
(~58 KB).** As of pin 5, **no first-party eager module imports a
`@mui/material` component at all** — checked, not assumed. These arrive by
rolldown putting a module reached only through dynamic imports into a chunk
something eager also imports. That is a chunking question, not a source one, and
the answer would be `advancedChunks` config rather than an edit anyone can read.

**An icon-name registry for `BaseMenuItem.icon` is NOT the next lever, and this
is the correction to an earlier draft of this file that said it was.** The claim
was that `icon` being a `React.ElementType` costs the ~51 KB
`@mui/material/styles` graph. Measured 2026-08-05, it does not:

- the 43 eager `@mui/icons-material` modules are **21 KB** of source between
  them, plus `SvgIcon` (3 KB) reached through `createSvgIcon`;
- `@mui/material/styles` is held by **`packages/core/src/util/tss-react/mui/mui.ts`**,
  a six-line module whose only content is
  `import { useTheme } from '@mui/material/styles'` feeding `createMakeStyles`.
  It is eager because 268 `makeStyles` call sites are, and it has nothing to do
  with icons.

So a registry buys ~24 KB of source — well under 10 KB gzipped — in exchange for
changing a **public ABI field** that external plugins set, across ~39 modules,
plus a closed name union and a resolver to keep in step. The mechanism would
work (`CascadingMenu`, `MenuItems` and `CascadingMenuButton` are all lazy
already, so named icons would land in the menu chunk), and it is the right shape
by the descriptor rule — it is simply not worth it at this size.

**The ordering is the point: do the theme-free `makeStyles` first**
(OTHER_IDEAS.md, "A theme-free `makeStyles`"). That is what releases the 51 KB,
and it makes the icon registry worth ~72 KB instead of ~24 KB. Done in the other
order, the icon work is a large ABI change for a small number and the big half
stays put.

**How the earlier draft got it wrong, since the same trap is easy to re-enter.**
A module-level BFS "is `styles` still reachable if I refuse to walk through an
icon?" answered *no* — because rolldown **inlines** barrels, so the surviving
graph has no edge where the source has one, and the probe's regex was looking for
`styles/useTheme.mjs` when the real edge is to `styles/index.mjs`. Two ways to be
wrong at once, both silent. Check a suspected pin by finding the **first-party**
module that names it (`grep` the source), not by trusting a graph walk that has
been through a bundler.
