# examples-site

Shared doctrine for all four sites:
[agent-docs/reference/EXAMPLES_SITES.md](../../../agent-docs/reference/EXAMPLES_SITES.md).
Local to this one:

The published package an example may import from is
`@jbrowse/react-linear-genome-view2`.

The bulk-data exception in use here is `src/examples/nextstrain_*.json`.

`SingleCellUmap.tsx` is the worked example of the no-shared-helpers rule: its
UMAP canvas panel is inlined, however long it runs, because the page's single
`?raw` block has to be the whole thing. There is no `src/components/` directory
here, and there should not be one.
