---
name: examples-sites
description: The rule the four embeddable-product examples sites are built on — every shown example is one complete copy-pasteable file, so shared setup may not be factored out — plus the prose caps, generated artifacts and CI wiring all four share. Read before adding a page, or before "tidying up" the duplication in one.
---

# Examples sites

Four Astro sites at `products/*/examples-site`, one per embeddable product
(`jbrowse-react-linear-genome-view`, `jbrowse-react-circular-genome-view`,
`jbrowse-react-app`, `jbrowse-build-your-own`). This is the doctrine all four
share; each site's own `CLAUDE.md` holds only what is local to it.

## Every shown example is one complete, copy-pasteable file

Each page renders a demo and shows that demo's own source via `?raw`. A reader
has to be able to select that block, paste it into their app, and run it.

So an example file may import **only from published packages** — the site's own
product, `@jbrowse/core/*`, `@jbrowse/plugin-*`, `@mui/material`, `react`,
`mobx-react`. No relative import into the site's own helpers. Check with:

```sh
grep "from '\./\|from '\.\./" src/examples/*.tsx
```

**Do not factor the shared parts out.** Pulling the repeated setup into a
`src/browser/`-style module is the obvious tidy-up, it makes a site pleasant to
maintain, and it destroys the product: every page's source becomes a list of
paths the reader cannot resolve. `jbrowse-build-your-own` was built that way
first and had to be rewritten. A second `?raw` code block showing the helper is
not a fix. It is the admission that the first block was incomplete.

Duplication across example files is correct here. The pages diverge as they add
features anyway, and each one has to read top to bottom on its own. Where a
block is repeated verbatim, give it a one-line pointer to the page that explains
it (`// see the Pan and zoom page for why this listener is non-passive`) rather
than repeating the reasoning on every page.

The one allowed exception is **bulk data**: a `*.json` fixture may be imported,
because inlining a 72 KB config would bury the code the page is about. Data
only, never code. Snippets in `.astro` prose are held to the same bar: write the
generic call as a literal, never `?raw` a private helper of the site.

### The one good way out is to publish the block

A repeated block falls into two kinds, and only one of them is a site's own
content. Mounting a display is what the reader came to see, and the box it goes
in is theirs to style. A gesture layer was not: every page carried ~150
identical lines of wheel handling, drag loop and hint timer, and what they
carried was a _worse_ implementation than the one JBrowse itself ships, since it
batched nothing and rate-limited nothing. That is not a duplication problem, it
is a missing export. It became `@jbrowse/core/util/usePanZoom`, the LGV's own
copy of the wheel half was deleted, and every page went down by a third with
nothing lost from what it teaches.

So when a block repeats: ask whether an embedder would have to write it. If yes,
it belongs in a package and the example imports it like any reader would — which
also puts it under a real test, where a site-local helper never is. If no, it
stays copied.

## The demo comes first on the page

`ExampleSection` renders **heading → demo → doc → source**, and all four sites
agree on it. The demo is the argument and the prose is the annotation on it;
with the doc first a reader met several paragraphs and a code fence before any
evidence that any of it worked. The source stays last, open rather than behind a
collapsed toggle, because it is what you read once the demo has convinced you.

The corollary is that **a doc must not restate what the source below it says.**
A fence that is a slice of the example file is the commonest way one of these
pages gets long; write the fence only when it shows something the source can't —
an alternative form, a bundler setting, a CLI invocation.

`checkDemoAboveFold` in `pnpm smoke` holds the order to its actual claim: the
first `.demo` on every page has to begin above the fold at 1440x900. It is
geometry, not paint, so it works whether or not the island drew — the box owns
its height first, which is what `demoHeights` is for. Measured across all four
sites the worst page starts at 553px of 900, so there is real headroom before it
fires; what it catches is the quiet regression, a paragraph added to a lead or a
fourth section added to a page's "On this page" card.

### Why `ExampleSection.astro` is four copies and stays that way

`Shell.astro`, `Gallery.astro` and `exampleModel.ts` live in
`examples-site-shared/` and are symlinked in. `ExampleLayout.astro` and
`ExampleSection.astro` look like the obvious next candidates — after the
demo-first change three of the four differ only in whether they render a
section `description` as a lead — and they are not, because **a symlinked file
may have no relative imports.** `astro check` resolves one from the symlink's
own directory and vite from the file's real path, so the two disagree.
`exampleModel.ts` survives symlinking only because it imports nothing.

`ExampleSection` reads `../siteMeta.ts` for `demoHeights` and `demoFillHeight`,
which is per-site by construction. Routing that through props instead means
every one of the ~40 page files threading site config into each `<Section>`,
which is worse than four copies. Don't retry this without solving the resolver
disagreement first.

