# examples-site

## Every shown example is one complete, copy-pasteable file

Each page renders a demo and shows that demo's own source via `?raw`. A reader
has to be able to select that block, paste it into their app, and run it.

So an example file may import **only from published packages**:
`@jbrowse/react-linear-genome-view2`, `@jbrowse/core/*`, `@jbrowse/plugin-*`,
`@mui/material`, `react`, `mobx-react`. No relative import into this site's own
helpers. Check with:

```sh
grep "from '\./\|from '\.\./" src/examples/*.tsx
```

**Do not factor the shared parts out.** Pulling `TrackRow`, `ZoomHint` and the
engine setup into a `src/browser/` module is the obvious tidy-up, it makes the
site pleasant to maintain, and it destroys the product: every page's source
becomes a list of paths the reader cannot resolve. This site was built that way
first and rewritten. A second `?raw` code block showing the helper is not a fix.
It is the admission that the first block was incomplete.

**There is one other way out, and it is the good one: publish the block.** A
repeated block falls into two kinds, and only one of them is this site's
content. `TrackRow` is content — mounting a display is what the reader came to
see, and the box it goes in is theirs to style. The gesture layer was not: every
page carried ~150 identical lines of wheel handling, drag loop and hint timer,
and what they carried was a _worse_ implementation than the one JBrowse itself
ships, since it batched nothing and rate-limited nothing. That is not a
duplication problem, it is a missing export. It became
`@jbrowse/core/util/usePanZoom` (with `useWidthSetter`, which already existed
and nobody here had found), the LGV's own copy of the wheel half was deleted,
and every page went down by a third with nothing lost from what it teaches.

So when a block repeats: ask whether an embedder would have to write it. If yes,
it belongs in a package and the example imports it like any reader would — which
also puts it under a real test, where a site-local helper never is. If no, it
stays copied.

Duplication across example files is correct here. The pages diverge as they add
features anyway, and each one has to read top to bottom on its own. Where a
block is repeated verbatim, give it a one-line pointer to the page that explains
it (`// see the Pan and zoom page for why this listener is non-passive`) instead
of repeating the reasoning five times.

`scripts/check-duplication.mjs` (run by `pnpm check-links`) holds that rule up
from the other side: two top-level blocks with the same name in two example
files must be identical once comments are stripped. It exists because the cost
of the rule is drift — a pan-handler fix has to land in five files, and the file
that gets missed is a page teaching a bug with nothing to say so. A block that
genuinely differs per page goes in the script's `DIVERGES` map **with a
reason**. Keep that list short: if it starts growing, the shared surface has
outgrown copy-paste and the answer is a different rule argued here, not more
entries.

The one allowed exception is **bulk data**: a `*.json` fixture may be imported,
because inlining a 72 KB config would bury the code the page is about. Data
only, never code.

Snippets in `.astro` prose are held to the same bar: write the generic call as a
literal, never `?raw` a private helper of this site.

## Other rules

- Prose in `src/docs/*.md` must not restate a measurable number. If a page needs
  one, generate it. See `scripts/measureChromeBundle.ts` and its `pnpm autogen`
  entry, which is where the chrome bundle figures come from.
- **Prose is capped, and `pnpm check-links` enforces it.** A `src/docs/*.md`
  over 500 words (fenced code excluded, since a page whose length is a config
  example is doing its job) or a page/section `description` over 160 characters
  fails; over 350 words prints as advisory so the trend shows first. These pages
  are a live demo plus its own source — the prose names the API and flags the
  gotchas that cost an hour, and nothing more. It had drifted to 800-word essays
  with "Where to stop" sections before the cap existed, so raise it only with an
  argument, for the same reason `MUI_BUDGET` isn't raised. The limit is slack on
  purpose: the densest pages here sit near it because they carry real mechanics
  (the passive `wheel` listener, `setPointerCapture` on move not press), and
  cutting those to hit a tighter number is the wrong trade. Implementation is
  `findLongDocs`/`findLongDescriptions` in `@jbrowse/browser-test-utils`. The
  cap stopped being load-bearing for _layout_ when the demo moved above the
  prose (`ExampleSection.astro`) — a long page no longer buries its own demo —
  but it is still what keeps these from becoming essays.
