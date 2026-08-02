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

The one allowed exception is **bulk data**: a `*.json` fixture may be imported,
because inlining a 72 KB config would bury the code the page is about. Data
only, never code.

Snippets in `.astro` prose are held to the same bar: write the generic call as a
literal, never `?raw` a private helper of this site.

## Other rules

- Prose in `src/docs/*.md` must not restate a measurable number. If a page needs
  one, generate it. See `scripts/measureChromeBundle.ts` and its `pnpm autogen`
  entry, which is where the chrome bundle figures come from.
- The demo runs in the browser, so verify with `pnpm build && pnpm smoke` (5
  headless pages) rather than reasoning about it. `pnpm typecheck` is
  `astro check`, and `pnpm check-links` validates doc references and internal
  cross-links.
- This site is in `push.yml` twice: the deploy loop and the
  `examples_site_smoke` matrix. Both enumerate sites by name, so a new site is
  invisible to CI until it is added to both.
