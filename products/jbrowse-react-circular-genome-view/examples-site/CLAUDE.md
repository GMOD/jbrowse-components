# examples-site

## Every shown example is one complete, copy-pasteable file

Each page renders a demo and shows that demo's own source via `?raw`. A reader
has to be able to select that block, paste it into their app, and run it.

So an example file may import **only from published packages**:
`@jbrowse/react-circular-genome-view2`, `@jbrowse/core/*`, `@jbrowse/plugin-*`,
`@mui/material`, `react`, `mobx-react`. No relative import into this site's own
helpers. Check with:

```sh
grep "from '\./\|from '\.\./" src/examples/*.tsx
```

That currently returns nothing here, and it should stay that way.

**Do not factor the shared parts out.** Pulling the repeated setup into a
`src/browser/`-style module is the obvious tidy-up, it makes the site pleasant
to maintain, and it destroys the product: every page's source becomes a list of
paths the reader cannot resolve. A second `?raw` code block showing the helper
is not a fix. It is the admission that the first block was incomplete.

Duplication across example files is correct here. The pages diverge as they add
features anyway, and each one has to read top to bottom on its own. Where a
block is repeated verbatim, give it a one-line pointer to the page that explains
it instead of repeating the reasoning on every page.

The one allowed exception is **bulk data**: a `*.json` fixture may be imported,
because inlining a large config would bury the code the page is about. Data
only, never code.

Snippets in `.astro` prose are held to the same bar: write the generic call as a
literal, never `?raw` a private helper of this site.

## Other rules

- Prose in `src/docs/*.md` must not restate a measurable number. If a page needs
  one, generate it and register the generator in `pnpm autogen`, so CI re-checks
  it and the prose cannot drift.
- **Prose is capped, and `pnpm check-links` enforces it.** A `src/docs/*.md`
  over 500 words (fenced code excluded, since a page whose length is a config
  example is doing its job) or a page/section `description` over 160 characters
  fails; over 350 words prints as advisory so the trend shows first. These pages
  are a live demo plus its own source — the prose names the API and flags the
  gotchas that cost an hour, and nothing more. It had drifted into essays before
  the cap existed, so raise it only with an argument. Implementation is
  `findLongDocs`/`findLongDescriptions` in `@jbrowse/browser-test-utils`, shared
  by all four sites.
- A single-section page's **section-level `description` renders nowhere** — the
  "On this page" card is only drawn for multi-section pages — so don't write
  one. Three sites had accumulated exact duplicates of the page description
  there.
- The demo runs in the browser, so verify with `pnpm build && pnpm smoke` rather
  than reasoning about it. `pnpm typecheck` is `astro check`, and
  `pnpm check-links` validates doc references and internal cross-links.
- This site is in `push.yml` twice: the deploy loop and the
  `examples_site_smoke` matrix. Both enumerate sites by name.
