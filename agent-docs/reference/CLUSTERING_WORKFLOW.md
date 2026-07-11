---
name: clustering-workflow
description: In-app hierarchical clustering for wiggle and variants. Read when touching cluster dialogs, dendrograms, or the TreeSidebar.
---

# In-App Clustering Workflow

Applies to `plugins/wiggle` (multi-wiggle displays) and `plugins/variants`
(multi-sample variant displays). Both plugins share the same structural pattern:
a dialog triggers an RPC call that builds a feature matrix, runs hierarchical
clustering via `@gmod/hclust`, and writes the result into `TreeSidebarMixin`
state, which drives dendrogram rendering.

---

## Data flow

```
Track menu
  ↓  "Cluster rows by score" (wiggle)
  ↓  "Cluster by genotype"   (variants)
Dialog (Auto / Manual)
  ↓  Auto path
RPC call (main → worker)
  ├─ wiggle:   MultiWiggleClusterScoreMatrix
  └─ variants: MultiSampleVariantClusterGenotypeMatrix
Worker
  1. Build matrix (one row per source/sample, one column per position/variant)
  2. @gmod/hclust clusterObject() → hierarchical dendrogram
  3. toNewick() → Newick string
  Return { order: number[], tree: string }
Dialog callback
  buildClusteredLayout(baseSources, existingLayout, order)
  model.setLayoutAndClusterTree(layout, tree)        ← wiggle
  model.setLayoutAndPendingClusterTree(layout, tree) ← variants (see below)
MST state updated (TreeSidebarMixin)
  layout[]     → row order
  clusterTree  → Newick string
Re-render
  hierarchy view  = clusterLayout(parsedTree, rowHeight, treeAreaWidth, showBranchLength)
  renderSvg.tsx   → <SvgTreePath hierarchy={hierarchy} /> + reordered rows
```

---

## Matrix construction

### Wiggle — score matrix (`getScoreMatrix.ts`)

- **Rows** = sources (tracks)
- **Columns** = genomic positions, binned by `bpPerPx`
- **Values** = `Float32Array` score values from features

Features are fetched from the first loaded region; scores indexed by source
name, then binned into columns.

### Variants — genotype matrix (`getGenotypeMatrix.ts`)

- **Rows** = samples
- **Columns** = variants passing `minorAlleleFrequencyFilter` + jexl filters
- **Values** = dosage in `Int8Array`:
  - `0` = homozygous ref
  - `1` = heterozygous
  - `2` = homozygous alt
  - `-1` = missing / uncalled

### Variants phased mode (`getPhasedGenotypeMatrix.ts`)

`renderingMode === 'phased'`: one row per haplotype per sample (e.g. `HG001
HP0`, `HG001 HP1`). Values are allele indices in `Int16Array`. Dialog expands
sources to haplotypes via `expandSourcesToHaplotypes()` before calling
`setLayoutAndPendingClusterTree`.

---

## TreeSidebarMixin (`packages/tree-sidebar/src/TreeSidebarMixin.ts`)

Persistent MST state shared by both plugins:

| Field | Type | Purpose |
|---|---|---|
| `layout` | `Source[]` | Ordered rows after clustering |
| `clusterTree` | `string` (Newick) | Tree topology + branch lengths |
| `treeAreaWidth` | `number` | Sidebar pixel width (default 80) |
| `subtreeFilter` | `string[]` | Leaf names for collapsed subtree |

Key actions:
- `setLayout(layout)` — clears tree if sample names changed
- `setLayoutAndClusterTree(layout, tree)` — atomic update (wiggle)
- `setSubtreeFilter(names)` — collapses to deepest matching subtree (interactive click)
- `clearLayout()` — wipes layout + tree

---

## Pending tree (variants only)

Variants have a `pendingClusterTree` volatile. The problem: clustering finishes
before `cellData` (the render grid) arrives. Applying the tree immediately would
reorder rows that don't yet have computed data. `setCellData()` applies the
pending tree atomically when data lands. Wiggle doesn't need this because it
renders from the score matrix directly.

---

## Cluster utilities (`packages/tree-sidebar/src/clusterUtils.ts`)

- **`buildClusteredLayout(baseSources, existingLayout, order)`** — reorders
  `baseSources` by the clustering `order` array, preserving existing color/label
  properties from `existingLayout`.
- **`buildTree(newick)`** / **`applySubtreeFilter(root, filter)`** — parses
  Newick, wraps in d3-hierarchy `HierarchyNode`, and optionally filters to the
  deepest subtree whose leaves exactly match `filter`. Single post-order pass.

---

## Manual mode

Both dialogs offer a Manual tab that generates an R script. The user runs it
locally and pastes the resulting Newick tree. The dialog calls the same
`buildClusteredLayout` + `setLayout*` path as auto mode, just with
user-supplied order/tree instead of RPC output.

---

## Rendering

**Wiggle:** `plugins/wiggle/src/MultiLinearWiggleDisplay/renderSvg.tsx`  
**Variants:** `plugins/variants/src/shared/renderSvgUtils.ts`

Both call `model.hierarchy` (a computed view) and pass it to `<SvgTreePath>`.
The dendrogram appears in the left sidebar; rows are drawn in `layout` order.
Clicking a tree node calls `setSubtreeFilter` to collapse/expand that clade.

---

## Key files

| File | Role |
|---|---|
| `plugins/wiggle/src/WiggleRPC/executeClusterScoreMatrix.ts` | Worker clustering for wiggle |
| `plugins/wiggle/src/WiggleRPC/getScoreMatrix.ts` | Score matrix construction |
| `plugins/wiggle/src/MultiLinearWiggleDisplay/components/WiggleClusterDialog/` | Dialog (Auto + Manual) |
| `plugins/wiggle/src/MultiLinearWiggleDisplay/model.ts` | Composes TreeSidebarMixin, `hierarchy` view |
| `plugins/variants/src/VariantRPC/executeClusterGenotypeMatrix.ts` | Worker clustering for variants |
| `plugins/variants/src/VariantRPC/getGenotypeMatrix.ts` | Dosage matrix construction |
| `plugins/variants/src/VariantRPC/getPhasedGenotypeMatrix.ts` | Phased haplotype matrix |
| `plugins/variants/src/shared/components/MultiSampleVariantClusterDialog/` | Dialog (Auto + Manual) |
| `plugins/variants/src/shared/MultiSampleVariantBaseModel.ts` | Base model; `pendingClusterTree` + `hierarchy` |
| `packages/tree-sidebar/src/TreeSidebarMixin.ts` | Shared MST state |
| `packages/tree-sidebar/src/clusterUtils.ts` | `buildClusteredLayout`, `buildTree`, `applySubtreeFilter` |
| `packages/tree-sidebar/src/newick.ts` | Newick parser |
