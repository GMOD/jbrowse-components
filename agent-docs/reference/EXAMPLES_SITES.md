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

## Shared layouts reach their site through `~site`

The layouts, `exampleModel.ts` and the gallery live in `examples-site-shared/`
and are symlinked into each site. A shared file imports its site's own modules
as `~site/...` (`siteMeta.ts`, `examples.ts`, `docs/*.md`), never by a relative
path: `astro check` resolves a relative import from the symlink's directory and
vite from the file's real path, so only an alias, declared in both
`astro.config.mjs` and `tsconfig.json`, means the same file to both. Every site's
`siteMeta.ts` exports the same names, including `demoHeights`.

## Generated artifacts and CI

- **`demoHeights.json` is generated and is an input to the build** (every site
  except `jbrowse-react-app`). Astro gives a `client:only` island `display:
  contents`, so its box is 0 high until React hydrates; the generated height is
  reserved as a `min-height`. Write it with `pnpm build && pnpm
  measure-demo-heights && pnpm build`, never by hand. The figure is the tallest
  the demo gets, so a fit-height demo can't be pinned this way.
- Each site is one leg of the `examples_site_smoke` matrix in `push.yml`, which
  builds, smoke-tests and, on main and release tags, deploys it. A new site is
  invisible to CI until it has a leg.
