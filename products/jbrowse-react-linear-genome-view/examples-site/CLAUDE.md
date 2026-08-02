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

**Do not factor the shared parts out.** Pulling repeated setup into a
`src/browser/`-style module is the obvious tidy-up, it makes the site pleasant
to maintain, and it destroys the product: every page's source becomes a list of
paths the reader cannot resolve. The sibling
`products/jbrowse-build-your-own/examples-site` was built that way first and had
to be rewritten. A second `?raw` code block showing the helper is not a fix. It
is the admission that the first block was incomplete.

Duplication across example files is correct here. The pages diverge as they add
features anyway, and each one has to read top to bottom on its own. Where a
block is repeated verbatim, give it a one-line pointer to the page that explains
it instead of repeating the reasoning on every page.

The one allowed exception is **bulk data**: the `nextstrain_*.json` fixtures are
imported because inlining them would bury the code the page is about. Data only,
never code.

### Known violation, not a precedent

`SingleCellUmap.tsx` imports `../components/UmapScatter.tsx`, 185 lines of real
component code. That page's shown source is therefore not runnable as pasted. Do
not cite it as license to add more. Inline it if you are in there anyway.

Snippets in `.astro` prose are held to the same bar: write the generic call as a
literal, never `?raw` a private helper of this site.

## Other rules

- Prose in `src/docs/*.md` must not restate a measurable number. If a page needs
  one, generate it and register the generator in `pnpm autogen`, so CI re-checks
  it and the prose cannot drift.
- The demo runs in the browser, so verify with `pnpm build && pnpm smoke` rather
  than reasoning about it. `pnpm typecheck` is `astro check`, and
  `pnpm check-links` validates doc references and internal cross-links.
- This site is in `push.yml` twice: the deploy loop and the
  `examples_site_smoke` matrix. Both enumerate sites by name.
