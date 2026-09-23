---
id: layouttreesidebarmixin
title: LayoutTreeSidebarMixin
sidebar_label: Mixin -> LayoutTreeSidebarMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/tree-sidebar/src/LayoutTreeSidebarMixin.ts).

#crossCuttingMixin The dendrogram sidebar with its arrangement in display state — `layout`, `clusterTree`, `clusterProvenance` and `subtreeFilter` — as the multi-row feature and MAF displays still keep it. The same arrangement API as `TreeSidebarMixin` over those props, until each display moves onto the `rows` config object

The row axis's declared order is the `domain` slot, read as `rowDomain`
and applied under `layout`, which stays the runtime arrangement every drag,
dialog, clustering run and column sort writes.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-clusterprovenance">**clusterProvenance**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>clusterProvenance: types.stripDefault( types.maybe(types.frozen…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>clusterProvenance: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.maybe(types.frozen&lt;ClusterProvenance&gt;()),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;undefined,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | What `clusterTree` was computed from — the locus and the settings. Set only for a tree this app computed; a supplied phylogeny (maf's `.nh`) leaves it undefined. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-rowdomain">**rowDomain**</span><br><code>string[]</code> | The row axis's declared order off the `domain` slot — the config seed `orderRowsByDomain` places rows through, under whatever `layout` says. |
| <span id="getter-parsedtree">**parsedTree**</span><br><code>HierarchyNode&lt;NewickNode&gt; &#124; undefined</code> |  |
| <span id="getter-rowtree">**rowTree**</span><br><code>string &#124; undefined</code> | The cluster tree the rows are arranged by, as newick: a run's, or a supplied phylogeny (maf's `.nh`). |
| <span id="getter-rowtreeprovenance">**rowTreeProvenance**</span><br><code>ClusterProvenance &#124; undefined</code> | What `rowTree` was computed from, the locus and the settings; undefined for a supplied tree. |
| <span id="getter-rowfocus">**rowFocus**</span><br><code>readonly string[] &#124; undefined</code> | The row names a focus narrows the display to — a clade picked off the tree or a legend group — or undefined while every row shows. |
| <span id="getter-rowarrangementiscustom">**rowArrangementIsCustom**</span><br><code>boolean</code> | Whether the rows have been arranged away from the order they arrived in — what "Reset row order" is offered on. |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-roworderwilldroptree">**rowOrderWillDropTree**</span><br><code>(next: readonly { name: string; }[]) =&gt; boolean</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setroworder">**setRowOrder**</span><br><code>(rows: S[], run?: ClusterRun &#124; undefined) =&gt; void</code> | Arrange the rows in `rows`' order. A clustering run passes its result, and the tree and its provenance land with the order; any other reorder that moves a row drops the tree, which no longer describes it. |
| <span id="action-applyrowedits">**applyRowEdits**</span><br><code>(rows: S[]) =&gt; void</code> | The arrangement dialog's submit: the rows in their new order, each carrying the label and colours the reader set on it. |
| <span id="action-resetrowarrangement">**resetRowArrangement**</span><br><code>() =&gt; void</code> | Reset to no arrangement at all, focus included: the reader asked for the rows back as they came.<br><br>The focus is otherwise independent of the tree: a set of row names `filterRowsBySubtree` matches with no tree involved, so a reorder or a re-cluster leaves it valid and `setRowOrder` keeps it. What does invalidate it is a change to what rows are called, which `setPhasedMode` clears it for. |
| <span id="action-setclustertree">**setClusterTree**</span><br><code>(tree?: string &#124; undefined) =&gt; void</code> |  |
| <span id="action-setrowfocus">**setRowFocus**</span><br><code>(names?: readonly string[] &#124; undefined) =&gt; void</code> | Narrow the display to `names`, or show every row again. |
