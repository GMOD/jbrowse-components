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
| <span id="property-linkviews">**linkViews**</span><br><code>linkViews: types.stripDefault(types.boolean, false)</code> |  | LinearComparativeView |
| <span id="property-levels">**levels**</span><br><code>levels: types.array(LinearSyntenyViewHelper)</code> |  | LinearComparativeView |
| <span id="property-views">**views**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>views: types.array( pluginManager.getViewType('LinearGenomeView…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>views: types.array(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.getViewType('LinearGenomeView')&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;.stateModel as LinearGenomeViewStateModel,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | N genome rows, with N-1 synteny `levels` between adjacent pairs. The views/levels invariant is maintained by reconcileLevels(). | LinearComparativeView |
| <span id="property-viewtrackconfigs">**viewTrackConfigs**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>viewTrackConfigs: types.stripDefault( types.array(pluginManager…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>viewTrackConfigs: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.array(pluginManager.pluggableConfigSchemaType('track')),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;[],&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | this represents tracks specific to this view specifically used for read vs ref dotplots where this track would not really apply elsewhere | LinearComparativeView |
| <span id="property-displayname">**displayName**</span><br><code>displayName: types.maybe(types.string)</code> | <span data-pagefind-ignore>displayName is displayed in the header of the view, or assembly names being used if none is specified</span> | [BaseViewModel](../baseviewmodel#property-displayname) |
| <span id="property-minimized">**minimized**</span><br><code>minimized: types.stripDefault(types.boolean, false)</code> |  | [BaseViewModel](../baseviewmodel#property-minimized) |

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
| <span id="getter-syntenywarnings">**syntenyWarnings**</span><br><code>SyntenyWarning[]</code> | Data-quality warnings raised by every synteny display, e.g. a reversed assembly row order. Surfaced by the header's warning button and its dialog, which both read this rather than re-deriving it. |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-isviewcompact">**isViewCompact**</span><br><code>(idx: number) =&gt; boolean</code> |  |
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
| <span id="action-setscrollzoom">**setScrollZoom**</span><br><code>(arg: boolean) =&gt; void</code> |  | LinearComparativeView |
| <span id="action-activatetrackselector">**activateTrackSelector**</span><br><code>(level: number) =&gt; Widget</code> |  | LinearComparativeView |
| <span id="action-toggletrack">**toggleTrack**</span><br><code>(trackId: string, level?: any) =&gt; any</code> |  | LinearComparativeView |
| <span id="action-showtrack">**showTrack**</span><br><code>(trackId: string, level?: any, initialSnapshot?: any) =&gt; void</code> | No-op for a level that doesn't exist, matching hideTrack/toggleTrack. reconcileLevels already materializes exactly one level per adjacent view pair, so a missing level means the caller named a gap that has no views (e.g. an `init.tracks` with more levels than `init.views` has gaps); creating one here would append a level whose views[level+1] is absent, which renders nothing and silently breaks the views/levels invariant. | LinearComparativeView |
| <span id="action-hidetrack">**hideTrack**</span><br><code>(trackId: string, level?: any) =&gt; void</code> |  | LinearComparativeView |
| <span id="action-squareview">**squareView**</span><br><code>() =&gt; void</code> |  | LinearComparativeView |
| <span id="action-clearview">**clearView**</span><br><code>() =&gt; void</code> |  | LinearComparativeView |
| <span id="action-togglecompactview">**toggleCompactView**</span><br><code>(idx: number) =&gt; void</code> |  | LinearComparativeView |
| <span id="action-compactallviews">**compactAllViews**</span><br><code>() =&gt; void</code> |  | LinearComparativeView |
| <span id="action-expandallviews">**expandAllViews**</span><br><code>() =&gt; void</code> |  | LinearComparativeView |
| <span id="action-autoscalelevelheights">**autoScaleLevelHeights**</span><br><code>() =&gt; void</code> |  | LinearComparativeView |
| <span id="action-appendrow">**appendRow**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>({ assembly, loc, syntenyTrackId, }: { assembly: string; loc?:…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>({ assembly, loc, syntenyTrackId, }: { assembly: string; loc?: string &#124; undefined; syntenyTrackId?: string &#124; undefined; }) =&gt; void</code></pre></dialog></span> | Append an assembly to the bottom of the stack and optionally show a synteny track on the new level connecting it to the previous bottom row. A synteny dataset is an edge between two adjacent assemblies, so rows are only ever added at the chain's end.<br><br>The new row is created with a LinearGenomeView `init` — its own afterAttach autorun loads the assembly regions and navigates (whole genome, or `loc` when given), so we don't reimplement that imperatively here. | LinearComparativeView |
| <span id="action-setdisplayname">**setDisplayName**</span><br><code>(name: string) =&gt; void</code> |  | [BaseViewModel](../baseviewmodel#action-setdisplayname) |
| <span id="action-setminimized">**setMinimized**</span><br><code>(flag: boolean) =&gt; void</code> |  | [BaseViewModel](../baseviewmodel#action-setminimized) |
