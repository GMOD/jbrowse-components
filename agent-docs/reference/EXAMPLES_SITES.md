---
name: examples-sites
description: What rules do the four embeddable-product examples sites follow — every example is one complete copy-pasteable file, so shared setup may not be factored out — plus their prose caps and CI wiring?
audience: internal
kind: operations
---

# Examples sites

Four Astro sites at `products/*/examples-site`, one per embeddable product
(`jbrowse-react-linear-genome-view`, `jbrowse-react-circular-genome-view`,
`jbrowse-react-app`, `jbrowse-build-your-own`). This is the doctrine all four
share; each site's own `CLAUDE.md` holds only what is local to it.

## Every shown example is one complete, copy-pasteable file

Each page shows its demo's own source via `?raw`, and a reader has to be able to
paste that block into their app and run it. An example file imports only from
published packages (the site's product, `@jbrowse/core/*`, `@jbrowse/plugin-*`,
`@mui/material`, `react`, `mobx-react`), never a relative import into the site's
own helpers:

```sh
grep "from '\./\|from '\.\./" src/examples/*.tsx
```

**Do not factor the shared parts out.** A `src/browser/`-style helper turns every
page's source into paths the reader cannot resolve; `jbrowse-build-your-own` was
built that way first and had to be rewritten. Duplication across example files is
correct here. The one exception is bulk data: a `*.json` fixture may be imported,
never code. Snippets in `.astro` prose meet the same bar.

**Run a config fixture through `jbrowse validate`.** Fixtures are neither
typechecked nor tested, and JBrowse ignores an undeclared key, so a wrong one
passes every check including a screenshot. A config slot written on a session
display node is the usual case: MST drops it and the demo renders wrong with no
error (ARCHITECTURE.md "Where a display's state lives"). A generated fixture's
generator validates before writing (`gen-nextstrain-demos.mjs`).

### Publish a repeated block when an embedder would write it

When a block repeats, ask whether an embedder would have to write it. If yes, it
belongs in a package and the example imports it, which also puts it under a real
test. If no, it stays copied. Every published replacement so far fixed something
the copies missed (`usePanZoom`, `useSessionPalette` + `setThemeMode`,
`view.paddingSpans`, `view.scalebarRefNameLabels`, `usePointerDrag`, and the
overlay components in `@jbrowse/display-ui/embed`); reach for those before
writing a block they cover.

**A block whose halves fail separately and silently is a component, even when
every copy is correct.** `PaletteProvider` alone colours React while only the
hook's `setThemeMode` reaches the worker that bakes feature labels, so a host
mounting the provider by itself gets light labels on a dark page and no error;
`SessionPaletteProvider` replaced the copies.

**A copy can drop half of a published contract while all copies agree.**
`TrackOverlaySlot` is the host half of `TrackOverlayPortal`: hand-written track
rows that mount `RenderingComponent` without it render the display's corner
controls, colour key and error bar back inside its `contain: strict` box. A drift
check is silent because identical says nothing about correct, and the symptom is
data-dependent (whether a seam covers a control depends on regions and zoom). So
the second question is "does this omit a half JBrowse already publishes?", and
the check is the mechanism (is every display inside a slot), not whether anything
is covered today.

`jbrowse-build-your-own`'s `CLAUDE.md` `COPIED` list requires a block copied into
three or more files to carry the reason it is the reader's own to write.
Declined: porting that check to the other three sites, which repeat bulk data
rather than behaviour. Re-run the question if one starts drawing its own chrome.

### An engine is built by a hook, never by a `useState` initializer

Use `useCreateViewState` on every product (options, or an async function when
building takes more than one call). `useCreateOnce` (`@jbrowse/core/util/hooks`)
is for an engine built synchronously that must catch what it throws. React
double-invokes a state initializer under StrictMode and discards the second
result, so an engine built in one is orphaned per mount: an MST tree with live
autoruns and a worker pool, with no error. An engine built in a `useEffect` has
the same problem. `examplesEngineHooks.ts`, run by every site's
`pnpm check-links`, enforces this.

## The demo comes first on the page

`ExampleSection` renders heading, demo, doc, source on all four sites. A doc must
not restate what the source below it says. `checkDemoAboveFold` in `pnpm smoke`
requires the first `.demo` on every page to begin above the fold at 1440x900; the
box owns its height first via `demoHeights`.

### Why `ExampleSection.astro` is four copies

`Shell.astro`, `Gallery.astro` and `exampleModel.ts` live in
`examples-site-shared/` and are symlinked in. `ExampleLayout.astro` and
`ExampleSection.astro` cannot follow, because a symlinked file may have no
relative imports: `astro check` resolves one from the symlink's directory and vite
from the file's real path. `ExampleSection` reads the per-site `../siteMeta.ts`.
Don't retry without solving the resolver disagreement first.

## Pages and groups

**Cap a page at four sections**: each is a `client:only` island that hydrates a
whole genome engine on load (`findCrowdedPages`, `pnpm check-links`). A group
holding one page earns nothing; fold it into a neighbour. Group order derives from
first appearance in `pages`, so keep that array group-contiguous.

## Prose

- Never restate a measurable number; generate it and register the generator in
  `pnpm autogen`.
- An example file carries no comments, and a section's `src/docs/<slug>.md` is
  optional. `pnpm check-links` caps a doc and a page's own prose at 60 words and a
  description at 80 characters. When an example is too long to read at a glance,
  publish a helper that shortens it rather than explaining it.
- A single-section page's section-level `description` renders nowhere.

## Contrast is measured, in both themes

`checkTextContrast` (`@jbrowse/browser-test-utils`, wired into all four
`smoke.mjs`) fails any DOM text under 3:1 against what is painted behind it.
Examples may not use the shell's custom properties (they must stay pasteable), so
demos use CSS system colours, which read correctly only while `color-scheme` is
declared. Each property below is a way the check once passed while broken:

- **Both themes, always**: headless Chrome defaults to light.
- **Colours are resolved by painting them**, not by parsing the computed string
  (`color-mix` resolves to `color(srgb …)`, which an `rgb()` regex skips).
- **A floor on how much it examined**: under 25 text elements fails.
- **Text over a `<canvas>` is skipped structurally**, via the containing block of
  an absolutely-positioned ancestor, never by intersecting rectangles.

Raising 3:1 toward 4.5 would start reporting design choices, which is how a check
like this gets muted. A state reachable only by clicking needs its own pass
(`viewStatusStatesAreDrawn` in BYO).

## Generated artifacts and CI

- **`demoHeights.json` is generated and is an input to the build** (every site
  except `jbrowse-react-app`). Astro gives a `client:only` island `display:
  contents`, so its box is 0 high until React hydrates; the generated height is
  reserved as a `min-height`. Write it with `pnpm build && pnpm
  measure-demo-heights && pnpm build`, never by hand. The figure is the tallest
  the demo gets, so a fit-height demo can't be pinned this way.
- Verify with `pnpm build && pnpm smoke`; `pnpm typecheck` is `astro check`.
- For anything smoke can't see, write a throwaway puppeteer probe as a `.tmp.mjs`
  inside the site directory (workspace resolution does not reach `/tmp`) against
  the built `dist/`, and delete it after; `oxlint` flags a leftover.
  `page.mouse.click` uses viewport coordinates, so `scrollIntoView` with
  `behavior: 'instant'` and re-read `boundingBox()` first, or every click lands on
  `<html>`.
- Each site is in `push.yml` twice, the deploy loop and the `examples_site_smoke`
  matrix, both by name, so a new site is invisible to CI until added to both.
