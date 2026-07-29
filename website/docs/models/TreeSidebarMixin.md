---
id: treesidebarmixin
title: TreeSidebarMixin
sidebar_label: Mixin -> TreeSidebarMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/tree-sidebar/src/TreeSidebarMixin.ts).

Adds a dendrogram sidebar to a display: stores the leaf layout, newick cluster
tree, sidebar width and subtree filter, plus the hover/canvas volatile state
used while drawing the tree.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-layout">**layout**</span><br><code>layout: types.stripDefault(types.frozen&lt;S[]&gt;(), [])</code> |  |
| <span id="property-clustertree">**clusterTree**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>clusterTree: types.stripDefault(types.maybe(types.string), unde…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>clusterTree: types.stripDefault(types.maybe(types.string), undefined)</code></pre></dialog></span> |  |
| <span id="property-treeareawidth">**treeAreaWidth**</span><br><code>treeAreaWidth: types.stripDefault(types.number, 80)</code> |  |
| <span id="property-subtreefilter">**subtreeFilter**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>subtreeFilter: types.stripDefault( types.maybe(types.array(type…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>subtreeFilter: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.maybe(types.array(types.string)),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;undefined,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-hoveredtreenode">**hoveredTreeNode**</span><br><code>hoveredTreeNode: undefined as HoveredTreeNode &#124; undefined</code> |  |
| <span id="volatile-treecanvas">**treeCanvas**</span><br><code>treeCanvas: null as HTMLCanvasElement &#124; null</code> |  |
| <span id="volatile-mouseovercanvas">**mouseoverCanvas**</span><br><code>mouseoverCanvas: null as HTMLCanvasElement &#124; null</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-parsedtree">**parsedTree**</span><br><code>HierarchyNode&lt;NewickNode&gt; &#124; undefined</code> |  |
| <span id="getter-root">**root**</span><br><code>HierarchyNode&lt;NewickNode&gt; &#124; undefined</code> |  |
| <span id="getter-treehasbranchlengths">**treeHasBranchLengths**</span><br><code>boolean</code> |  |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-willcleartree">**willClearTree**</span><br><code>(next: S[]) =&gt; boolean</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setlayout">**setLayout**</span><br><code>(layout: S[]) =&gt; void</code> |  |
| <span id="action-clearlayout">**clearLayout**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setclustertree">**setClusterTree**</span><br><code>(tree?: string &#124; undefined) =&gt; void</code> |  |
| <span id="action-setlayoutandclustertree">**setLayoutAndClusterTree**</span><br><code>(layout: S[], tree?: string &#124; undefined) =&gt; void</code> |  |
| <span id="action-settreeareawidth">**setTreeAreaWidth**</span><br><code>(width: number) =&gt; void</code> |  |
| <span id="action-setsubtreefilter">**setSubtreeFilter**</span><br><code>(names?: string[] &#124; undefined) =&gt; void</code> |  |
| <span id="action-sethoveredtreenode">**setHoveredTreeNode**</span><br><code>(node?: HoveredTreeNode &#124; undefined) =&gt; void</code> |  |
| <span id="action-settreecanvasref">**setTreeCanvasRef**</span><br><code>(ref: HTMLCanvasElement &#124; null) =&gt; void</code> |  |
| <span id="action-setmouseovercanvasref">**setMouseoverCanvasRef**</span><br><code>(ref: HTMLCanvasElement &#124; null) =&gt; void</code> |  |
