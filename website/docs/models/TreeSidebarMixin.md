---
id: treesidebarmixin
title: TreeSidebarMixin
description: "Row set with a dendrogram sidebar, its arrangement and its row colors the display's rows config object (rows.colors pinned on rows, rows.color mapped from an attribute), each written as a session…"
sidebar_label: Mixin -> TreeSidebarMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source. See the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/tree-sidebar/src/TreeSidebarMixin.ts).

Row set with a dendrogram sidebar, its arrangement and its row colors the display's `rows` config object (`rows.colors` pinned on rows, `rows.color` mapped from an attribute), each written as a session edit to the track's config so undo, reset and a share link reach it and it survives unticking the track. Brings the sidebar toggles, the `runClustering` / `clusterRegion` and `sortRowsBy` declarative launch specs `setupTreeSidebarAutoruns` consumes, the row arrangement every shared consumer goes through, the rows derived from it (`editableSources`, `clusterableSources`) with the arrangement dialog's `applyRowEdits`, the `root` getter, and the tree-hover and canvas-ref volatiles the shared sidebar draws through. A display supplies `discoveredRows`, and `guideTreeNewick` where its adapter has a tree, and overrides the hooks its rows need

The rows are derived in stages, each a separate computed: the display's
`discoveredRows`, then `expandedRows` (`expandRows`: a variant display's
haplotypes), then `editableSources`, ordered by `rowOrder`, relabelled by
`rows.labels` and each with its resolved color as `rowColor`, then
`clusterableSources`, narrowed to the focus, then `bandedSources`, stacked
in the bands `rowBanding` names. The stages, the row colors, where
the rows start (`rowsTopOffset`) and the dendrogram positioned against them
(`hierarchy`) are written in `treeSidebarRowViews.ts`,
which a tables export installs on a model of its own beside its display's
row hooks, so it arranges and colors the rows as the view does.