## Pages and groups

One page is one sidebar entry, and a page may stack several sections — that is
what `ExamplePage.sections` is for, and it is how the sidebar stays short while
the examples stay separate. **Cap a page at four sections**: each one is a
`client:only` island that hydrates a whole genome engine on load, so a fifth is
paid for on every visit.

**A group holding one page is a heading that costs a line and earns nothing.**
Text search belongs under Navigation, theming under Tracks, plugins under
Getting started. The sidebar and the index gallery both derive their group order
from first appearance in `pages`, so **keep that array group-contiguous** —
moving a page between groups means moving it in the array too, or its group box
gets a second, separated run of entries.

## Prose

- **Never restate a measurable number.** If a page needs one, generate it and
  register the generator in `pnpm autogen`, so CI re-checks it and the prose
  cannot drift.
- **Prose is capped, and `pnpm check-links` enforces it.** A `src/docs/*.md`
  over 300 words (fenced code excluded, since a page whose length is a config
  example is doing its job) or a page/section `description` over 160 characters
  fails; over 200 words prints as advisory so the trend shows first. These pages
  are a live demo plus its own source — the prose names the API and flags the
  gotchas that cost an hour, and nothing more.

  The cap was 500/350, and every doc on all four sites was rewritten against
  300/200, because a doc allowed 500 words reliably spends them: on a demo the
  reader can just look at, on a paragraph restating the source directly below
  it, and on a closing pile of reference links. 300 words is roughly a screen,
  which is the right budget for an annotation. A page that needs more than that
  is a tutorial on `website/docs` with a link to it from here, not a longer doc.
- A single-section page's **section-level `description` renders nowhere** — the
  "On this page" card is only drawn for multi-section pages — so don't write
  one. Three sites had accumulated exact duplicates of the page description
  there.
- **Every section needs its `src/docs/<slug>.md`.** `ExampleSection` renders
  nothing when the file is absent, so a page can ship as a title, a one-line
  lead and 400 lines of source with no explanation. `pnpm check-links` fails on
  a missing doc and on an orphan one (prose whose section was renamed out from
  under it).

## Generated artifacts and CI

- **`demoHeights.json` is generated, and it is an input to the build** — every
  site except `jbrowse-react-app`, whose demos are pinned at `80vh` in CSS.
  Every demo is a `client:only` island, and Astro gives an island
  `display: contents`, so its box is empty and 0 high until React hydrates,
  several hundred KB later, at which point everything below it drops. The
  generated height is reserved on the box as a `min-height` so that doesn't
  happen, and it is what earns the box its loading skeleton (styled on the
  island's `:empty` state, so it ends itself when React appends — no JS and no
  timer, and it has to be out of flow, since these boxes are `border-box` and an
  in-flow child sized off the same min-height overflows by the border). Write it
  with `pnpm build && pnpm measure-demo-heights && pnpm build` — twice, because
  unlike the other generated artifacts this one is consumed by the build rather
  than only checked after it. Never by hand.

  The figure is the **tallest** the demo gets: too small jumps the page, too
  large only leaves space inside the demo's own border, which is why the
  generator measures at two widths and why the smoke check's two edges have
  different tolerances. The narrow probe is 840px because a content column is
  narrowest just _above_ the 820px sidebar breakpoint. A demo whose height
  depends on its data (a fit-height mode) can't be pinned this way at all.
- The demo runs in a browser, so verify with `pnpm build && pnpm smoke` rather
  than reasoning about it. `pnpm typecheck` is `astro check`.
- **For anything smoke can't see, a throwaway puppeteer probe against the built
  `dist/` is the pattern** — serve `dist/`, strip the Astro base,
  `--use-gl=swiftshader`, settle ~7s, then measure. Write it as a `.tmp.mjs`
  **inside the site directory** (workspace module resolution does not reach
  `/tmp`) and delete it after; `oxlint` will flag it if you forget. Two traps
  that cost time: `page.mouse.click` uses **viewport** coordinates, so
  `scrollIntoView` the element and re-read its `boundingBox()` first or every
  click lands on `<html>`; and whether a hover lands on a feature in a headless
  swiftshader render is luck, which is why `BaseTooltip.test.tsx` in
  `@jbrowse/core` is the deterministic half of the tooltip's coverage and the
  half to extend first.
- Each site is in `push.yml` **twice** — the deploy loop and the
  `examples_site_smoke` matrix — and both enumerate sites by name, so a new site
  is invisible to CI until it is added to both.
