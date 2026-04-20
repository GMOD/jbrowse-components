# tree-sidebar

## Vendored d3-hierarchy2

`src/d3-hierarchy2/` is a vendored subset of d3-hierarchy (only `cluster` and
`hierarchy`). d3-hierarchy is pure ESM and breaks Jest, so it cannot be used as
an npm dependency. Do not replace it with the npm package.
