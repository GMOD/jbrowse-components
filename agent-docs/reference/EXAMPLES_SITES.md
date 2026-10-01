---
name: examples-sites
description: The rule the four embeddable-product examples sites are built on — every example is one complete copy-pasteable file, so shared setup may not be factored out — plus their prose caps and CI wiring. Read before adding a page or tidying the duplication.
audience: internal
kind: operations
---

# Examples sites

Four Astro sites at `products/*/examples-site`, one per embeddable product
(`jbrowse-react-linear-genome-view`, `jbrowse-react-circular-genome-view`,
`jbrowse-react-app`, `jbrowse-build-your-own`). This is the doctrine all four
share; each site's own `CLAUDE.md` holds only what is local to it.

## Every shown example is one complete, copy-pasteable file

Each page renders a demo and shows that demo's own source via `?raw`. A reader
has to be able to paste that block into their app and run it.

So an example file imports **only from published packages**: the site's own
product, `@jbrowse/core/*`, `@jbrowse/plugin-*`, `@mui/material`, `react`,
`mobx-react`. No relative import into the site's own helpers:

```sh
grep "from '\./\|from '\.\./" src/examples/*.tsx
```

**Do not factor the shared parts out.** A `src/browser/`-style helper module
makes a site pleasant to maintain and turns every page's source into paths the
reader cannot resolve; `jbrowse-build-your-own` was built that way first and
had to be rewritten. A second `?raw` block showing the helper admits the first
was incomplete. Duplication across example files is correct here. Where a block
repeats verbatim, give it a one-line pointer to the page that explains it rather
than repeating the reasoning.

The one exception is **bulk data**: a `*.json` fixture may be imported, because
inlining a large config buries the code the page is about. Data only, never
code. Snippets in `.astro` prose meet the same bar: write the generic call as a
literal, never `?raw` a private helper.

**Run a config fixture through `jbrowse validate`.** Fixtures are neither
typechecked nor exercised by a test, and JBrowse ignores an undeclared key
rather than reporting it, so a wrong one passes every check including a
screenshot. A config slot written on a session display node is the usual case:
MST drops it and the demo renders wrong with no error (ARCHITECTURE.md "Where a
display's state lives"). A generated fixture's generator validates before
writing (`gen-nextstrain-demos.mjs`); validate a hand-maintained one when you
touch it.

### The one good way out is to publish the block

**When a block repeats, ask whether an embedder would have to write it.** If
yes, it belongs in a package and the example imports it like any reader would,
which also puts it under a real test. If no, it stays copied. The count is
evidence, not the trigger: one hand-rolled gesture layer already answers yes,
because gestures are where the knowledge is dense and the failures silent (a
phone, a second finger, a right-click).

**The tell is that the copies are worse than what JBrowse already runs.** Every
published replacement so far fixed something the copies missed: rAF batching
and the zoom rate limit (`usePanZoom`), a frozen `theme` slot the copies wrote
to (`useSessionPalette` + `setThemeMode`), elided-region seams (`view.paddingSpans`),
refName label dedup (`view.scalebarRefNameLabels`), right-press and
second-finger handling (`usePointerDrag`), the mount's overlay slot (`Track`,
`ViewStatus`, `TrackStack`, `RegionSeams`, `Scalebar`, `LocationBox`,
`Highlights`, `TrackToggle`, `EmbedProvider` in `@jbrowse/display-ui/embed`).
Reach for those before writing a block they cover.

**A block whose halves fail separately and silently is a component, even when
every copy is correct.** `SessionPaletteProvider` replaced faithful copies of
`useSessionPalette` + `<PaletteProvider>`, because `PaletteProvider` alone
colours React while only the hook's `setThemeMode` reaches the worker that
bakes feature labels: a host mounting the provider by itself gets light labels
on a dark page and no error.

`jbrowse-build-your-own` asks the question automatically: its `CLAUDE.md`
`COPIED` list requires a block copied into three or more files to carry the
reason it is the reader's own to write.

### The mirror-image failure: a copy that drops half of a published contract

