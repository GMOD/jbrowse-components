# examples-site

Shared doctrine for all four examples sites — the copy-pasteable-file rule, the
prose caps, the CI wiring — is
[agent-docs/reference/EXAMPLES_SITES.md](../../../agent-docs/reference/EXAMPLES_SITES.md).
**Read it before adding a page or refactoring an example.** This file is only
what is local here.

The published package an example may import from is `@jbrowse/react-app2`.

The only relative-import hit is `../volvox-config.json`, which is the allowed
bulk-data exception.

**This site reserves no demo heights, and shouldn't** — it is the one exception
to the shared `demoHeights.json` rule. `demoFillHeight` fixes every demo box at
`80vh` in CSS, so it already owns its space from first paint and there is no
layout shift to remove; `checkDemoHeights` in `pnpm smoke` skips a `.fill` box
for that reason. The box still gets the loading skeleton, styled on the
`client:only` island's `:empty` state so it ends itself the moment React puts
something there.
