---
id: treesidebarmixin
title: TreeSidebarMixin
sidebar_label: Mixin -> TreeSidebarMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/tree-sidebar/src/TreeSidebarMixin.ts).

#crossCuttingMixin Row set with a dendrogram sidebar, its arrangement the display's `rows` config object and its row colours the `rowColor` object, each written as a session edit to the track's config so undo, reset and a share link reach it and it survives unticking the track. Brings the sidebar toggles, the `runClustering` / `clusterRegion` and `sortRowsBy` declarative launch specs `setupTreeSidebarAutoruns` consumes, the row arrangement every shared consumer goes through, the rows derived from it (`editableSources`, `clusterableSources`) with the arrangement dialog's `applyRowEdits`, the `root` getter, and the tree-hover and canvas-ref volatiles the shared sidebar draws through. A display supplies `discoveredRows` and overrides the hooks its rows need

The rows are derived in stages, each a computed of its own: the display's
`discoveredRows`, then `expandedRows` (`expandRows`: a variant display's
haplotypes), then `editableSources`, ordered by `rowOrder`, relabelled by
`rows.labels` and tinted by the `rowColor` pairs on the `identityChannel`,
then `clusterableSources`, narrowed to the focus, then `bandedSources`,
stacked in the bands `rowBanding` names. The row palette is
`dealtRowColors`, dealt by `rowColorDeal` once per change to the deal, and
`rowColorScale` hands each row its value's colour, which each display
paints over those.