JBrowse can publish both halves of a contract while the copies use one.
`TrackOverlaySlot` is the host half of `TrackOverlayPortal`: the node a
display's corner controls, colour key, loading scrim and error bar escape into,
out of the display's `contain: strict` box. Hand-written track rows that mount
`RenderingComponent` without it render all that chrome back inside the box,
under whatever the page paints over the stack.

Three things keep that failure invisible:

- **The copies agree**, so a drift check is silent. Identical says nothing about
  correct.
- **A page that hits it renames its version** rather than fixing the shape, and
  a second name reads as a page doing more.
- **The symptom is data-dependent.** Whether a seam covers a corner control
  depends on regions and zoom, so a census at rest reports a healthy page. Check
  the mechanism (is every display inside a slot), not whether anything is
  covered today.

So the second question when a block repeats: "does this omit a half JBrowse
already publishes?" Reading the copies cannot answer it.

Declined: porting the `COPIED` check to the other three sites. Only
build-your-own draws its own chrome and so repeats *behaviour*; the others
repeat assemblies, track configs and type aliases, which are bulk data. Re-run
the question only if one of them starts drawing its own chrome.

### An engine is built by a hook, never by a `useState` initializer

Use `useCreateViewState` on every product, given options or, when building
takes more than one call (a fetched config, `loadPlugins`, a session restored
from the URL), an async function returning the engine. `useCreateOnce`
(`@jbrowse/core/util/hooks`) is for an engine built synchronously that must
catch what it throws. React double-invokes a state initializer under
StrictMode, on in most app templates where these files get pasted, and
discards the second result, so an engine built in one is orphaned per mount:
an MST tree with live autoruns and a worker pool. Nothing errors. An engine
built in a `useEffect` has the same problem.

`examplesEngineHooks.ts`, run by every site's `pnpm check-links`, enforces this,
because the convention alone was skipped on three of the four sites.

## The demo comes first on the page

`ExampleSection` renders **heading → demo → doc → source** on all four sites.
The demo is the argument and the prose annotates it; the source stays last and
open, not behind a toggle. **A doc must not restate what the source below it
says**: write a fence only for what the source can't show (an alternative form,
a bundler setting, a CLI invocation).

`checkDemoAboveFold` in `pnpm smoke` requires the first `.demo` on every page to
begin above the fold at 1440x900. It checks geometry, not paint, so it works
whether or not the island drew; the box owns its height first via
`demoHeights`. It catches a lead paragraph or an "On this page" entry pushing
the demo down.

### Why `ExampleSection.astro` is four copies and stays that way

`Shell.astro`, `Gallery.astro` and `exampleModel.ts` live in
`examples-site-shared/` and are symlinked in. `ExampleLayout.astro` and
`ExampleSection.astro` cannot follow, because **a symlinked file may have no
relative imports**: `astro check` resolves one from the symlink's directory and
vite from the file's real path. `exampleModel.ts` survives only because it
imports nothing. `ExampleSection` reads `../siteMeta.ts` for `demoHeights` and
`demoFillHeight`, which is per-site, and threading that through props from
every page file is worse than four copies. Don't retry without solving the
resolver disagreement first.

## Pages and groups

One page is one sidebar entry, and a page may stack several sections
(`ExamplePage.sections`). **Cap a page at four sections**: each is a
`client:only` island that hydrates a whole genome engine on load.
`pnpm check-links` fails a fifth (`findCrowdedPages`).

**A group holding one page is a heading that earns nothing**; fold it into a
neighbour. The sidebar and the index gallery derive group order from first
appearance in `pages`, so **keep that array group-contiguous**, or a moved
page's group gets a second, separated run of entries.

## Prose

- **Never restate a measurable number.** If a page needs one, generate it and
  register the generator in `pnpm autogen`.
- **The code and the demo do the talking.** An example file carries no
  comments, and a section's `src/docs/<slug>.md` is optional: write one only
  for what the demo and source cannot show. When an example is too long to read
  at a glance, publish a helper that shortens it rather than explaining it
  (`@jbrowse/display-ui/embed` is the pattern). `pnpm check-links` caps a doc
  and a page's own prose at 60 words and a description at 80 characters, and
  reports an orphan doc whose section was renamed.
