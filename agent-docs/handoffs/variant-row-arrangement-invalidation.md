---
name: variant-row-arrangement-invalidation
description: Two open bugs where a multi-sample variant action rearranges rows without invalidating the tree/filter that was built against them — the dendrogram draws against rows it no longer describes, and a subtree filter survives a mode switch that makes its leaf names unmatchable. Includes what was verified, what was deliberately left alone, and why the obvious fix to the second one is not obviously right.
---

# Variant row arrangement vs. tree/subtree invalidation

Two bugs found while taking row order out of the variant RPC (that work is
landed; see ARCHITECTURE.md "Row order is not a fetch input"). Both are
**pre-existing and independent of it** — neither was caused by, nor is fixed by,
the placement change. They are filed together because they are the same shape:
*an action rearranges the rows and leaves behind a structure that was built
against the old arrangement.*

`TreeSidebarMixin` already states the rule these violate, in `clearLayout`'s
comment: the subtree filter "goes with the tree", and `willClearTree` exists
because "the tree was built from the current `layout`, so any membership/order
change (with a tree loaded) makes it stale."

## Bug 1 — `setColorBy` / `setGroupBy` bypass `setLayout`

`plugins/variants/src/shared/MultiSampleVariantBaseModel.ts`, in `setColorBy`
and `setGroupBy`:

```ts
self.layout = arrangeSources(colorBy, self.groupBy, sources)
```

A **direct assignment**, not `self.setLayout(...)`. The mixin's `setLayout`
(`packages/tree-sidebar/src/TreeSidebarMixin.ts`) is what consults
`willClearTree` and drops `clusterTree` when the new layout's membership or
order differs. Bypassing it leaves the dendrogram up, drawn against rows it no
longer describes.

**Why the rows really do move.** `arrangeSources` rebuilds from
`self.sourcesVolatile` — *adapter* order — not from the current `layout`. So
after a clustering run, picking "Color by… → Samples → Population" resets the
order outright. `applyColorPalette` maps 1:1 and preserves order, so the
reordering is entirely the `sourcesVolatile` base, not the palette.

**Why it is worse in phased mode.** After a phased clustering run `layout` holds
*haplotype* rows (`HG001 HP0`), while `arrangeSources(…, sourcesVolatile)`
produces *sample*-level rows. The row count halves as well as reorders.

**How the tree is drawn**, so the symptom is unambiguous:
`computeClusterHierarchy` (`packages/tree-sidebar/src/clusterUtils.ts`) spaces
the newick leaves evenly across `effectiveRowHeight * nrow` — leaf *i* is drawn
at row *i*, positionally. Nothing reconciles leaf name to row name at draw time.

**Verified:** these two lines are the only direct `self.layout =` writes in the
repo that can move rows with a tree loaded. `setSources` also assigns directly
but is guarded by `layout.length === 0`; `setPhasedMode` assigns `[]` and clears
`clusterTree` itself; `setLayoutAndPendingClusterTree` is the clustering commit
path and is deliberate. `sortByGenotype` correctly routes through `setLayout`.

**Likely fix:** route both through `self.setLayout(...)`. Note `arrangeSources`
can return `[]` (neither colorBy nor groupBy set), and `willClearTree([])`
correctly reports stale, so the empty case needs no special handling.

**Open design question, worth a decision rather than a default:** should
`setColorBy`/`setGroupBy` re-derive from `sourcesVolatile` at all? Applying the
palette to the *current* arrangement (`self.layout.length ? self.layout :
sourcesVolatile`) would stop a recolor silently discarding a hand-made or
clustered order, and would leave the tree valid in the common case. It needs a
check that layout rows still carry the metadata attribute `applyColorPalette`
reads — sources from `buildClusteredLayout` may not.

## Bug 2 — `subtreeFilter` survives a rendering-mode switch

`setPhasedMode` clears `layout` and `clusterTree` when the mode changes, but not
`subtreeFilter`:

```ts
if (self.renderingMode !== arg) {
  self.layout = []
  self.clusterTree = undefined
}
```

The filter holds **tree leaf names**, and which names those are depends on the
mode: sample names (`HG001`) from an allele-count clustering, haplotype names
(`HG001 HP0`) from a phased one. After a switch the surviving filter names
things that no longer exist, and `sourcesBase`'s `filterRowsBySubtree` (keyed on
`name`) matches nothing.

**Consequence, and why it is not a regression from the placement work:** the
display goes blank. `sourcesBase` → `[]` → `sources` → `[]` → nothing drawn.
That was equally true before — the old `rpcProps().sources` was `[]` and the
worker computed no cells. It is preserved exactly today: `sampleFilter` is `[]`,
and `buildCanonicalRows` treats an explicitly empty filter as "no rows" (not
"all rows") specifically so the worker still computes nothing. **Do not
"simplify" that empty-vs-undefined distinction away** — collapsing them makes
this state compute and ship an entire cell matrix that nothing draws.

**Recoverable, so it is not data loss:** "Clear subtree filter" appears in the
track menu (`treeMenuItems.ts`) whenever `subtreeFilter?.length`, independent of
whether a tree exists. The tree's own context-menu entry is gone with the tree.

**Related, same root:** `TreeSidebarMixin.setLayout` clears `clusterTree` but
not `subtreeFilter`, so its invalidation path strands the filter too. Reachable
from right-click → "Sort by genotype" with a clade focused. Whatever rule is
chosen should cover both sites; `clearLayout` (which clears both) is the
statement of intent.

## Do not re-derive

- The phased/subtree combination is **not** broken by `sourcesBase` passing
  `renderingMode: 'alleleCount'` to `getSources`. That flag only suppresses
  *further* expansion. After a phased clustering run the `layout` rows are
  already haplotype rows, `getSources` merges them (`{...baseSource, ...row}`,
  so `row.name` wins), and `sourcesBase` comes out haplotype-level with
  `name = "HG001 HP0"`. `filterRowsBySubtree` on `name` then matches correctly.
  The comment at that call site is accurate. All four
  (mode × clustered/not) combinations were traced; only the *mode switch* above
  breaks the naming agreement.
- `sampleFilter` deduping by `sampleName` is what keeps a haplotype-level
  `sourcesBase` from producing a ploidy-dependent cache key. Any change to
  `sourcesBase`'s granularity has to keep that true.
- Row placement is by **name** end to end now, so none of this can be fixed by
  renumbering anything. `rowRemap` maps `cellData.rowNames` → screen row; a row
  the display isn't drawing goes to `HIDDEN_ROW`. If a fix changes which rows
  `sources` contains, placement follows automatically — no refetch, no
  invalidation needed for the *cells*.

## Tests

Neither bug has coverage. `MultiSampleVariantBaseModel.test.ts` guards the
colorBy/groupBy wiring but never with a `clusterTree` loaded.
`plugins/variants/src/LinearMultiSampleVariantDisplay/rowPlacement.test.ts` has
a harness (`createTestEnvironment().createDisplay()`) that can drive
`setSources` / `setCellData` / `setLayout` / `setPhasedMode` headlessly — the
cheapest place to add regressions for both.