Every arrangement write reaches the session at once rather than after the
track's 400 ms save, so a clustering run is one undo step and undoable the
moment its tree appears. "Reset row order" returns each member, and
`rowColor` where it sets a row a colour, to what the config.json declares,
or what a track the session owns was added with, and never touches
`rows.field`.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-runclustering">**runClustering**</span><br><code>runClustering: types.maybe(types.boolean)</code> | Transient declarative launch spec, the same idea as `LinearGenomeView`'s `init`: a session or config sets this true and the real clustering RPC runs once automatically, with no dialog, as soon as the display reports itself ready. `setupRunClusteringAutorun` clears it afterwards, so a saved session never re-triggers. |
| <span id="property-clusterregion">**clusterRegion**</span><br><code>clusterRegion: types.maybe(types.string)</code> | Where that run reads from, as a locstring (whitespace-separated for several). Clustering is region-scoped, so naming the locus lets a session cluster on the signal and then show it against its context. Cleared with `runClustering`, since it is that flag's argument. |
| <span id="property-sortrowsby">**sortRowsBy**</span><br><code>sortRowsBy: types.maybe(types.frozen&lt;RowSortSpec&gt;())</code> | Transient declarative launch spec, the same idea as `runClustering`: set `{refName, pos}` to order the rows once by the value each carries at that genomic column — the session-expressible form of the right-click "Sort rows by ... here". `setupRowSortAutorun` applies it once the region containing it has loaded and then clears it, so the resulting order persists but a saved session never re-sorts. |

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
| <span id="getter-treeareawidth">**treeAreaWidth**</span><br><code>number</code> | Width in px of the sidebar the dendrogram draws in. On the config rather than the display snapshot for the same reason `height` is: the config node outlives the display instance, so a dragged width survives unticking and reticking the track. |
| <span id="getter-rowdomain">**rowDomain**</span><br><code>string[]</code> | The row order, `rows.domain`: the rows it names lead, in its order, and the rest follow as `unlistedRowsSort` says. |
| <span id="getter-rowlabels">**rowLabels**</span><br><code>Readonly&lt;Record&lt;string, string&gt;&gt;</code> | The labels drawn in place of row names, `rows.labels`, by name. |
| <span id="getter-rowtree">**rowTree**</span><br><code>string &#124; undefined</code> | The cluster tree the rows are arranged by, `rows.tree`, as newick. |
| <span id="getter-rowtreeprovenance">**rowTreeProvenance**</span><br><code>ClusterProvenance &#124; undefined</code> | What `rowTree` was computed from, the locus and the settings; undefined for a tree that arrived as data. |
| <span id="getter-rowfocus">**rowFocus**</span><br><code>readonly string[] &#124; undefined</code> | The row names a focus narrows the display to, `rows.kept` — a clade picked off the tree or a key row's rows — or undefined while every row shows. |
| <span id="getter-rowcolorsetting">**rowColorSetting**</span><br><code>RowColorSetting</code> | The `rowColor` object: the row attribute whose values take colours, `name` where it names none, the scale, and the values given a colour of their own. |
| <span id="getter-rowcolorchoice">**rowColorChoice**</span><br><code>string</code> | What the rows are coloured by, as the arrangement dialog and a menu offer it: '' for none, `name` for each row its own, or an attribute. |
| <span id="getter-baserowcolor">**baseRowColor**</span><br><code>Partial&lt;RowColorSetting&gt;</code> | The `rowColor` object this display's base declares, as written, which a reset returns to and "is this the reader's" compares against. |
| <span id="getter-baserowdomain">**baseRowDomain**</span><br><code>readonly string[]</code> | The `rows.domain` this display's base declares: the base arrangement a row palette deals over, so no reorder recolours a row. |
| <span id="getter-discoveredrows">**discoveredRows**</span><br><code>S[]</code> | Overridable hook, which every display overrides: the rows as the data reports them, before any arrangement. A getter, and a stable-identity one wherever the rows come off region payloads, so a refetch of the same rows re-derives nothing. |
| <span id="getter-rowalias">**rowAlias**</span><br><code>RowAlias &#124; undefined</code> | Overridable hook: the name a row also answers to, for a display whose rows stand for something named by another name (a variant display's haplotype rows, each answering to its sample). An order, a label, a tint and a focus written against the alias reach every row answering to it. None by default. |
| <span id="getter-identitychannel">**identityChannel**</span><br><code>IdentityChannel</code> | Overridable hook: the row channel a `rowColor` entry paints, `color` by default. |
| <span id="getter-unlistedrowssort">**unlistedRowsSort**</span><br><code>UnlistedRowsSort</code> | Overridable hook: where the rows `rowOrder` does not list go, in the order they arrived by default. |
| <span id="getter-rowbanding">**rowBanding**</span><br><code>RowBanding &#124; undefined</code> | Overridable hook: the attribute the rows stack in bands by and the bands listed first, or undefined, the default, for no bands. |
| <span id="getter-roworder">**rowOrder**</span><br><code>readonly string[]</code> | Overridable hook: the names the rows are placed by, `rows.domain` by default; MAF leads with a drawn tree's leaves. |
| <span id="getter-rowcolors">**rowColors**</span><br><code>ReadonlyMap&lt;string, string&gt;</code> | The colour a reader set on each named row: the `rowColor` pairs while it paints by `name`, and none while it paints by another field. |
| <span id="getter-rowstylingiscustom">**rowStylingIsCustom**</span><br><code>boolean</code> | Whether `rowColor` sets a row, or a value of the attribute it paints by, a colour the config does not, so "Reset row order" is offered for a recolour too. Picking a colour by attribute sets no colour, so over a config setting none it is not a custom arrangement. |
| <span id="getter-expandedrows">**expandedRows**</span><br><code>S[]</code> | `discoveredRows` through `expandRows`: the rows at the granularity drawn, before any arrangement. |
| <span id="getter-rowcolorfields">**rowColorFields**</span><br><code>readonly string[]</code> | Overridable hook: the row attributes a reader can colour the rows by, offered beside None and Each row. By default every attribute a row carries but its name, label and colours. |
| <span id="getter-rowcolordeal">**rowColorDeal**</span><br><code>RowColorDeal&lt;S&gt; &#124; undefined</code> | What the row palette deals under the config's `rowColor`, none under `scale: 'none'`. |
| <span id="getter-dealtrowcolors">**dealtRowColors**</span><br><code>ReadonlyMap&lt;string, string&gt;</code> | The colour the row palette deals each value of `rowColorDeal`, dealt again only when the deal changes, never on a region arrival that leaves it alone. |
| <span id="getter-rowcolorscale">**rowColorScale**</span><br><code>ReadonlyMap&lt;string, string&gt;</code> | The colour the row palette deals each row, by name: each row's value looked up in `dealtRowColors`. Each display paints it where its palette lands, with its own precedence over a row's own colour. |
| <span id="getter-rowarrangementiscustom">**rowArrangementIsCustom**</span><br><code>boolean</code> | Whether the arrangement differs from what the config declares — what "Reset row order" is offered on. |
| <span id="getter-editablesources">**editableSources**</span><br><code>S[]</code> | The rows in the reader's arrangement, with no focus, palette or band: the list the arrangement dialog edits, so a submit writes back only what the reader chose. `expandedRows` itself while nothing is arranged. |
| <span id="getter-dialogsources">**dialogSources**</span><br><code>S[]</code> | The rows the arrangement dialog opens on: `editableSources`, with the `name` pairs a `scale: 'none'` keeps for the way back on them, so Each row shows what a submit writes and a clear reaches them. |
| <span id="getter-clusterablesources">**clusterableSources**</span><br><code>S[]</code> | `editableSources` narrowed to the focus: the rows a clustering run clusters, and deliberately not the display's decorated `sources`, whose palette and band a run has no business writing back. |
| <span id="getter-parsedtree">**parsedTree**</span><br><code>HierarchyNode&lt;NewickNode&gt; &#124; undefined</code> |  |
| <span id="getter-root">**root**</span><br><code>HierarchyNode&lt;NewickNode&gt; &#124; undefined</code> | The parsed tree narrowed to the focus. |
| <span id="getter-bandedrows">**bandedRows**</span><br><code>{ rows: S[]; bands: RowBand[]; }</code> | `bandedSources` and `rowBands`, from one pass over the rows. |
| <span id="getter-bandedsources">**bandedSources**</span><br><code>S[]</code> | `clusterableSources` stacked in bands by `rowBanding`, each band's rows in their arranged order: the rows each display paints its palette over. `clusterableSources` itself while nothing bands. |
| <span id="getter-rowbands">**rowBands**</span><br><code>readonly RowBand[]</code> | Each band's value, label and the rows it spans in `bandedSources`; none while nothing bands. |
| <span id="getter-clusterpartition">**clusterPartition**</span><br><code>string[][] &#124; undefined</code> | The names of the rows a clustering run clusters, by band, so each band clusters apart and the run writes one forest; undefined while fewer than two bands stack. |
| <span id="getter-treelessbandcount">**treelessBandCount**</span><br><code>number</code> | How many bands the tree draws no dendrogram for, because it holds no clade whose leaves are that band's rows in order; 0 with no tree or no bands. |
| <span id="getter-treehasbranchlengths">**treeHasBranchLengths**</span><br><code>boolean</code> | Whether the tree carries merge heights, so a dendrogram layout differs from the cladogram; gates the "Tree branch lengths" toggle. |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-expandrows">**expandRows**</span><br><code>(rows: S[]) =&gt; S[]</code> | Overridable hook: the discovered rows as the rows drawn, the rows themselves by default; a variant display's phased mode expands each sample to its haplotypes. |
| <span id="method-rowband">**rowBand**</span><br><code>(row: S) =&gt; string</code> | Overridable hook: the band a row stacks in while `rowBanding` is set, by default its value of the banding attribute, '' for none. |
| <span id="method-rowcolordealfor">**rowColorDealFor**</span><br><code>(setting: RowColorEntries) =&gt; RowColorDeal&lt;S&gt; &#124; undefined</code> | Overridable hook: what the row palette deals under `setting`, the config's or one the arrangement dialog previews, or undefined to deal none. By default the values of `setting.field` over the rows in the base arrangement, the values its `domain` lists taking its `range`, and every other value the next palette colour, so no reorder, focus or relabel recolours a row. |
| <span id="method-rowcolorsfor">**rowColorsFor**</span><br><code>(setting: RowColorSetting) =&gt; ReadonlyMap&lt;string, string&gt;</code> | The colour each value takes under `setting`, which the arrangement dialog shows before it writes the setting. |
| <span id="method-roworderwilldroptree">**rowOrderWillDropTree**</span><br><code>(next: readonly { name: string; }[]) =&gt; boolean</code> | Whether the arrangement dialog's submit of `next` drops the tree: an order that moves no row is not written, so it drops nothing. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setshowtree">**setShowTree**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-setshowbranchlength">**setShowBranchLength**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-setshowrowlabels">**setShowRowLabels**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-settreeareawidth">**setTreeAreaWidth**</span><br><code>(width: number) =&gt; void</code> |  |
| <span id="action-setrunclustering">**setRunClustering**</span><br><code>(arg?: boolean &#124; undefined) =&gt; void</code> |  |
| <span id="action-setclusterregion">**setClusterRegion**</span><br><code>(arg?: string &#124; undefined) =&gt; void</code> |  |
| <span id="action-setsortrowsby">**setSortRowsBy**</span><br><code>(arg?: RowSortSpec &#124; undefined) =&gt; void</code> | Trigger (or clear) a one-shot declarative row sort; consumed and reset by `setupRowSortAutorun`. |
| <span id="action-sethoveredtreenode">**setHoveredTreeNode**</span><br><code>(node?: HoveredTreeNode &#124; undefined) =&gt; void</code> |  |
| <span id="action-settreecanvasref">**setTreeCanvasRef**</span><br><code>(ref: HTMLCanvasElement &#124; null) =&gt; void</code> |  |
| <span id="action-setmouseovercanvasref">**setMouseoverCanvasRef**</span><br><code>(ref: HTMLCanvasElement &#124; null) =&gt; void</code> |  |
| <span id="action-setroworder">**setRowOrder**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(rows: readonly { name: string; }[], run?: ClusterRun &#124; undefin…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(rows: readonly { name: string; }[], run?: ClusterRun &#124; undefined) =&gt; void</code></pre></dialog></span> | Arrange the rows in `rows`' order, ahead of any name the current order carries that `rows` does not. A clustering run passes its result, and the tree and its provenance land with the order; any other reorder that moves a row drops the tree, which no longer describes it. |
| <span id="action-setrowlabels">**setRowLabels**</span><br><code>(labels: Readonly&lt;Record&lt;string, string&gt;&gt;) =&gt; void</code> | The labels drawn in place of row names, whole: a row the map does not name shows the name it arrived with. |
| <span id="action-setrowfocus">**setRowFocus**</span><br><code>(names?: readonly string[] &#124; undefined) =&gt; void</code> | Narrow the display to `names`, or show every row again. |
| <span id="action-applyrowedits">**applyRowEdits**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(rows: readonly S[], rowColor?: Partial&lt;RowColorSetting&gt; &#124; unde…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(rows: readonly S[], rowColor?: Partial&lt;RowColorSetting&gt; &#124; undefined) =&gt; void</code></pre></dialog></span> | The arrangement dialog's submit: the rows in their new order, each carrying the label and colour the reader left on it, and the `rowColor` object the dialog shows, the config's own when omitted. The labels go to `rows` by the rule `rowEdits` states, and the order to `rows.domain` unless it moves no row, so a submit that changes nothing writes nothing. The rows' colours are read only under an object painting by `name`, whose pairs they become; any other object is written as the dialog shows it, so a colour set on one row never stands for its attribute's value. |
| <span id="action-resetrowstyling">**resetRowStyling**</span><br><code>() =&gt; void</code> | Return the `rowColor` object, whole, to what the config declares where it sets a row a colour the config does not, so a colour by attribute stays and one a recolour turned into pairs comes back. |
| <span id="action-resetrowarrangement">**resetRowArrangement**</span><br><code>() =&gt; void</code> | Return every arrangement member — order, labels, tree, provenance and focus — and the `rowColor` object to what the config declares, leaving `rows.field`. |
