---
name: lineage-colors-on-the-tree-branches
description: Color a dendrogram's branches by a row attribute where every tip below agrees, as react-msaview's `branch` channel does, so a one-population clade is one color from its split down. Waits on whether it earns its place beside the row color column.
---

# Lineage colors on the tree branches

The tree sidebar strokes every branch in one color (`treeStroke` in
`packages/tree-sidebar/src/hierarchy.ts`), as one path on screen
(`packages/tree-sidebar/src/treeDrawingAutorun.ts`) and in the export
(`packages/tree-sidebar/src/SvgTreePath.tsx`). A row attribute shows only beside the labels: the row
color's bar and the `rows.annotations` columns
([ADR-260](../../architecture-decision-records/adr-260-row-annotations-are-color-columns-beside-the-row-labels.md)).

## Prior art

react-msaview has a `branch` encoding channel, its model's `branchColors`
getter, which its canvas tree renderer strokes edge by edge. A pass from the tips up gives each node the field value all its tips share,
and an edge takes the color of the node at its far end. A node whose tips
disagree, or whose value has no color, keeps the default stroke. The pass runs
over the whole tree, so a collapsed or focused clade keeps the color the full
tree gives it. ggtree (`groupClade`, `aes(color = …)`) and iTOL's clade
coloring draw the same picture.

## Proposal

- The same tips-up pass over `parsedTree`, keyed by node, using the colors
  the row color already deals (`dealtValueColors`), so a branch and the bar at
  its tips are one color and no new key is drawn.
- Draw one path per color rather than one per edge, so a tree with thousands
  of leaves still makes a few draw calls; the default-colored edges stay one
  path.
- The export reads the same per-node map, as the labels' columns do through
  `rowSidebarProps`.

## What deciding it involves

- **Does it earn its place?** The row color's column already marks which clade
  is which at the tips. Branch color adds something only where a whole clade
  shares a value: it shows where a population's split begins, and that a
  clustering run kept it together. On a mixed tree most of the branch stays
  the default color. Judge it on a 1000 Genomes capture (superpopulation, the
  48-sample and all-samples shoots used for ADR-260) before building.
- **Which slot.** Following `rows.color` needs no new setting but turns
  branches on for every colored track; a `rows.axis.tree` option is a
  rendering choice under the axis but then colors by a field it does not name;
  a separate channel (react-msaview's shape) needs a field and a key of its own.
- **Interaction with the existing tree marks.** Hover rings, the band strip
  (ADR-169) and the focus already color parts of the sidebar. Check a capture
  with a band and a focus on before choosing the stroke weight.
