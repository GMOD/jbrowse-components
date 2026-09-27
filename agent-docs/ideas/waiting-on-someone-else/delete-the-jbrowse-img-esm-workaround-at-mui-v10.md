---
name: delete-the-jbrowse-img-esm-workaround-at-mui-v10
description: MUI v9 deep-imports react-transition-group without an exports map, so raw-Node ESM consumers of @jbrowse/img need a resolve hook duplicated in three places. MUI v10 removes react-transition-group and the whole workaround with it; collapsing the copies into one shipped register subpath needs no wait.
---

# Delete the jbrowse-img ESM workaround at MUI v10

Split out of the build-and-dependencies collection on 2026-09-27. It waits on Material UI v10.

MUI v9's
"true ESM" build deep-imports the bare subpath `react-transition-group/TransitionGroupContext`;
that package has no `exports` map (unmaintained ~4y), so raw Node ESM rejects it with
`ERR_UNSUPPORTED_DIR_IMPORT` while bundlers resolve it fine. `@jbrowse/img` ships raw ESM,
so `jb2export` (and published end users) are exposed. Current workaround is a resolve hook
duplicated across `products/jbrowse-img/src/resolve.ts` (shipped, installed by `bin.ts`
before `await import('./main.ts')`), the packed-tarball component test
(`component_tests/jbrowse-img/resolve.mjs`), and the pre-build integration test
(`integrationResolve.mjs`, must stay hand-authored `.mjs` for tsx's loader thread).
MUI is **removing react-transition-group entirely** (migrated to an in-house transition in
PR mui/material-ui#48325), targeted for **Material UI v10** — see
[mui/material-ui#48644](https://github.com/mui/material-ui/issues/48644). When we bump to
MUI v10 the offending deep-import vanishes and the *entire* workaround (resolve.ts, the
`register` export if added, both test `.mjs`) can be deleted. Until then the runtime hook
is load-bearing and won't be backported to v9. Near-term cleanup (optional, doesn't need
v10): collapse the duplicated copies into one shipped `@jbrowse/img/register` subpath that
the CLI, the component test (`node --import @jbrowse/img/register run.mjs` against the
packed tarball), and programmatic consumers all use — which also closes the
`import { renderRegion }`-under-raw-Node exposure gap and makes CI exercise the real shipped
hook instead of its own copy. Don't bundle `@jbrowse/img` for this — it freezes the
semver flow-through for one narrow consumer path.
