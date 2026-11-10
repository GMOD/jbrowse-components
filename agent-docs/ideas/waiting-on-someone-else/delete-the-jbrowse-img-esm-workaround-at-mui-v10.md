---
name: delete-the-jbrowse-img-esm-workaround-at-mui-v10
description: MUI v9 deep-imports react-transition-group without an exports map, so raw-Node ESM consumers of @jbrowse/img need a resolve rewrite, in the CLI's hook and again in the packed-tarball test. MUI v10 removes react-transition-group, and the rewrite and the test's copy go with it.
---

# Delete the jbrowse-img ESM workaround at MUI v10

Split out of the build-and-dependencies collection on 2026-09-27. It waits on
Material UI v10.

MUI v9's "true ESM" build deep-imports the bare subpath
`react-transition-group/TransitionGroupContext`; that package has no `exports`
map (unmaintained ~4y), so raw Node ESM rejects it with
`ERR_UNSUPPORTED_DIR_IMPORT` while bundlers resolve it fine. `@jbrowse/img`
ships raw ESM, so `jb2export` and published end users are exposed.

The rewrite is `transitionGroup` in `products/jbrowse-img/src/resolve.ts`,
which `bin.ts` installs before `await import('./main.ts')`, and
`integrationResolve.mjs` (the node:test loader thread's hook) reads the same
helpers out of `esm/resolve.js`. The packed-tarball component test carries its
own copy (`component_tests/jbrowse-img/resolve.mjs`, registered by
`register.mjs`).

MUI is **removing react-transition-group entirely** (migrated to an in-house
transition in PR mui/material-ui#48325), targeted for **Material UI v10**; see
[mui/material-ui#48644](https://github.com/mui/material-ui/issues/48644). At
the bump the deep import vanishes, and with it `transitionGroup`, its test and
the component test's `resolve.mjs` and `register.mjs`. The hook in `resolve.ts`
stays: its other two rewrites (`builtUrl`, `staleEsmImport`) point a
from-source run at the workspace packages' built `esm/`, which has nothing to do
with MUI. Until then the rewrite is load-bearing and won't be backported to v9.

Near-term cleanup, which needs no v10: a shipped `@jbrowse/img/register`
subpath that the component test (`node --import @jbrowse/img/register run.mjs`)
and programmatic consumers use, which closes the
`import { renderRegion }`-under-raw-Node gap and makes CI exercise the shipped
hook instead of its own copy. Don't bundle `@jbrowse/img` for this: it freezes
the semver flow-through for one narrow consumer path.
