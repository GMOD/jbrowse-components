---
id: treesidebarmixin
title: TreeSidebarMixin
description: "Row set with a dendrogram sidebar, its arrangement and its row colors the display's rows config object (rows.colors pinned on rows, rows.color mapped from an attribute), each written as a session…"
sidebar_label: Mixin -> TreeSidebarMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/tree-sidebar/src/TreeSidebarMixin.ts).

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
| <span id="getter-discoveredrows">**discoveredRows**</span><br><code>S[]</code> | Overridable hook, which every display overrides: the rows as the data reports them, before any arrangement. A getter, and a stable-identity one wherever the rows come off region payloads, so a refetch of the same rows re-derives nothing. |
| <span id="getter-guidetreenewick">**guideTreeNewick**</span><br><code>string &#124; undefined</code> | Overridable hook: the guide tree the display's adapter supplies, as newick, which `rowTree` draws while some rotation of it lists `rows.sort`. It never enters `rows.tree`, since the adapter re-supplies it on every load. `undefined` by default. |
| <span id="getter-finerrows">**finerRows**</span><br><code>S[]</code> | Overridable hook: the rows a finer field would draw, each refining a drawn row (`rowParent`), so an order or a focus naming one reaches the row it refines: a sample-mode variant display's haplotype rows. None by default. |
| <span id="getter-unlistedrowssort">**unlistedRowsSort**</span><br><code>UnlistedRowsSort</code> | Overridable hook: where the rows `rowOrder` does not list go, in the order they arrived by default. |
| <span id="getter-rowbanding">**rowBanding**</span><br><code>RowBanding &#124; undefined</code> | Overridable hook: the field the rows stack in bands by and the bands listed first, or undefined, the default, for no bands. |
| <span id="getter-sharespanel">**sharesPanel**</span><br><code>boolean</code> | Overridable hook: whether the rows share one panel, so nothing but color tells them apart. False by default. |
| <span id="getter-rowcolorpaintsmarks">**rowColorPaintsMarks**</span><br><code>boolean</code> | Overridable hook: whether a row's color paints its data marks, which holds while nothing else colors them. True by default. |
| <span id="getter-rownoun">**rowNoun**</span><br><code>string</code> | Overridable hook: what one row is called, which titles the row color key where it lists the rows by name in a shared panel. "Row" by default, which only a display that shares a panel would show; a wiggle overlay's rows are subtracks. |
| <span id="getter-rowsheaderheight">**rowsHeaderHeight**</span><br><code>number</code> | Overridable hook: the px of bands, an axis inset or anything else the display stacks above its rows, 0 by default. |
| <span id="getter-baserowcolorsetting">**baseRowColorSetting**</span><br><code>RowColorSetting</code> | `rowColorSetting` as this display's base declares it. |
| <span id="getter-finertreehint">**finerTreeHint**</span><br><code>{ text: string; title: string; }</code> | Overridable hook: what the sidebar says where the tree's leaves are `finerRows`, which it hides. |
| <span id="getter-svgsidebar">**svgSidebar**</span><br><code>SvgSidebarProps &#124; undefined</code> | Overridable hook: what the SVG export draws in the sidebar left of the track, or undefined, the default, for none. `SvgTreeSidebar` draws it and `svgSidebarWidth` sizes the gutter from it. |
| <span id="getter-expandedrows">**expandedRows**</span><br><code>S[]</code> | `discoveredRows` through `expandRows`: the rows at the granularity drawn, before any arrangement. |
| <span id="getter-guidetree">**guideTree**</span><br><code>HierarchyNode&lt;NewickNode&gt; &#124; undefined</code> | `guideTreeNewick` parsed and rotated towards `rows.sort`; undefined while the display supplies none. |
| <span id="getter-rowpalettedeals">**rowPaletteDeals**</span><br><code>boolean</code> | Whether the palette deals each row a color by name: only where the rows share one panel and their color paints the marks. |
| <span id="getter-rowcolorsetting">**rowColorSetting**</span><br><code>RowColorSetting</code> | `rows.color` with the pins folded in under `name` (`withPinnedColors`), the shape the deal, the choice and the key read. |
| <span id="getter-rowalias">**rowAlias**</span><br><code>RowAlias &#124; undefined</code> | Overridable hook: the name each row also answers to, read off `rowParent`: a refining row its parent's, and a `finerRows` row the drawn row it refines. Undefined while no row refines another. MAF reads it off a copy row's name instead, since a copy exists at some loci only and a stored name must answer where no block aligns it. |
| <span id="getter-rowforks">**rowForks**</span><br><code>ReadonlyMap&lt;string, readonly string[]&gt;</code> | The rows refining each parent no row draws, in their order: what a tree leaf naming that parent forks into, as a sample leaf of a tree clustered per sample forks over its haplotype rows. |
| <span id="getter-guidetreehonoursdomain">**guideTreeHonoursDomain**</span><br><code>boolean</code> | Whether the rotated guide tree lists `rows.sort`'s names in `rows.sort`'s order, which holds exactly when some rotation of it does. |
| <span id="getter-rowcolordealrows">**rowColorDealRows**</span><br><code>readonly S[]</code> | The rows the palette deals over: `expandedRows`, in the order their source lists them, so no `rows.sort` (the config's or a reorder's), focus or relabel recolors a row, and a tables export deals the same. |
| <span id="getter-rowcolorfield">**rowColorField**</span><br><code>string</code> | The field that colors the rows, or '' for `name`. |
| <span id="getter-rownarrowing">**rowNarrowing**</span><br><code>RowNarrowing</code> | What narrows the rows shown: `rowFilter`, then `rowFocus`, through `rowAlias`. The one narrowing the rows drawn, the rows a run clusters, the tree, a fetch's samples and an export all read. |
| <span id="getter-rowtree">**rowTree**</span><br><code>string &#124; undefined</code> | The tree that arranges the rows, as newick: `rows.tree`, else the guide tree while `guideTreeHonoursDomain`. A reorder no rotation produces hides the guide tree, and a reset brings it back. |
| <span id="getter-parsedtree">**parsedTree**</span><br><code>HierarchyNode&lt;NewickNode&gt; &#124; undefined</code> | `rowTree` parsed. A run rotated its tree in the same write as the order it produced; a tree that arrived as data rotates towards `rows.sort` here, and the guide tree is `guideTree`'s parse. |
| <span id="getter-roworder">**rowOrder**</span><br><code>readonly string[]</code> | Overridable hook: the row names in display order. A tree that arrived as data (a supplied `rows.tree` or a guide tree) leads with its leaves, then `rows.sort` for the rows it lacks. `rows.sort` alone otherwise, since a computed tree's run wrote its leaf order there and a later `rows.sort` write is the reader's. |
| <span id="getter-dealtvaluecolors">**dealtValueColors**</span><br><code>ReadonlyMap&lt;string, string&gt;</code> | The color each value of the config's `rows.color` field takes, listed pairs first and then in the order dealt. |
| <span id="getter-resolvedrowcolors">**resolvedRowColors**</span><br><code>ReadonlyMap&lt;string, string&gt;</code> | Each row's color, by name: its `rows.colors` entry, else its `rows.color` entry, else the row's `color`, else the palette's where `rowPaletteDeals`. The one answer every display paints a row's color from. |
| <span id="getter-editablesources">**editableSources**</span><br><code>S[]</code> | The rows in the reader's arrangement, each with its resolved color as `rowColor`, and with no focus or band: the list the arrangement dialog edits, so a submit writes back only what the reader chose. `expandedRows` itself while nothing is arranged or colored. |
| <span id="getter-rowcolorkeyinputs">**rowColorKeyInputs**</span><br><code>RowColorKeyInputs</code> | What the row color key and its focus read of the colors. |
| <span id="getter-clusterablesources">**clusterableSources**</span><br><code>S[]</code> | Overridable hook: `editableSources` narrowed to the focus, the rows a clustering run clusters, and deliberately not the display's decorated `sources`, whose palette and band a run has no business writing back. MAF applies a focus as given on a track that discovers its species. |
| <span id="getter-rowcolorscales">**rowColorScales**</span><br><code>CategoricalScale[]</code> | The row color key, which every display spreads into its `colorScales`: one scale titled by the `rows.color` field, or none where it has no entries. Its entries (`rowColorKeyEntries`) show where the labels cannot name the colors: by a field, where a row `rows.colors` pins takes an entry by its label, or by name in a shared panel. By name on stacked rows the labels are the key. |
| <span id="getter-bandedrows">**bandedRows**</span><br><code>{ rows: S[]; bands: readonly RowBand[]; }</code> | `bandedSources` and `rowBands`, from one pass over the rows. |
| <span id="getter-bandedsources">**bandedSources**</span><br><code>S[]</code> | `clusterableSources` stacked in bands by `rowBanding`, each band's rows in their arranged order: the rows each display paints its palette over. `clusterableSources` itself while nothing bands. |
| <span id="getter-rowbands">**rowBands**</span><br><code>readonly RowBand[]</code> | Each band's value, label and the rows it spans in `bandedSources`; none while nothing bands. |
| <span id="getter-sources">**sources**</span><br><code>S[]</code> | Overridable hook: the rows drawn, top to bottom, `bandedSources` by default. MAF drops its hidden reference row. |
| <span id="getter-rownarrowingshows">**rowNarrowingShows**</span><br><code>boolean</code> | Whether the "Showing N of M rows" chip shows: something narrows the rows, and the rows are known, so no "0 of 0" shows before the first region lands. |
| <span id="getter-rowfocuslineheight">**rowFocusLineHeight**</span><br><code>number</code> | The line the "Showing N of M rows" chip takes above the first row while `rowNarrowingShows`, 0 otherwise. |
| <span id="getter-rowstopoffset">**rowsTopOffset**</span><br><code>number</code> | Where the rows start in the display's box: under the display's own `rowsHeaderHeight` and the focus chip's line. Every row painter, hit test, label, tree and export places the rows from here. |
| <span id="getter-internalrowfields">**internalRowFields**</span><br><code>readonly string[]</code> | Overridable hook: the row fields that are display plumbing, which the arrangement dialog never lists as a column. |
| <span id="getter-rowcolorfields">**rowColorFields**</span><br><code>readonly string[]</code> | Overridable hook: the row fields a reader can color the rows by, offered beside None and Each row. By default every field a row has but its name, label and colors. |
| <span id="getter-baserowfilter">**baseRowFilter**</span><br><code>FieldPredicate[]</code> | The `rows.filter` this display's base declares, which "Show all" and "Reset row order" return to. |
| <span id="getter-rowbandingnotices">**rowBandingNotices**</span><br><code>string[]</code> | A line for the corner notice when rows have arrived and none has the field `rowBanding` bands by, which then bands nothing. Each display spreads it into its `notices`. |
| <span id="getter-rowcoloriscustom">**rowColorIsCustom**</span><br><code>boolean</code> | Whether `rows.color` gives its field's values colors the config does not, so "Reset row order" is offered for a recolor too: whether `rowColorResetTarget` has anything to write. A choice of row color source is no arrangement, so it is never custom. The pins are an arrangement member. |
| <span id="getter-rowcolorchoice">**rowColorChoice**</span><br><code>string</code> | The choice of what colors the rows, as the arrangement dialog and a menu offer it: '' for none dealt, `name` for a palette color each, or a field. |
| <span id="getter-rowcolorfieldsoffered">**rowColorFieldsOffered**</span><br><code>readonly string[]</code> | The fields a reader can color the rows by: `rowColorFields`, and the current one where the rows lack it, so it still shows as chosen. |
| <span id="getter-rowarrangementiscustom">**rowArrangementIsCustom**</span><br><code>boolean</code> | Whether the arrangement differs from what the config declares — what "Reset row order" is offered on. |
| <span id="getter-rotatablerowtree">**rotatableRowTree**</span><br><code>string &#124; undefined</code> | The tree a reorder rotates rather than drops, as newick: a supplied `rows.tree`, one with no provenance, else the guide tree while `guideTreeHonoursDomain`. A computed tree is never one, since its run rotated it already. |
| <span id="getter-root">**root**</span><br><code>HierarchyNode&lt;NewickNode&gt; &#124; undefined</code> | The parsed tree narrowed by `rowNarrowing`, a leaf no row has reading as a row with no attributes; none where it keeps no leaf. |
| <span id="getter-autoclusterready">**autoClusterReady**</span><br><code>boolean</code> | Overridable hook: whether the declarative `runClustering` run may start, two or more `clusterableSources` by default. |
| <span id="getter-treeroot">**treeRoot**</span><br><code>HierarchyNode&lt;NewickNode&gt; &#124; undefined</code> | Overridable hook: the tree `hierarchy` positions, `root` by default. `computeClusterHierarchy` declines to position a tree whose leaves are no longer the rows drawn, so a display that hides a row prunes it from the tree here too, or the whole dendrogram goes with the row. |
| <span id="getter-drawstree">**drawsTree**</span><br><code>boolean</code> | Overridable hook: whether the dendrogram draws at all, true by default; off wherever the rows it would lay against are not drawn. This is the single gate: the on-screen sidebar, the SVG export, `spatialIndex` (subtree hover) and the tooltip dead zone the sidebar reserves all read `hierarchy`, so nothing keeps drawing or reserving space when the tree is off. |
| <span id="getter-rowscontentheight">**rowsContentHeight**</span><br><code>number</code> | The px the rows stack to, `sources` × `effectiveRowHeight`, which the dendrogram's leaves spread over: the content the rows scroll through, never the viewport they scroll inside. |
| <span id="getter-hierarchy">**hierarchy**</span><br><code>ClusterHierarchyNode &#124; undefined</code> | The dendrogram positioned against the rows drawn, or undefined while there is no tree or `drawsTree` is off. `computeClusterHierarchy` checks the tree's leaves against the drawn row names, the backstop against anything reordering `sources` downstream of the arrangement: such a reorder drops the dendrogram rather than drawing it against rows it does not name. |
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
| <span id="method-rowparent">**rowParent**</span><br><code>(_row: S) =&gt; RowParent &#124; undefined</code> | Overridable hook: the row `row` refines, read off the row itself, for a display whose rows stand for something named by another name (a variant display's haplotype row refines its sample, a MAF copy row its species), and what its label adds to that row's. An order, a label, a color and a focus written against the parent reach every row refining it. None by default. |
| <span id="method-expandrows">**expandRows**</span><br><code>(rows: S[]) =&gt; S[]</code> | Overridable hook: the discovered rows as the rows drawn, the rows themselves by default; a variant display's phased mode expands each sample to its haplotypes. |
| <span id="method-rowcolordeclaredvalues">**rowColorDeclaredValues**</span><br><code>(_field: string) =&gt; readonly string[]</code> | Overridable hook: the values of the row field `field` the config declares, which the palette deals first, in this order, whether or not a loaded row carries them, so a row arriving later moves no color. None by default. |
| <span id="method-rowband">**rowBand**</span><br><code>(row: S) =&gt; string</code> | Overridable hook: the band a row stacks in while `rowBanding` is set, by default its value of the banding field, '' for none. |
| <span id="method-dealtvaluecolorsfor">**dealtValueColorsFor**</span><br><code>(setting: RowColorSnapshot) =&gt; ReadonlyMap&lt;string, string&gt;</code> | The color each value takes under `setting` (`dealValueColors`), which the arrangement dialog shows before it writes the setting. |
| <span id="method-narrowrows">**narrowRows**</span><br><code>&lt;T extends { name: string; }&gt;(rows: T[]) =&gt; T[]</code> | `rows` narrowed by `rowNarrowing`: `filter`, then `kept`. |
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
