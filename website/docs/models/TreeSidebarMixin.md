---
id: treesidebarmixin
title: TreeSidebarMixin
sidebar_label: Mixin -> TreeSidebarMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/tree-sidebar/src/TreeSidebarMixin.ts).

#crossCuttingMixin Row set with a dendrogram sidebar. `sources` (the display rows, named), the three `treeSidebarConfigSchemaFields` slots, plus the `run` callback naming its own clustering RPC and the `sortRows` callback naming what a row carries at a column. Brings `layout` / `clusterTree` / `clusterProvenance` / `treeAreaWidth` / `subtreeFilter`, the `showTree` / `showBranchLength` / `showRowLabels` getters and setters over those slots, the `runClustering` / `clusterRegion` and `sortRowsBy` declarative launch specs `setupTreeSidebarAutoruns` consumes, the `root`, `willClearTree` and `rowOrderIsCustom` getters, and the tree-hover and canvas-ref volatiles the shared sidebar draws through
Adds a dendrogram sidebar to a display: stores the leaf layout, newick cluster
tree, sidebar width and subtree filter, plus the hover/canvas volatile state
used while drawing the tree.

**The three toggles are declared here because this package reads them.**
`treeSidebarGeometry` reads `showTree`, `treeMenuItems` reads all three and
`setShowTree`, `computeClusterHierarchy` takes `showBranchLength` — so a
display composing this mixin and not supplying them would compile and then
fail at the first menu click. They were four hand-written `getConf` /
`setConf` copies, which is the same shape the config half was in before
`treeSidebarConfigSchemaFields`: that set had already drifted, three displays
spelling the labels toggle `showRowLabels` and the fourth
`showSidebarLabels`, so `"showRowLabels": false` on a multi-sample variant
track was dropped in silence. Slots and accessors now move together.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-layout">**layout**</span><br><code>layout: types.stripDefault(types.frozen&lt;S[]&gt;(), [])</code> |  |
| <span id="property-clustertree">**clusterTree**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>clusterTree: types.stripDefault(types.maybe(types.string), unde…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>clusterTree: types.stripDefault(types.maybe(types.string), undefined)</code></pre></dialog></span> |  |
| <span id="property-clusterprovenance">**clusterProvenance**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>clusterProvenance: types.stripDefault( types.maybe(types.frozen…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>clusterProvenance: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.maybe(types.frozen&lt;ClusterProvenance&gt;()),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;undefined,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | What `clusterTree` was computed from — the locus and the settings. Set only for a tree this app computed; a supplied phylogeny (maf's `.nh`) leaves it undefined. Persisted with the tree so it survives a session snapshot, which is the case that most needs it: a shared link otherwise hands over a dendrogram with no way to learn its locus. |
| <span id="property-treeareawidth">**treeAreaWidth**</span><br><code>treeAreaWidth: types.stripDefault(types.number, 80)</code> |  |
| <span id="property-subtreefilter">**subtreeFilter**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>subtreeFilter: types.stripDefault( types.maybe(types.array(type…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>subtreeFilter: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.maybe(types.array(types.string)),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;undefined,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="property-runclustering">**runClustering**</span><br><code>runClustering: types.maybe(types.boolean)</code> | Transient declarative launch spec, the same idea as `LinearGenomeView`'s `init`: a session or config sets this true and the real clustering RPC runs once automatically, with no dialog, as soon as the display reports itself ready. `setupRunClusteringAutorun` clears it afterwards, so a saved session never re-triggers.<br><br>Lives here rather than on each display because it is the trigger for a run whose *output* — `clusterTree`, `clusterProvenance`, `layout` — is this mixin's state. Three displays declared it identically, each with its own wrapper module that existed to code-split the clustering code and, along the way, hand-wrote the same six-member duck type of the display. Splitting inside the `run` callback does the same job and loads on a run rather than on every attach. What each run actually *is* stays per display, in that callback. |
| <span id="property-clusterregion">**clusterRegion**</span><br><code>clusterRegion: types.maybe(types.string)</code> | Where that run reads from, as a locstring (whitespace-separated for several). Clustering is region-scoped, so running it over the visible window feeds the estimator whatever happens to be on screen; naming the locus instead lets a session cluster on the signal and then show it against its context — otherwise a zoom the user has to perform in the right order. Cleared with `runClustering`, since it is that flag's argument and a locus left standing describes a run that is not coming. |
| <span id="property-sortrowsby">**sortRowsBy**</span><br><code>sortRowsBy: types.maybe(types.frozen&lt;RowSortSpec&gt;())</code> | Transient declarative launch spec, the same idea as `runClustering`: set `{refName, pos}` to order the rows once by the value each carries at that genomic column — the session-expressible form of the right-click "Sort rows by ... here". `setupRowSortAutorun` applies it once the region containing it has loaded and then clears it, so the resulting `layout` persists but a saved session never re-sorts.<br><br>Where clustering orders rows by the whole region in view and `layout` states an order outright, only this one says "rank them here", which is what lets a figure open a cohort ranked at a candidate locus with the surrounding context still on screen. What the value at the column *is* stays per display, in its `sortRows` callback. |

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
| <span id="getter-showtree">**showTree**</span><br><code>boolean</code> | Whether the dendrogram sidebar is drawn. |
| <span id="getter-showbranchlength">**showBranchLength**</span><br><code>boolean</code> | Whether tree nodes are positioned by branch length (dendrogram) or evenly by topology (cladogram). |
| <span id="getter-showrowlabels">**showRowLabels**</span><br><code>boolean</code> | Whether each row's name is drawn over the left of the plot. |
| <span id="getter-parsedtree">**parsedTree**</span><br><code>HierarchyNode&lt;NewickNode&gt; &#124; undefined</code> |  |
| <span id="getter-root">**root**</span><br><code>HierarchyNode&lt;NewickNode&gt; &#124; undefined</code> |  |
| <span id="getter-treehasbranchlengths">**treeHasBranchLengths**</span><br><code>boolean</code> |  |
| <span id="getter-roworderiscustom">**rowOrderIsCustom**</span><br><code>boolean</code> | Whether the rows have been arranged away from the order they arrived in — what "Reset row order" is offered on. A written `layout` here; a display whose config seeds `layout` on load (the multi-sample variant displays' `colorBy` / `groupBy`) overrides it to compare against that seed, so the reset does not appear on a track nobody has touched. |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-willcleartree">**willClearTree**</span><br><code>(next: S[]) =&gt; boolean</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setshowtree">**setShowTree**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-setshowbranchlength">**setShowBranchLength**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-setshowrowlabels">**setShowRowLabels**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-setlayout">**setLayout**</span><br><code>(layout: S[]) =&gt; void</code> |  |
| <span id="action-clearlayout">**clearLayout**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setclustertree">**setClusterTree**</span><br><code>(tree?: string &#124; undefined) =&gt; void</code> |  |
| <span id="action-setlayoutandclustertree">**setLayoutAndClusterTree**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(layout: S[], tree?: string &#124; undefined, provenance?: ClusterPr…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(layout: S[], tree?: string &#124; undefined, provenance?: ClusterProvenance &#124; undefined) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-settreeareawidth">**setTreeAreaWidth**</span><br><code>(width: number) =&gt; void</code> |  |
| <span id="action-setsubtreefilter">**setSubtreeFilter**</span><br><code>(names?: string[] &#124; undefined) =&gt; void</code> |  |
| <span id="action-setrunclustering">**setRunClustering**</span><br><code>(arg?: boolean &#124; undefined) =&gt; void</code> |  |
| <span id="action-setclusterregion">**setClusterRegion**</span><br><code>(arg?: string &#124; undefined) =&gt; void</code> |  |
| <span id="action-setsortrowsby">**setSortRowsBy**</span><br><code>(arg?: RowSortSpec &#124; undefined) =&gt; void</code> | Trigger (or clear) a one-shot declarative row sort; consumed and reset by `setupRowSortAutorun`. A display's right-click item calls its own sort directly (instant, the data is already loaded); this is the session-level entry point. |
| <span id="action-sethoveredtreenode">**setHoveredTreeNode**</span><br><code>(node?: HoveredTreeNode &#124; undefined) =&gt; void</code> |  |
| <span id="action-settreecanvasref">**setTreeCanvasRef**</span><br><code>(ref: HTMLCanvasElement &#124; null) =&gt; void</code> |  |
| <span id="action-setmouseovercanvasref">**setMouseoverCanvasRef**</span><br><code>(ref: HTMLCanvasElement &#124; null) =&gt; void</code> |  |