- A single-section page's **section-level `description` renders nowhere** — the
  "On this page" card is only drawn for multi-section pages — so don't write
  one. Three sites had accumulated exact duplicates of the page description
  there.
- `scripts/smoke.mjs` holds the evidence for this site's central claim, in two
  halves: `MUI_BUDGET` counts `Mui*`-classed elements, and `muiThemedStyling`
  counts elements whose font came from MUI's default theme — which is the only
  way to see a `makeStyles` component, since an emotion class has no `Mui` in
  its name. Every page that installs `plainChromeOverlays` + `plainTrackControl`
  scores **zero** on both. When one fails, the fix is almost never to change the
  number — it is that a display started rendering a Material component that
  isn't behind either provider. Raising the budget quietly makes the prose
  false. Background: `agent-docs/reference/DISPLAYCHROME.md`, "The
  bring-your-own seams".
- **`eagerBundleSizes.json` is the second measured claim, and it is a ratchet.**
  `pnpm measure-eager-bundle` writes what each page downloads before it can run
  (the static-import closure from its entry); `pnpm smoke` re-checks it. Going
  **under** a budget fails as well as going over — bank the win by re-running
  and committing, or the next change quietly spends it. When a page goes over,
  the cause is essentially always one static import from an eagerly-evaluated
  module to a React component; `agent-docs/reference/EAGER_BUNDLE.md` names the
  three shapes and how to attribute a new one. Don't raise a budget to make it
  pass, for the same reason `MUI_BUDGET` isn't raised.
- **`demoHeights.json` is the third, and it is an input to the build.** Every
  demo is a `client:only` island, and Astro gives an island `display: contents`,
  so its box is empty and 0 high until React hydrates — several hundred KB
  later. The generated height is reserved on that box as a `min-height` so the
  page doesn't drop everything below it when the demo lands (measured on the
  landing page: 153px of movement, CLS 0.0558 → 0.0000). Write it with
  `pnpm build && pnpm measure-demo-heights && pnpm build` — twice, because
  unlike the other two artifacts this one is consumed by the build rather than
  only checked after it. Never by hand.

  The figure is the **tallest** the demo gets: too small jumps the page, too
  large only leaves space inside the demo's own border, which is why the
  generator measures at two widths and why the smoke check's two edges have
  different tolerances. The narrow probe is 840px because a content column is
  narrowest just _above_ the 820px sidebar breakpoint. A demo whose height
  depends on its data (a fit-height mode) can't be pinned this way at all.

  The skeleton in the reserved box is styled on `astro-island:empty`, so it ends
  itself when React appends — no JS and no timer. It has to be out of flow:
  these boxes are `border-box`, so an in-flow child sized off the same
  min-height overflows by the border and leaves 2px of shift.

- **For anything smoke can't see, a throwaway puppeteer probe against the built
  `dist/` is the pattern** — serve `dist/`, strip the Astro base,
  `--use-gl=swiftshader`, settle ~7s, then measure. Write it as a `.tmp.mjs`
  **inside this directory** (workspace module resolution does not reach `/tmp`)
  and delete it after; `oxlint` will flag it if you forget. Two traps that cost
  time: `page.mouse.click` uses **viewport** coordinates, so `scrollIntoView`
  the element and re-read its `boundingBox()` first or every click lands on
  `<html>`; and whether a hover lands on a feature in a headless swiftshader
  render is luck, which is why `BaseTooltip.test.tsx` in `@jbrowse/core` is the
  deterministic half of the tooltip's coverage and the half to extend first.
- **Every section needs `src/docs/<slug>.md`.** `ExampleSection` renders nothing
  when the file is absent, so a page can ship as a title, a one-line lead and
  400 lines of source with no explanation — which is how this site's own lead
  page went out. `pnpm check-links` now fails on a missing doc and on an orphan
  one (prose whose section was renamed out from under it).
- The demo runs in the browser, so verify with `pnpm build && pnpm smoke` (one
  headless page per example) rather than reasoning about it. `pnpm typecheck` is
  `astro check`, and `pnpm check-links` validates doc references, internal
  cross-links, doc coverage and the duplication rule above.
- This site is in `push.yml` twice: the deploy loop and the
  `examples_site_smoke` matrix. Both enumerate sites by name, so a new site is
  invisible to CI until it is added to both.
