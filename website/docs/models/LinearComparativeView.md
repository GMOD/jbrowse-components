---
id: linearcomparativeview
title: LinearComparativeView
sidebar_label: View -> LinearComparativeView
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`linear-comparative-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearComparativeView/model.ts).

Members a composed model contributes are listed here too, so these tables are
the whole surface.

## Properties

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  | LinearComparativeView |
| <span id="property-type">**type**</span><br><code>type: types.string</code> | Abstract base: never registered or instantiated standalone, always composed into a concrete subclass (e.g. LinearSyntenyView) that overrides `type` with its own literal. Kept as `types.string` rather than a literal so subclass models stay assignable to this base type. | LinearComparativeView |
| <span id="property-trackselectortype">**trackSelectorType**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>trackSelectorType: types.stripDefault(types.string, 'hierarchic…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>trackSelectorType: types.stripDefault(types.string, 'hierarchical')</code></pre></dialog></span> | vestigial: the hierarchical selector is the only one that exists, so this value is ignored. Retained because saved sessions and configs persist it. | LinearComparativeView |
| <span id="property-linkviews">**linkViews**</span><br><code>linkViews: types.stripDefault(types.boolean, false)</code> | sync scroll and zoom across the genome rows, so panning one pans them all | LinearComparativeView |
| <span id="property-followsynteny">**followSynteny**</span><br><code>followSynteny: types.stripDefault(types.boolean, false)</code> | Move the non-anchor genome rows to whatever region aligns to the anchor row, re-resolved through the synteny data each time the anchor settles. The synteny-aware alternative to `linkViews`, which locks the rows in PIXELS and so drifts apart as soon as an indel accumulates — the two are mutually exclusive (see setRowSyncMode). | LinearComparativeView |
| <span id="property-followanchorindex">**followAnchorIndex**</span><br><code>followAnchorIndex: types.stripDefault(types.number, 0)</code> | Which genome row drives the others while `followSynteny` is on. Every other row is placed by mapping this one's window outward one level at a time. Clamped to the views array by reconcileLevels. | LinearComparativeView |
| <span id="property-levels">**levels**</span><br><code>levels: types.array(LinearSyntenyLevel)</code> | One synteny band per adjacent pair of `views`. Each holds its own track list, which is why the track-selector and add-track widgets address them through `trackContainerFor` — a level is not a view and cannot be the target of their `view` reference. | LinearComparativeView |
| <span id="property-views">**views**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>views: types.array( pluginManager.getViewType('LinearGenomeView…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>views: types.array(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.getViewType('LinearGenomeView')&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;.stateModel as LinearGenomeViewStateModel,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | N genome rows, with N-1 synteny `levels` between adjacent pairs. The views/levels invariant is maintained by reconcileLevels(). | LinearComparativeView |
| <span id="property-viewtrackconfigs">**viewTrackConfigs**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>viewTrackConfigs: types.stripDefault( types.array(pluginManager…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>viewTrackConfigs: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.array(pluginManager.pluggableConfigSchemaType('track')),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;[],&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | this represents tracks specific to this view specifically used for read vs ref dotplots where this track would not really apply elsewhere | LinearComparativeView |
| <span id="property-displayname">**displayName**</span><br><code>displayName: types.maybe(types.string)</code> | <span data-pagefind-ignore>displayName is displayed in the header of the view, or assembly names being used if none is specified</span> | [BaseViewModel](../baseviewmodel#property-displayname) |
| <span id="property-minimized">**minimized**</span><br><code>minimized: types.stripDefault(types.boolean, false)</code> | <span data-pagefind-ignore>collapse the view to its header bar, keeping it in the session rather than closing it</span> | [BaseViewModel](../baseviewmodel#property-minimized) |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-width">**width**</span><br><code>width: undefined as number &#124; undefined</code> |  |
| <span id="volatile-volatileerror">**volatileError**</span><br><code>volatileError: undefined as unknown</code> | View-level failure (e.g. an `init` block that couldn't be applied). Volatile on purpose: a reload re-runs the init autorun from a clean slate, so a transient failure stays recoverable. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-scrollzoom">**scrollZoom**</span><br><code>boolean</code> | scroll-to-zoom is a global, personal preference resolved from the session; toggling it in any view applies everywhere |
| <span id="getter-initialized">**initialized**</span><br><code>boolean</code> |  |
| <span id="getter-error">**error**</span><br><code>unknown</code> |  |
| <span id="getter-assemblynames">**assemblyNames**</span><br><code>string[]</code> |  |
| <span id="getter-allsyntenydisplays">**allSyntenyDisplays**</span><br><code>any[]</code> | Every synteny display across every level, flattened. One memoized getter for the view-wide aggregates that would otherwise each re-flatten the levels. |
| <span id="getter-syntenywarnings">**syntenyWarnings**</span><br><code>ComparativeWarning[]</code> | Data-quality warnings raised by every synteny display, e.g. a reversed assembly row order. What the header's warning button counts. |
| <span id="getter-trackwarnings">**trackWarnings**</span><br><code>TrackWarning[]</code> | The same warnings grouped under the track that raised each, which is what the dialog reports. A stacked view's levels raise `swappedAssembliesWarning` verbatim, and so does every overlaid track that hits it, so the flat list above was N identical rows with nothing to tell the user which file to go fix. Shared with the dotplot's table so the two reports say the same thing. |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-isviewcompact">**isViewCompact**</span><br><code>(idx: number) =&gt; boolean</code> |  |
| <span id="method-trackcontainerfor">**trackContainerFor**</span><br><code>(id: string) =&gt; TrackContainer &#124; undefined</code> | The level that owns a given track list. This view holds one track list per synteny band rather than one of its own, so the track-selector and add-track widgets target a level through here instead of referencing this view directly. By id, not index: reconcileLevels pops levels when a genome row is removed, and an index would silently retarget a different pair. |
| <span id="method-headermenuitems">**headerMenuItems**</span><br><code>() =&gt; MenuItem[]</code> | includes a subset of view menu options because the full list is a little overwhelming. overridden by subclasses |
| <span id="method-showmenuitems">**showMenuItems**</span><br><code>() =&gt; MenuItem[]</code> | items for the "Show..." submenu in the header. overridden by subclasses to add view-specific toggle options |
| <span id="method-menuitems">**menuItems**</span><br><code>() =&gt; MenuItem[]</code> |  |
| <span id="method-rubberbandmenuitems">**rubberBandMenuItems**</span><br><code>() =&gt; { label: string; onClick: () =&gt; void; }[]</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-reconcilelevels">**reconcileLevels**</span><br><code>() =&gt; void</code> | Reconcile the levels array to the views array: exactly one synteny level per gap between adjacent views (N views -> N-1 levels). Grows or shrinks from the end, preserving existing levels and their tracks. The single source of truth for the views/levels invariant. | LinearComparativeView |
| <span id="action-setwidth">**setWidth**</span><br><code>(newWidth: number) =&gt; void</code> |  | LinearComparativeView |
| <span id="action-seterror">**setError**</span><br><code>(e: unknown) =&gt; void</code> |  | LinearComparativeView |
| <span id="action-setviews">**setViews**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(views: ModelCreationType&lt;ExtractCFromProps&lt;_OverrideProps&lt;_Ove…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(views: ModelCreationType&lt;ExtractCFromProps&lt;_OverrideProps&lt;_OverrideProps&lt;…&gt;, { ...; }&gt;&gt;&gt;[]) =&gt; void</code></pre></dialog></span> |  | LinearComparativeView |
| <span id="action-addview">**addView**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(view: ModelCreationType&lt;ExtractCFromProps&lt;_OverrideProps&lt;_Over…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(view: ModelCreationType&lt;ExtractCFromProps&lt;_OverrideProps&lt;_OverrideProps&lt;…&gt;, { ...; }&gt;&gt;&gt;) =&gt; void</code></pre></dialog></span> | Push a new genome row. The new trailing level starts with no synteny tracks. | LinearComparativeView |
| <span id="action-removelastrow">**removeLastRow**</span><br><code>() =&gt; void</code> | Drop the bottom genome row and its synteny level. Only terminal removal is supported: a level's `level` index addresses views[level]/[level+1], so removing a middle row would require reindexing every level below it. Growth and shrinkage both happen at the end of the chain. | LinearComparativeView |
| <span id="action-setlinkviews">**setLinkViews**</span><br><code>(arg: boolean) =&gt; void</code> |  | LinearComparativeView |
| <span id="action-setrowsyncmode">**setRowSyncMode**</span><br><code>(mode: "link" &#124; "follow" &#124; "independent") =&gt; void</code> | The one way to change how the rows track each other, so the two flags can't both be on. They fight if they are: `linkViews` replays the anchor's own scroll/zoom onto every row, which is precisely the pixel lock the follow then has to undo on the next settle, and the moving row visibly jumps twice. | LinearComparativeView |
| <span id="action-setfollowanchorindex">**setFollowAnchorIndex**</span><br><code>(idx: number) =&gt; void</code> |  | LinearComparativeView |
| <span id="action-setscrollzoom">**setScrollZoom**</span><br><code>(arg: boolean) =&gt; void</code> |  | LinearComparativeView |
| <span id="action-activatetrackselector">**activateTrackSelector**</span><br><code>(level: number) =&gt; Widget</code> |  | LinearComparativeView |
| <span id="action-toggletrack">**toggleTrack**</span><br><code>(trackId: string, level?: any) =&gt; any</code> |  | LinearComparativeView |
| <span id="action-showtrack">**showTrack**</span><br><code>(trackId: string, level?: any, initialSnapshot?: any) =&gt; void</code> | No-op for a level that doesn't exist, matching hideTrack/toggleTrack. reconcileLevels already materializes exactly one level per adjacent view pair, so a missing level means the caller named a gap that has no views (e.g. an `init.tracks` with more levels than `init.views` has gaps); creating one here would append a level whose views[level+1] is absent, which renders nothing and silently breaks the views/levels invariant. | LinearComparativeView |
| <span id="action-hidetrack">**hideTrack**</span><br><code>(trackId: string, level?: any) =&gt; void</code> |  | LinearComparativeView |
| <span id="action-squareview">**squareView**</span><br><code>() =&gt; void</code> |  | LinearComparativeView |
| <span id="action-showallregionssamescale">**showAllRegionsSameScale**</span><br><code>() =&gt; void</code> | Show every row's whole region set on ONE bp/px, the coarsest row's, so the largest genome still fills its pane and every other row is drawn shorter in proportion to its size. That difference is the point: rows fit individually to width all end up the same length, which silently stretches a small genome to look like a large one and misaligns every ribbon between them by the ratio. Distinct from squareView, which averages the rows' current scales (the average fits nobody, and each row's own zoom clamp pulls the small ones back to fit-to-width anyway). | LinearComparativeView |
| <span id="action-clearview">**clearView**</span><br><code>() =&gt; void</code> |  | LinearComparativeView |
| <span id="action-togglecompactview">**toggleCompactView**</span><br><code>(idx: number) =&gt; void</code> |  | LinearComparativeView |
| <span id="action-compactallviews">**compactAllViews**</span><br><code>() =&gt; void</code> |  | LinearComparativeView |
| <span id="action-expandallviews">**expandAllViews**</span><br><code>() =&gt; void</code> |  | LinearComparativeView |
| <span id="action-autoscalelevelheights">**autoScaleLevelHeights**</span><br><code>() =&gt; void</code> |  | LinearComparativeView |
| <span id="action-appendrow">**appendRow**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>({ assembly, loc, syntenyTrackId, }: { assembly: string; loc?:…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>({ assembly, loc, syntenyTrackId, }: { assembly: string; loc?: string &#124; undefined; syntenyTrackId?: string &#124; undefined; }) =&gt; void</code></pre></dialog></span> | Append an assembly to the bottom of the stack and optionally show a synteny track on the new level connecting it to the previous bottom row. A synteny dataset is an edge between two adjacent assemblies, so rows are only ever added at the chain's end.<br><br>The new row is created with a LinearGenomeView `init` — its own afterAttach autorun loads the assembly regions and navigates (whole genome, or `loc` when given), so we don't reimplement that imperatively here. | LinearComparativeView |
| <span id="action-setdisplayname">**setDisplayName**</span><br><code>(name: string) =&gt; void</code> |  | [BaseViewModel](../baseviewmodel#action-setdisplayname) |
| <span id="action-setminimized">**setMinimized**</span><br><code>(flag: boolean) =&gt; void</code> |  | [BaseViewModel](../baseviewmodel#action-setminimized) |
