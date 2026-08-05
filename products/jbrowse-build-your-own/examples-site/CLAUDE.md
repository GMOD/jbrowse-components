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

**Do not factor the shared parts out.** Pulling `useViewWidth`, `TrackRow`,
`usePanZoom` and the engine setup into a `src/browser/` module is the obvious
tidy-up, it makes the site pleasant to maintain, and it destroys the product:
every page's source becomes a list of paths the reader cannot resolve. This site
was built that way first and rewritten. A second `?raw` code block showing the
helper is not a fix. It is the admission that the first block was incomplete.

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
