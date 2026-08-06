# examples-site

Shared doctrine for all four examples sites — the copy-pasteable-file rule, the
prose caps, `demoHeights.json`, the CI wiring — is
[agent-docs/reference/EXAMPLES_SITES.md](../../../agent-docs/reference/EXAMPLES_SITES.md).
**Read it before adding a page or refactoring an example.** This file is only
what is local here.

The published package an example may import from is
`@jbrowse/react-linear-genome-view2`.

The bulk-data exception in use here is `src/examples/nextstrain_*.json`.

`SingleCellUmap.tsx` is the worked example of the no-shared-helpers rule: its
UMAP canvas panel is 185 lines that used to live in `src/components/`, and it is
inlined under a banner comment because the page's single `?raw` block has to be
the whole thing. There is no `src/components/` directory any more, and there
should not be one.
