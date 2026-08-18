---
name: examples-sites
description: The rule the four embeddable-product examples sites are built on — every shown example is one complete copy-pasteable file, so shared setup may not be factored out — plus the prose caps, generated artifacts and CI wiring all four share. Read before adding a page, or before "tidying up" the duplication in one.
audience: internal
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

**A config fixture has to be run through `jbrowse validate`, and nothing else
will catch what it finds.** These files are the one part of a site that is
neither typechecked nor exercised by a test, and JBrowse ignores a key it does
not declare rather than reporting it — so a wrong one is invisible on every
check the site runs, including a screenshot, because the page still renders. All
five of the lineargenomeview site's `nextstrain_*.json` carried `height: 400`
and `colorBy: 'region'` on a *session* display node, which MST builds from the
display's state model where both are config slots; both were dropped and the
demo shipped 150px short and unpainted. The react-app site's copy of the volvox
config still has eight of its own. Where a fixture is generated, the generator
validates before it writes (`gen-nextstrain-demos.mjs`); where it is
hand-maintained, validate it when you touch it. ARCHITECTURE.md "Where a
display's state lives" is the underlying rule.

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

**The tell is that the copies are worse than what JBrowse already runs**, and it
has now held six times; in five of them the published version knew something the
copies did not:

| the copies                        | what they were missing                                    | became                                  |
| --------------------------------- | --------------------------------------------------------- | --------------------------------------- |
| a wheel/drag gesture layer, ×8    | rAF batching, the zoom rate limit                          | `usePanZoom`                            |
| `setConf(session, 'theme', …)`, ×8 | `theme` is a frozen slot, so the write discarded the host's own theme | `useSessionPalette` + `setThemeMode`     |
| a region-seam filter, ×3          | elided and past-the-end blocks; and it drew a seam per elided region, which at whole-genome zoom is a grey wall | `view.paddingSpans`      |
| sticky refName labels, ×2         | the same-refName run dedup, the whole-name fit test        | `view.scalebarRefNameLabels`            |
| a rubberband's pointer-capture drag, ×1 | a primary-button guard, so a right-press started a drag under its own context menu and released capture it never took; and one-pointer ownership, so a second finger re-anchored a drag in progress | `usePointerDrag`      |
| `useSessionPalette(session, mode)` + `<PaletteProvider palette={…}>`, ×17 | nothing — every copy was right | `SessionPaletteProvider` |

That is the argument for treating "the examples all write X" as a missing export
rather than a duplication problem: the reader is not merely repeating himself,
he is shipping a worse version of something that already exists, and the site is
teaching him to.

**The last row is the one where the copies were correct, and publishing was
still right.** Two published calls, seventeen faithful copies, no drift. What
made it an export is that the pair has a half a reader can drop and see nothing:
`PaletteProvider` is the discoverable name and colors React alone, while the
hook's `setThemeMode` is what reaches the worker that bakes feature labels into
the image — so a host that mounts the provider by itself gets light-mode labels
on a dark page and no error. A block whose halves fail separately and silently
is a component even when every copy in the repo has both halves, because the
copies are not the population at risk.

**The count is evidence, not the trigger.** The last row is a single copy: the
test is whether an embedder would *have* to write the block, and one hand-rolled
gesture already answers yes, because a gesture is where the knowledge is dense
and the failures are silent — a phone, a second finger, a right-click. Where a
count does gate something it is the other question, `COPY_THRESHOLD` below, which
asks whether copies should exist rather than whether they should be an export.

`jbrowse-build-your-own` asks this question automatically now — see its
`CLAUDE.md` for the `COPIED` list, where a block copied into three or more files
has to carry the reason it is the reader's own to write.

### The mirror-image failure: a copy that drops half of a published contract

Every case above is a block the examples wrote that JBrowse should have
published. The other direction happens too, and nothing here was looking for
it: JBrowse publishes both halves, and the copies use one.

`TrackOverlaySlot` is the host half of `TrackOverlayPortal` — the node a
display's corner controls, colour key, loading scrim and error bar escape into,
out of the `contain: strict` box that is the display's own stacking context.
`TrackContainer` mounts it, its own doc names an embedder mounting
`RenderingComponent` directly as the case it was added for, and fourteen of
BYO's fifteen `TrackRow`s left it out — so all that chrome rendered back inside
the sandbox, under whatever the page painted over the stack.

Three things kept it invisible for as long as it lasted, and each is worth
recognising on the next one:

- **the copies agreed**, so the drift check was silent. Identical says nothing
  about correct.
- **the one page that hit it renamed its version** (`TrackRowWithOverlay`)
  rather than fixing the shape, and a second name reads as a page doing more
  rather than as fourteen pages doing less.
- **the symptom is data-dependent.** Whether a seam is over the corner control
  right now depends on the demo's regions and its zoom, so a census of a page at
  rest reports a healthy page. The check that catches it asks the mechanism —
  is every display inside a slot — not whether anything is covered today.

So the question to add when a block repeats: not only "would the reader have to
write this", but "does this omit a half JBrowse already publishes". The second
one is not answered by reading the copies, since they all read the same.

