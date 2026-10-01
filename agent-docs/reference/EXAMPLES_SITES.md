---
name: examples-sites
description: What rules do the four embeddable-product examples sites follow — every example is one complete copy-pasteable file, so shared setup may not be factored out — plus the demo-height and CI wiring?
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

## The demo comes first on the page
### Why `ExampleSection.astro` is four copies

`Shell.astro`, `Gallery.astro` and `exampleModel.ts` live in
`examples-site-shared/` and are symlinked in. `ExampleLayout.astro` and
`ExampleSection.astro` cannot follow, because a symlinked file may have no
relative imports: `astro check` resolves one from the symlink's directory and vite
from the file's real path. `ExampleSection` reads the per-site `../siteMeta.ts`.
Don't retry without solving the resolver disagreement first.

## Generated artifacts and CI

- **`demoHeights.json` is generated and is an input to the build** (every site
  except `jbrowse-react-app`). Astro gives a `client:only` island `display:
  contents`, so its box is 0 high until React hydrates; the generated height is
  reserved as a `min-height`. Write it with `pnpm build && pnpm
  measure-demo-heights && pnpm build`, never by hand. The figure is the tallest
  the demo gets, so a fit-height demo can't be pinned this way.
- Each site is in `push.yml` twice, the deploy loop and the `examples_site_smoke`
  matrix, both by name, so a new site is invisible to CI until added to both.
