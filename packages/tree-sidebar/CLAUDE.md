# tree-sidebar

Both enforcement halves and the full workflow:
[reference/CLUSTERING_WORKFLOW.md](../../agent-docs/reference/CLUSTERING_WORKFLOW.md).

## Rules

Each is a section of
[reference/TREE_SIDEBAR.md](../../agent-docs/reference/TREE_SIDEBAR.md), which
has the why — read that section before changing what it covers.

- Clustering lifecycle lives here, not per plugin
- `ClusterMatrix` is a `Map` because its key order _is_ the result
- "Does the tree describe these rows" is derived, not remembered
- A declared row order rotates the tree, it does not reorder against it
- A tree's provenance is written in the same action as the tree, always
- One mixin holds the arrangement and derives the rows
- "Sort rows by … here" is three shared pieces and one per-display read
- The row focus goes with the row _names_, not with the tree
- Newick
- `RowSource` is the row vocabulary, and the mixin's bound
- Two row-height arguments, and neither is the display height
- Drawing rows
- On screen: `TreeSidebar` + `RowLabelsOverlay`, both portalled
- Install the autoruns statically; don't `import()` this barrel
- A tree per band
- SVG export: `SvgTreeSidebar`, never `SvgRowLabels` alone
