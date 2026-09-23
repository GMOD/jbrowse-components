---
id: treesidebarmixin
title: TreeSidebarMixin
sidebar_label: Mixin -> TreeSidebarMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/tree-sidebar/src/TreeSidebarMixin.ts).

#crossCuttingMixin Row set with a dendrogram sidebar, its arrangement the display's `rows` config object: the order, the labels, the tree with its provenance and the focus, each written as a session edit to the track's config so undo, reset and a share link reach it and it survives unticking the track. Brings the `showTree` / `showBranchLength` / `showRowLabels` / `treeAreaWidth` getters and setters, the `runClustering` / `clusterRegion` and `sortRowsBy` declarative launch specs `setupTreeSidebarAutoruns` consumes, the row arrangement every shared consumer goes through (`rowDomain`, `rowLabels`, `rowTree`, `rowTreeProvenance`, `rowFocus`, `rowArrangementIsCustom`, `rowOrderWillDropTree`, `setRowOrder`, `setRowLabels`, `setRowFocus`, `resetRowArrangement`), the `root` getter, and the tree-hover and canvas-ref volatiles the shared sidebar draws through. `applyRowEdits` stays the display's, since it writes colours the display keeps in its own object

Every arrangement write reaches the session at once rather than after the
track's 400 ms save, so a clustering run is one undo step and undoable the
moment its tree appears. "Reset row order" returns each member to what the
config.json declares, or what a track the session owns was added with, and
never touches `rows.field`.

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-rowdomain">**rowDomain**</span><br><code>string[]</code> | The row order, `rows.domain`: the rows it names lead, in its order, and the rest keep the order they arrived in. |
| <span id="getter-rowlabels">**rowLabels**</span><br><code>Readonly&lt;Record&lt;string, string&gt;&gt;</code> | The labels drawn in place of row names, `rows.labels`, by name. |
| <span id="getter-rowtree">**rowTree**</span><br><code>string &#124; undefined</code> | The cluster tree the rows are arranged by, `rows.tree`, as newick. |
| <span id="getter-rowtreeprovenance">**rowTreeProvenance**</span><br><code>ClusterProvenance &#124; undefined</code> | What `rowTree` was computed from, the locus and the settings; undefined for a tree that arrived as data. |
| <span id="getter-rowfocus">**rowFocus**</span><br><code>readonly string[] &#124; undefined</code> | The row names a focus narrows the display to, `rows.kept` — a clade picked off the tree or a key row's rows — or undefined while every row shows. |
| <span id="getter-rowstylingiscustom">**rowStylingIsCustom**</span><br><code>boolean</code> | Overridable hook: whether the display keeps row styling of its own beyond the arrangement that differs from the config, so a reset is offered for it too. Nothing by default. |
| <span id="getter-rowarrangementiscustom">**rowArrangementIsCustom**</span><br><code>boolean</code> | Whether the arrangement differs from what the config declares — what "Reset row order" is offered on. |
| <span id="getter-parsedtree">**parsedTree**</span><br><code>HierarchyNode&lt;NewickNode&gt; &#124; undefined</code> |  |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-roworderwilldroptree">**rowOrderWillDropTree**</span><br><code>(next: readonly { name: string; }[]) =&gt; boolean</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-resetrowstyling">**resetRowStyling**</span><br><code>() =&gt; void</code> | Overridable hook: return the row styling the display keeps of its own to what the config declares, with the arrangement. Nothing by default. |
| <span id="action-setroworder">**setRowOrder**</span><br><code>(rows: readonly S[], run?: ClusterRun &#124; undefined) =&gt; void</code> | Arrange the rows in `rows`' order, ahead of any name the current order carries that `rows` does not. A clustering run passes its result, and the tree and its provenance land with the order; any other reorder that moves a row drops the tree, which no longer describes it. |
| <span id="action-setrowlabels">**setRowLabels**</span><br><code>(labels: Readonly&lt;Record&lt;string, string&gt;&gt;) =&gt; void</code> | The labels drawn in place of row names, whole: a row the map does not name shows the name it arrived with. |
| <span id="action-setrowfocus">**setRowFocus**</span><br><code>(names?: readonly string[] &#124; undefined) =&gt; void</code> | Narrow the display to `names`, or show every row again. |
| <span id="action-resetrowarrangement">**resetRowArrangement**</span><br><code>() =&gt; void</code> | Return every arrangement member — order, labels, tree, provenance and focus — to what the config declares, leaving `rows.field`. |