**It stays the only site with that check, and porting it to the other three was
measured and rejected.** The rule applies to all four, but only this site
repeats *behaviour*: it is the one whose pages draw their own chrome, so a
gesture layer or a piece of block geometry can end up hand-rolled in five files.
What the other three repeat is assemblies, track configs and `ViewState` type
aliases — bulk data by the fixture rule, and correctly copied. A `COPIED` list
there would name those and find nothing, which is the "more entries rather than
a better rule" failure this doctrine warns about two sections up. Re-run the
experiment only if one of them starts drawing its own chrome.

### An engine is built by a hook, never by a `useState` initializer

`useCreateViewState` on every product, or `useCreateOnce`
(`@jbrowse/core/util/hooks`) where the example has to do something to the engine
on the way out and the hook's options blob cannot say it. React double-invokes a
state initializer under StrictMode — on in most app templates, which is where
these files get pasted — and discards the second result, so an engine built in
one is orphaned per mount: an MST tree with live autoruns and a worker pool, and
nothing left holding it. Nothing errors, because the one React kept is fine.

**The helper existing was not enough, which is why this is a check
(`examplesEngineHooks.ts`, run by every site's `pnpm check-links`).** The lgv
site used `useCreateViewState` in all twenty of its examples; react-app used it
in one file and a `useState` initializer in two others, and circular in none —
seventeen demos on `jbrowse-build-your-own` had the same shape. A convention
nobody is reminded of is a convention three files skip.

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

## Contrast is measured, in both themes

`checkTextContrast` (`@jbrowse/browser-test-utils`, wired into all four
`smoke.mjs`) composites every DOM text node's colour against whatever is
actually painted behind it and fails under **3:1**.

It exists because of a specific hole. An example may not use the shell's custom
properties — it has to stay a file the reader can paste — so the demos style
themselves with CSS **system colours**, on the stated grounds that those read
correctly wherever they land. That is only true while `color-scheme` is
declared, and for a long time it wasn't: system colours stayed on the light
palette whatever `data-theme` said, so `color-mix(in srgb, CanvasText 8%,
Canvas)` painted rgb(235,235,235) behind text inheriting rgb(228,230,232). The
notification on BYO's Loading and error states page — the one thing that page
exists to prove a host must draw — was unreadable in dark mode, and every check
was green, on the site whose whole premise is that its claims are measured.

Four things about it are load-bearing, each of which was a way it silently
passed while broken:

- **Both themes, always.** Smoke loads pages in the default theme and headless
  Chrome defaults to light. The bug was dark-only, so a light-only pass would
  have watched it ship. The check toggles `data-theme` itself and restores it.
- **Colours are resolved by painting them**, not by parsing the computed string.
  `color-mix` resolves to `color(srgb …)`, so the first version's `rgb()` regex
  skipped exactly the syntax under test and reported a clean run against the
  bug it was written for.
- **A floor on how much it examined.** A check that reads nothing reports
  nothing, which looks like a pass — an early run served each `dist` without
  stripping the astro `base`, so all four sites were 404 shells and it declared
  four clean sites. Under 25 text elements it now fails instead.
- **Text over a `<canvas>` is skipped structurally**, by asking whether an
  absolutely-positioned ancestor's containing block holds a canvas — never by
  intersecting rectangles. Geometry depends on the canvas having been laid out,
  and on a slow page the feature labels stop being skipped and report as
  white-on-white against their container. That flake was real, alternating
  between 22 findings and none on one page.

3:1 is the large-text AA bound and sits well below anything deliberate (a muted
0.6-alpha hint on this palette is ~5.6:1), so a failure means two colours came
from different themes, never that something could be crisper. Raising it toward
4.5 would start reporting design choices, which is how a check like this gets
muted.

**A state you can only reach by clicking needs its own pass.** The check in each
site's list runs at rest, so it never sees the snackbar that motivated it —
BYO's `viewStatusStatesAreDrawn` calls `checkTextContrast` again once it has
driven one onto the screen. Drawing a thing and being able to read it are two
claims.

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
  `/tmp`) and delete it after; `oxlint` will flag it if you forget. Three traps
  that cost time: `page.mouse.click` uses **viewport** coordinates, so
  `scrollIntoView` the element and re-read its `boundingBox()` first or every
  click lands on `<html>`; **that `scrollIntoView` needs
  `behavior: 'instant'`** rather than the page's own, since under
  `scroll-behavior: smooth` the scroll is still animating when the box is read
  and the click lands wherever the page has slid to by then — reported as the
  same "landed on `<html>`", which reads like a pan handler eating the click and
  is not, and which appears only once a page is long enough to have somewhere to
  scroll. `Shell.astro` set exactly that until 2026-08-07 and it cost a debug
  cycle; the rule survives the removal, because a harness that scrolls at the
  page's pace is depending on CSS it does not own. And whether a hover lands
  on a feature in a headless swiftshader render is luck, which is why
  `BaseTooltip.test.tsx` in `@jbrowse/core` is the deterministic half of the
  tooltip's coverage and the half to extend first.
- Each site is in `push.yml` **twice** — the deploy loop and the
  `examples_site_smoke` matrix — and both enumerate sites by name, so a new site
  is invisible to CI until it is added to both.