- A single-section page's **section-level `description` renders nowhere** (the
  "On this page" card is drawn only for multi-section pages), so don't write
  one.

## Contrast is measured, in both themes

`checkTextContrast` (`@jbrowse/browser-test-utils`, wired into all four
`smoke.mjs`) composites every DOM text node's colour against what is actually
painted behind it and fails under **3:1**.

Examples may not use the shell's custom properties (they must stay pasteable),
so demos style themselves with CSS **system colours**. Those read correctly only
while `color-scheme` is declared; without it they stay on the light palette
whatever `data-theme` says, and dark-mode text lands on a light mix.

Four properties are load-bearing, each a way the check once passed while broken:

- **Both themes, always.** Headless Chrome defaults to light. The check toggles
  `data-theme` itself and restores it.
- **Colours are resolved by painting them**, not by parsing the computed string.
  `color-mix` resolves to `color(srgb …)`, which an `rgb()` regex skips.
- **A floor on how much it examined.** A check that reads nothing reports
  nothing; under 25 text elements it fails (a `dist` served without stripping
  the Astro `base` is all 404 shells).
- **Text over a `<canvas>` is skipped structurally**, by asking whether an
  absolutely-positioned ancestor's containing block holds a canvas, never by
  intersecting rectangles, which depend on layout timing and flake.

3:1 is the large-text AA bound, so a failure means two colours came from
different themes. Raising it toward 4.5 would start reporting design choices,
which is how a check like this gets muted.

**A state reachable only by clicking needs its own pass.** The check runs at
rest; BYO's `viewStatusStatesAreDrawn` calls `checkTextContrast` again once it
has driven a status notification onto the screen.

## Generated artifacts and CI

- **`demoHeights.json` is generated, and it is an input to the build** (every
  site except `jbrowse-react-app`, whose demos are pinned at `80vh` in CSS).
  Astro gives a `client:only` island `display: contents`, so its box is 0 high
  until React hydrates and everything below it drops. The generated height is
  reserved as a `min-height`, which also earns the box its loading skeleton,
  styled on the island's `:empty` state and out of flow (the boxes are
  `border-box`, so an in-flow child sized off the same min-height overflows).
  Write it with `pnpm build && pnpm measure-demo-heights && pnpm build`, twice
  because the build consumes it. Never by hand.

  The figure is the **tallest** the demo gets: too small jumps the page, too
  large only leaves space inside the demo's border. The generator measures at
  two widths, the narrow one 840px because a content column is narrowest just
  above the 820px sidebar breakpoint. A demo whose height depends on its data (a
  fit-height mode) can't be pinned this way.
- Verify with `pnpm build && pnpm smoke` rather than reasoning about it.
  `pnpm typecheck` is `astro check`.
- **For anything smoke can't see, write a throwaway puppeteer probe against the
  built `dist/`**: serve `dist/`, strip the Astro base, `--use-gl=swiftshader`,
  settle ~7s, then measure. Put it as a `.tmp.mjs` **inside the site directory**
  (workspace module resolution does not reach `/tmp`) and delete it after;
  `oxlint` flags a leftover. Traps:
  - `page.mouse.click` uses **viewport** coordinates, so `scrollIntoView` the
    element and re-read its `boundingBox()` first, or every click lands on
    `<html>`.
  - Pass `behavior: 'instant'` to that `scrollIntoView`. Under
    `scroll-behavior: smooth` the scroll is still animating when the box is
    read, which also reports as a click on `<html>` and looks like a pan
    handler eating it.
  - Whether a hover lands on a feature in a headless swiftshader render is
    luck; `BaseTooltip.test.tsx` in `@jbrowse/core` is the deterministic half
    of tooltip coverage and the one to extend.
- Each site is in `push.yml` **twice**, the deploy loop and the
  `examples_site_smoke` matrix, and both enumerate sites by name, so a new site
  is invisible to CI until it is added to both.
