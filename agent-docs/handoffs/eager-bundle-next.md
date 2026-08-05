---
name: eager-bundle-next
description: The eager-bundle work queue in the order to take it — why theme-free makeStyles gates the icon registry, what was deliberately not done and why, and the measurement probe worth promoting instead of rebuilding. Read with reference/EAGER_BUNDLE.md before cutting first-paint bytes.
---

# Eager bundle: what to do next

A work queue, in the order I would take it. **What already shipped, the five
pins and the two tooling traps are in
[reference/EAGER_BUNDLE.md](../reference/EAGER_BUNDLE.md)** — read that first;
this file assumes it and only carries what is still open.

Where it stands: the build-your-own site's sparsest page went **347 chunks / 667
KB gzipped → 181 / 464 KB** across three commits (`3e66ae532f`, `1499e29a30`,
`524c2534c1`), rendering the same thing throughout. Guarded per page by
`products/jbrowse-build-your-own/examples-site`'s `pnpm measure-eager-bundle`,
which `pnpm smoke` re-checks as a ceiling **with a ratchet** — so after any win,
re-run it without `--check` and commit, or the next change quietly spends it.

## 1. Theme-free `makeStyles` — the gate, and the one open decision

This is the next real lever and everything else is smaller. `@mui/material/styles`
is ~51 KB of the eager graph and it is held by one six-line module:

```ts
// packages/core/src/util/tss-react/mui/mui.ts
import { useTheme } from '@mui/material/styles'
import { createMakeStyles } from '../makeStyles.tsx'
export const { makeStyles } = createMakeStyles({ useTheme })
```

Eager because **268 `makeStyles` call sites** are, many in modules that must be
evaluated at plugin install. Nothing else keeps that graph alive — verified by
grepping for the first-party module that names it, which is the only check worth
trusting here (see EAGER_BUNDLE.md on why a post-bundler graph walk lied about
exactly this).

The proposal is parked in
[OTHER_IDEAS.md](../OTHER_IDEAS.md), "A theme-free `makeStyles`", and its scope
note there has already been corrected once by this work — read it before costing
this. **What is genuinely undecided:**

- a theme-free `makeStyles` (same API, no `useTheme`) versus a
  `usePalette()`-backed styling helper. The palette already exists and is
  toolkit-free (`packages/core/src/ui/palette.ts`, and `packages/core/src/ui/CLAUDE.md`
  says it is the single source of colour), so the second is the smaller idea —
  but ~268 call sites read `theme.spacing`, `theme.palette.action.hover` and
  friends, not just colours, and nobody has counted which.
- whether stock display components are **required** to use it, which is what
  would make the win durable rather than a one-off sweep.

Counting the `theme.*` members those 268 sites actually touch is the first hour
of this task and would settle the design. It has not been done.

## 2. Icon-name registry for `BaseMenuItem.icon` — gated behind 1, don't do it first

**Decided against as a standalone change, 2026-08-05.** The design is settled;
the arithmetic is not favourable yet:

- 43 eager `@mui/icons-material` modules are **21 KB** of source between them,
  plus `SvgIcon` (3 KB) via `createSvgIcon`. That is the whole prize today —
  under 10 KB gzipped — for changing a **public ABI field** external plugins set,
  across ~39 modules, plus a closed name union and a resolver to keep in step.
- After item 1, the same change is worth ~72 KB instead. **Order matters; this is
  the only reason to wait.**

The design, so it need not be re-derived: follow `TrackControlIcon`
(`plugins/linear-genome-view/src/BaseLinearDisplay/components/trackControl/types.ts`)
— a closed string union with a `satisfies Record<Name, unknown>` map in each
implementation. Widen the field to `React.ElementType | MenuIconName` rather than
replacing it, so in-tree migrates while external plugins keep working
(reference/PLUGIN_ABI_STABILITY.md). The resolver goes on the render side, and
**that side is already lazy** — `CascadingMenu`, `MenuItems` and
`CascadingMenuButton` are all outside the eager set, checked — so named icons
land in the menu chunk with nothing further to arrange.

## 3. The ~58 KB of chunk co-location — untried, and possibly not a task

`ButtonBase`, `Tooltip`, `Button`, `CircularProgress` are still downloaded
eagerly, and **no first-party eager module imports a `@mui/material` component
any more** — checked, not assumed. They arrive because rolldown places a module
reached only through dynamic imports into a chunk something eager also imports.

So this is a chunking question and the lever is `build.rollupOptions` /
`advancedChunks`, not an edit anyone can read in a diff. Low confidence that it
is worth it: chunking config is fragile across bundler upgrades and the win is
invisible in the source. Measure before believing any of it.

## Parked — do not re-propose

- **"Refactor so no dialog is named at module scope."** Floated and set aside as
  niche in the same session. It would buy nothing now: pin 5 already made every
  dialog reached from a model lazy, and the general fact —
  **a dialog opened through `session.queueDialog` can always be `lazy()`, because
  `DialogQueue` Suspense-wraps it** — is recorded in EAGER_BUNDLE.md. A mechanism
  enforcing that costs more than remembering it.
- **Raising a budget in `eagerBundleSizes.json` to make `pnpm smoke` pass.** Same
  rule as `MUI_BUDGET`; the site's CLAUDE.md says why.

## What not to re-derive: the measurement probe

I rebuilt this three times in one session, which is the argument for promoting it
from a throwaway to a committed script — **that is a real recommendation, not an
aside.** Until someone does, the recipe:

A temporary Astro config beside the site's own, adding one Vite plugin that dumps
both halves of the graph, then `npx astro build --config astro.config.probe.tmp.mjs`:

- `buildEnd()` → for every `this.getModuleIds()`, record
  `getModuleInfo(id).importedIds` and `.dynamicallyImportedIds`. This is the
  **pre-treeshake** source graph.
- `generateBundle(_, bundle)` → for every chunk, record `imports`,
  `dynamicImports` and `Object.entries(chunk.modules)` mapped to
  `renderedLength`. This is the **post-treeshake** graph plus per-module bytes.

Neither alone answers anything: the first says what *could* be reached, the
second what survived. Intersecting them turns "is statically reachable" into "is
actually paid for". The eager set is then the closure over chunk `imports` from
the chunks a page's HTML names.

Two things that cost me time and will cost the next person the same:

- **Attribute at module level, never by chunk name.** A rolldown chunk takes the
  name of one of its modules and routinely holds unrelated ones — a chunk called
  `LinearGenomeView` turned out to be mostly the `@jbrowse/core/ui` barrel, and I
  published a wrong 239 KB attribution off it before catching that.
- **Confirm a suspected pin by grepping for the first-party module that names
  it.** Barrels get inlined, so the post-bundle graph is missing edges the source
  has; a BFS over it will tell you a pin is gone when it is not.

The site is rebuilt by other agents while you measure. If a probe run fails on a
missing `dist/_astro`, or a page appears with no budget entry, rebuild and re-run
before believing it — both happened here and neither was a real defect.