A row's color is `resolvedRowColors`: its `rows.colors` entry, else its
`rows.color` entry (the color `dealtValueColors` deals its field's value),
else the row's `color`, else the row palette's color by name where
`rowPaletteDeals`. The
sidebar draws it as a bar beside the row's label, and a display paints its
marks in it where `rowColorPaintsMarks`. Its key is `rowColorScales`, and a
click on an entry focuses that entry's rows (`focusLegendEntry`).

Every arrangement write reaches the session at once rather than after the
track's 400 ms save, so a clustering run is one undo step and undoable the
moment its tree appears. "Reset row order" returns each member, and
`rows.color` where it sets a row a color, to what the config.json declares,
or what a track the session owns was added with, and never touches
`rows.field`.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-runclustering">**runClustering**</span><br><code>types.maybe(types.boolean)</code> | Transient declarative launch spec, the same idea as `LinearGenomeView`'s `init`: a session or config sets this true and the real clustering RPC runs once automatically, with no dialog, as soon as the display reports itself ready. `setupRunClusteringAutorun` clears it afterwards, so a saved session never re-triggers. |
| <span id="property-clusterregion">**clusterRegion**</span><br><code>types.maybe(types.string)</code> | Where that run reads from, as a locstring (whitespace-separated for several). Clustering is region-scoped, so naming the locus lets a session cluster on the signal and then show it against its context. Cleared with `runClustering`, since it is that flag's argument. |
| <span id="property-sortrowsby">**sortRowsBy**</span><br><code>types.maybe(types.frozen&lt;RowSortSpec&gt;())</code> | Transient declarative launch spec, the same idea as `runClustering`: set `{refName, pos}` to order the rows once by the value each row has at that genomic column — the session-expressible form of the right-click "Sort rows by ... here". `setupRowSortAutorun` applies it once the region containing it has loaded and then clears it, so the resulting order persists but a saved session never re-sorts. |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-hoveredtreenode">**hoveredTreeNode**</span><br><code>HoveredTreeNode &#124; undefined</code> |  |
| <span id="volatile-treecanvas">**treeCanvas**</span><br><code>HTMLCanvasElement &#124; null</code> |  |
| <span id="volatile-mouseovercanvas">**mouseoverCanvas**</span><br><code>HTMLCanvasElement &#124; null</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-showtree">**showTree**</span><br><code>boolean</code> | Whether the dendrogram sidebar is drawn. |
| <span id="getter-showbranchlength">**showBranchLength**</span><br><code>boolean</code> | Whether the tree draws nodes at their branch length (dendrogram) or evenly by topology (cladogram). |
| <span id="getter-showrowlabels">**showRowLabels**</span><br><code>boolean</code> | Whether each row's name is drawn over the left of the plot. |
| <span id="getter-treeareawidth">**treeAreaWidth**</span><br><code>number</code> | Width in px of the sidebar the dendrogram draws in. On the config rather than the display snapshot for the same reason `height` is: the config node outlives the display instance, so a dragged width survives unticking and reticking the track. |
| <span id="getter-rowslistedupfront">**rowsListedUpFront**</span><br><code>boolean</code> | Overridable hook: whether the track lists its rows before any region loads (a VCF's samples, a multi-wiggle's subtracks), so a `rows.kept` name no row has is a typo worth naming. False by default, for rows found per window. |
| <span id="getter-baserowcolorchannel">**baseRowColorChannel**</span><br><code>RowColorSetting</code> | The `rows.color` object this display's base declares, which a reset returns to and "is this the reader's" compares against. |
| <span id="getter-rowsort">**rowSort**</span><br><code>string[]</code> | The row order, `rows.sort`: the rows it names lead, in its order, and the rest follow as `unlistedRowsSort` says. |
| <span id="getter-rowlabels">**rowLabels**</span><br><code>Readonly&lt;Record&lt;string, string&gt;&gt;</code> | The labels drawn in place of row names, `rows.labels`, by name. |
| <span id="getter-storedrowtree">**storedRowTree**</span><br><code>string &#124; undefined</code> | The newick `rows.tree` stores, a clustering run's or one that arrived as data; undefined while none is stored. |
| <span id="getter-rowtreeprovenance">**rowTreeProvenance**</span><br><code>ClusterProvenance &#124; undefined</code> | What `rowTree` was computed from, the locus and the settings; undefined for a tree that arrived as data, and while no newick is stored, since a provenance describes only the newick beside it. |
| <span id="getter-rowfocus">**rowFocus**</span><br><code>readonly string[] &#124; undefined</code> | Overridable hook: the row names a focus narrows the display to, `rows.kept` — a clade picked off the tree or a key row's rows — or undefined while every row shows. A display that can hide its rows answers undefined while they are hidden. |
| <span id="getter-rowfilter">**rowFilter**</span><br><code>readonly FieldPredicate[]</code> | Overridable hook: `rows.filter`, the predicates over row attributes a row must pass to show, none where the display declares none. A display that can hide its rows answers none while they are hidden. |
| <span id="getter-rowcolorchannel">**rowColorChannel**</span><br><code>RowColorSetting</code> | The `rows.color` object: the row field whose values take colors, `name` where it names none, and the values with an assigned color. |
| <span id="getter-rowcolorpins">**rowColorPins**</span><br><code>ReadonlyMap&lt;string, string&gt;</code> | The colors pinned on rows, `rows.colors`, by name. |
| <span id="getter-rowannotationchannels">**rowAnnotationChannels**</span><br><code>RowAnnotationSetting[]</code> | The `rows.annotations` channels drawn, in the order listed, each read as `rowColorChannel` reads `rows.color`: none while the row labels they draw beside are hidden, and never one on `name`, which the labels already show. Each keeps its `position` in the list. |
| <span id="getter-baserowcolorsetting">**baseRowColorSetting**</span><br><code>RowColorSetting</code> | `rowColorSetting` as this display's base declares it. |
| <span id="getter-finertreehint">**finerTreeHint**</span><br><code>{ text: string; title: string; }</code> | Overridable hook: what the sidebar says where the tree's leaves are `finerRows`, which it hides. |
| <span id="getter-svgsidebar">**svgSidebar**</span><br><code>SvgSidebarProps &#124; undefined</code> | Overridable hook: what the SVG export draws in the sidebar left of the track, or undefined, the default, for none. `SvgTreeSidebar` draws it and `svgSidebarWidth` sizes the gutter from it. |
| <span id="getter-internalrowfields">**internalRowFields**</span><br><code>readonly string[]</code> | Overridable hook: the row fields that are display plumbing, which the arrangement dialog never lists as a column. |
| <span id="getter-rowcolorfields">**rowColorFields**</span><br><code>readonly string[]</code> | Overridable hook: the row fields a reader can color the rows by, offered beside None and Each row. By default every field a row has but its name, label and colors. |
| <span id="getter-baserowfilter">**baseRowFilter**</span><br><code>FieldPredicate[]</code> | The `rows.filter` this display's base declares, which "Show all" and "Reset row order" return to. |
| <span id="getter-rowbandingnotices">**rowBandingNotices**</span><br><code>string[]</code> | A line for the corner notice when rows have arrived and none has the field `rowBanding` bands by, which then bands nothing. Each display spreads it into its `notices`. |
| <span id="getter-rowcoloriscustom">**rowColorIsCustom**</span><br><code>boolean</code> | Whether `rows.color` gives its field's values colors the config does not, so "Reset row order" is offered for a recolor too: whether `rowColorResetTarget` has anything to write. A choice of row color source is no arrangement, so it is never custom. The pins are an arrangement member. |
| <span id="getter-rowcolorchoice">**rowColorChoice**</span><br><code>string</code> | The choice of what colors the rows, as the arrangement dialog and a menu offer it: '' for none dealt, `name` for a palette color each, or a field. |
| <span id="getter-rowcolorfieldsoffered">**rowColorFieldsOffered**</span><br><code>readonly string[]</code> | The fields a reader can color the rows by: `rowColorFields`, and the current one where the rows lack it, so it still shows as chosen. |
| <span id="getter-rowarrangementiscustom">**rowArrangementIsCustom**</span><br><code>boolean</code> | Whether the arrangement differs from what the config declares — what "Reset row order" is offered on. |
| <span id="getter-rotatablerowtree">**rotatableRowTree**</span><br><code>string &#124; undefined</code> | The tree a reorder rotates rather than drops, as newick: a supplied `rows.tree`, one with no provenance, else the guide tree while `guideTreeHonoursDomain`. A computed tree is never one, since its run rotated it already. |
| <span id="getter-autoclusterready">**autoClusterReady**</span><br><code>boolean</code> | Overridable hook: whether the declarative `runClustering` run may start, two or more `clusterableSources` by default. |
| <span id="getter-rowscontentheight">**rowsContentHeight**</span><br><code>number</code> | The px the rows stack to, `sources` × `effectiveRowHeight`, which the dendrogram's leaves spread over: the content the rows scroll through, never the viewport they scroll inside. |
| <span id="getter-hierarchy">**hierarchy**</span><br><code>ClusterHierarchyNode &#124; undefined</code> | The dendrogram positioned against the rows drawn, or undefined while there is no tree or `drawsTree` is off. `computeClusterHierarchy` checks the tree's leaves against the drawn row names, the backstop against anything reordering `sources` downstream of the arrangement: such a reorder drops the dendrogram rather than drawing it against rows it does not name. |
| <span id="getter-rowsidebarprops">**rowSidebarProps**</span><br><code>SvgSidebarProps</code> | What the sidebar draws left of the rows, from the settings and the rows drawn: the dendrogram, the band strip, the row labels, the `rows.annotations` columns and the columns' labels. A display's `svgSidebar` is this, or a spread of it with what that display changes, so the screen, the axis past the panel and the export size and draw one sidebar. |
| <span id="getter-sidebarbounds">**sidebarBounds**</span><br><code>SidebarBounds</code> | The box the sidebar covers, in display px: left of `right`, the dendrogram's resize handle's right edge (0 with no tree drawn), and from `rowsTopOffset` down, so a band stacked above the rows stays the display's across its full width. The canvas runs under the sidebar, so x maps to bp as anywhere else. Every pointer gate reads it through `sidebarCovers`, and a drag over the rows stops at `right`. |
| <span id="getter-awaitingdependentdata">**awaitingDependentData**</span><br><code>boolean</code> | Fills `FetchMixin`'s hook: a declared `runClustering` run is due, so the loading scrim and the export wait for the rows it orders. The run clears the flag when it settles, failed or not. |
| <span id="getter-spatialindex">**spatialIndex**</span><br><code>TreeSpatialIndex &#124; undefined</code> | The hit index the sidebar's subtree hover reads, built from `hierarchy`. |
| <span id="getter-clusterpartition">**clusterPartition**</span><br><code>string[][] &#124; undefined</code> | The names of the rows a clustering run clusters, by band, so each band clusters apart and the run writes one forest; undefined while fewer than two bands stack. |
| <span id="getter-treelessbandcount">**treelessBandCount**</span><br><code>number</code> | How many bands the tree draws no dendrogram for, because it holds no clade whose leaves are that band's rows in order; 0 with no tree or no bands. |
| <span id="getter-rownarrowingclears">**rowNarrowingClears**</span><br><code>boolean</code> | Whether "Show all" has anything to clear: `rows.kept` names rows, or `rows.filter` differs from the config's. |
| <span id="getter-rownarrowingnotices">**rowNarrowingNotices**</span><br><code>string[]</code> | The corner notice's lines on the narrowing, once the rows are known: a `rows.filter` field no row carries, what left no row where none shows, and where the track lists its rows up front (`rowsListedUpFront`), the `rows.kept` names no row has. Each display spreads it into its `notices`. |
| <span id="getter-rownarrowinghint">**rowNarrowingHint**</span><br><code>{ text: string; title: string; } &#124; undefined</code> | The chip above the rows while `rowNarrowingShows`: "Showing N of M rows", with "Show all" where `rowNarrowingClears`, and the config's own `rows.filter`, which "Show all" keeps, stated in its tooltip. |
| <span id="getter-treeonfinerrows">**treeOnFinerRows**</span><br><code>boolean</code> | Whether the tree's leaves include rows a finer field draws (`finerRows`), each standing in for a drawn row, as a tree clustered per haplotype is in sample mode: it describes no drawn rows, and the hint says why (`finerTreeHint`). |
| <span id="getter-treehasbranchlengths">**treeHasBranchLengths**</span><br><code>boolean</code> | Whether the tree has merge heights, so a dendrogram layout differs from the cladogram; gates the "Tree branch lengths" toggle. |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-rowfoundatsomeloci">**rowFoundAtSomeLoci**</span><br><code>(_name: string) =&gt; boolean</code> | Overridable hook: whether a row named `name` exists only at some loci even where the track lists its rows, so a `rows.kept` name missing here is no typo: MAF's copy rows (`mm10~2`). False by default. |
| <span id="method-svgsidebarwidth">**svgSidebarWidth**</span><br><code>(text?: ExportTextStyle &#124; undefined) =&gt; number</code> | Px the SVG export reserves left of the track for `svgSidebar`, measured in the export's text. |
| <span id="method-unreadfilterfieldnotice">**unreadFilterFieldNotice**</span><br><code>(field: string, record: string) =&gt; string</code> | The notice for a top-level `filter` field no loaded `record` carries: where a row carries it, a pointer at `rows.filter`, which keeps rows by their attributes, where the top-level `filter` tests records. |
| <span id="method-rowcolorfor">**rowColorFor**</span><br><code>(choice: string) =&gt; RowColorSetting</code> | The `rows.color` object `choice` starts from (`startingRowColor`): the current object's where it shows that choice, else the config's. |
| <span id="method-orderdropsrowtree">**orderDropsRowTree**</span><br><code>(order: readonly string[]) =&gt; boolean</code> | Whether ordering the rows as `order` drops the tree: one a reorder rotates drops only for an order no rotation of it lists, and any other drops for any change. |
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
| <span id="action-setroworder">**setRowOrder**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(rows: readonly { name: string; }[], run?: ClusterRun &#124; undefin…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(rows: readonly { name: string; }[], run?: ClusterRun &#124; undefined) =&gt; void</code></pre></dialog></span> | Arrange the rows in `rows`' order, ahead of any name the current order has that `rows` does not. A clustering run passes its result, and the tree and its provenance land with the order; any other reorder that moves a row drops the tree, which no longer describes it. |
| <span id="action-setrowlabels">**setRowLabels**</span><br><code>(labels: Readonly&lt;Record&lt;string, string&gt;&gt;) =&gt; void</code> | The labels drawn in place of row names, whole: a row the map does not name shows the name it arrived with. |
| <span id="action-setrowfocus">**setRowFocus**</span><br><code>(names?: readonly string[] &#124; undefined) =&gt; void</code> | Narrow the display to `names`, or show every row again. |
| <span id="action-showallrows">**showAllRows**</span><br><code>() =&gt; void</code> | The chip's "Show all": clears `rows.kept` and returns `rows.filter` to the config's, so a filter the config states shows through. |
| <span id="action-applyrowedits">**applyRowEdits**</span><br><code>(rows: readonly S[], { color, colors }?: RowColorEdits) =&gt; void</code> | The arrangement dialog's submit: the rows in their new order, each with the label the reader left on it, and the colors the dialog shows, `rows.colors` and `rows.color`, each written where it differs from the config's. The labels go to `rows` by the rule `labelEdits` states, and the order to `rows.sort` unless it moves no row, so a submit that changes nothing writes nothing. |
| <span id="action-resetrowarrangement">**resetRowArrangement**</span><br><code>() =&gt; void</code> | Return every arrangement member — order, labels, colors, tree, provenance, kept rows and `rows.filter` — to what the config declares, leaving `rows.field`, and `rows.color` to `rowColorResetTarget`: the config's for the choice, which stays. On another field than the config's, the members naming rows clear instead, since the config's name the old field's rows. |
| <span id="action-setrowcolorchoice">**setRowColorChoice**</span><br><code>(choice: string) =&gt; void</code> | Color the rows by `choice`, as a menu picks it: '' for None, `name` for Each row, or a field, starting from `rowColorFor`. The pins stay under every choice. A pick of the current choice writes nothing. |
| <span id="action-focuslegendentry">**focusLegendEntry**</span><br><code>(scaleId: string, value: string) =&gt; void</code> | `LegendHost`'s hook: a click on a row color key entry narrows the rows to those it lists that `rows.filter` admits, so the focus names no row the filter would hide. Every other scale's entries name colors, not rows, and stay inert. |
