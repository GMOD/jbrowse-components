---
id: linearsyntenyview
title: LinearSyntenyView
sidebar_label: View -> LinearSyntenyView
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`linear-comparative-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearSyntenyView/model.ts).

## Example usage

Hand-authored under `defaultSession.views`. `init.views` declares the two member
assemblies (stacked as linear views) and `tracks` the synteny feature track
connecting them with a ribbon:

```js
{
  type: 'LinearSyntenyView',
  init: {
    views: [{ assembly: 'hg38' }, { assembly: 'mm10' }],
    tracks: ['hg38_vs_mm10.paf'],
    drawCurves: true,
  },
}
```

Other `init` fields: `colorBy`, `levelHeights`, `alpha`, `minAlignmentLength`,
`autoDiagonalize` — see the `init` property below.

Members a composed model contributes are listed here too, so these tables are
the whole surface.

## Properties

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal('LinearSyntenyView')</code> |  | LinearSyntenyView |
| <span id="property-cigarmode">**cigarMode**</span><br><details><summary><code>cigarMode: types.stripDefault( types.enumeration(['off', 'match…</code></summary><pre><code>cigarMode: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.enumeration(['off', 'matches', 'full'] as const),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;'full',&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></details> |  | LinearSyntenyView |
| <span id="property-drawcurves">**drawCurves**</span><br><code>drawCurves: types.stripDefault(types.boolean, false)</code> |  | LinearSyntenyView |
| <span id="property-drawlocationmarkers">**drawLocationMarkers**</span><br><code>drawLocationMarkers: types.stripDefault(types.boolean, false)</code> |  | LinearSyntenyView |
| <span id="property-overdrawpx">**overdrawPx**</span><br><details><summary><code>overdrawPx: types.stripDefault(types.number, DEFAULT_OVERDRAW_P…</code></summary><pre><code>overdrawPx: types.stripDefault(types.number, DEFAULT_OVERDRAW_PX)</code></pre></details> | pixels beyond the visible viewport edge that synteny lines are still drawn | LinearSyntenyView |
| <span id="property-alpha">**alpha**</span><br><code>alpha: types.stripDefault(types.number, 0.2)</code> |  | LinearSyntenyView |
| <span id="property-minalignmentlength">**minAlignmentLength**</span><br><code>minAlignmentLength: types.stripDefault(types.number, 0)</code> | Hide alignment blocks shorter than this many bp. Enforced per-feature by its own span in buildSyntenyGeometry, then culled in the shader (isCulled) and pick engine. Cuts whole-genome hairball noise. | LinearSyntenyView |
| <span id="property-lodmode">**lodMode**</span><br><details><summary><code>lodMode: types.stripDefault( types.enumeration('LodMode', ['aut…</code></summary><pre><code>lodMode: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.enumeration('LodMode', ['auto', 'fine', 'coarse']),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;'auto',&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></details> | Level-of-detail tier selection for PIF adapters. 'auto' uses the adapter's bpPerPx threshold; 'fine' forces the per-row CIGAR tier (t/q); 'coarse' forces the no-CIGAR tier (T/Q) when present. | LinearSyntenyView |
| <span id="property-colorby">**colorBy**</span><br><code>colorBy: types.stripDefault(types.string, 'default')</code> |  | LinearSyntenyView |
| <span id="property-showcolorlegend">**showColorLegend**</span><br><code>showColorLegend: types.stripDefault(types.boolean, false)</code> | Show the floating color-by legend in the top-right of the synteny canvas. Dismissible via the legend's close button; re-enable from the color-by (palette) menu. | LinearSyntenyView |
| <span id="property-opacitybyidentity">**opacityByIdentity**</span><br><code>opacityByIdentity: types.stripDefault(types.boolean, false)</code> | Fade alignment blocks by per-feature identity (lower identity = more transparent). Orthogonal to colorBy — surfaces identity-dropoff zones without consuming the color channel. | LinearSyntenyView |
| <span id="property-fadethinalignmentsmode">**fadeThinAlignmentsMode**</span><br><details><summary><code>fadeThinAlignmentsMode: types.stripDefault( types.enumeration('…</code></summary><pre><code>fadeThinAlignmentsMode: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.enumeration('FadeThinMode', ['auto', 'on', 'off']),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;'auto',&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></details> | Whether to fade a sub-pixel-thin ribbon's opacity by its on-screen width (see WIDTH_FADE_FLOOR in syntenyTypes.slang), so an unfiltered whole-genome view doesn't read as a hard full-opacity hairball. 'auto' enables the fade once a display is dominated by sub-pixel ribbons (see LinearSyntenyDisplay.autoFadeThinAlignments); a genuinely sparse comparison (only a handful of ribbons) keeps full alpha so the fade doesn't wash it out. 'on'/'off' pin it. Resolved view-wide by the `fadeThinAlignments` getter, so all levels fade together. | LinearSyntenyView |
| <span id="property-init">**init**</span><br><code>init: types.frozen&lt;LinearSyntenyViewInit &#124; undefined&gt;()</code> | used for initializing the view from a session snapshot. tracks is 2D — outer index is the level (the gap between views[i] and views[i+1]), so a 3-way view has two entries. example: ```json { views: [ { loc: "chr1:1-100", assembly: "hg38", tracks: ["genes"] }, { loc: "chr1:1-100", assembly: "mm39" }, { loc: "chr1:1-100", assembly: "rn7" } ], tracks: [["hg38_vs_mm39_synteny"], ["mm39_vs_rn7_synteny"]] } ``` | LinearSyntenyView |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  | [LinearComparativeView](../linearcomparativeview#property-id) |
| <span id="property-trackselectortype">**trackSelectorType**</span><br><details><summary><code>trackSelectorType: types.stripDefault(types.string, 'hierarchic…</code></summary><pre><code>trackSelectorType: types.stripDefault(types.string, 'hierarchical')</code></pre></details> | <span data-pagefind-ignore>vestigial: the hierarchical selector is the only one that exists, so this value is ignored. Retained because saved sessions and configs persist it.</span> | [LinearComparativeView](../linearcomparativeview#property-trackselectortype) |
| <span id="property-showintraviewlinks">**showIntraviewLinks**</span><br><code>showIntraviewLinks: types.stripDefault(types.boolean, true)</code> |  | [LinearComparativeView](../linearcomparativeview#property-showintraviewlinks) |
| <span id="property-linkviews">**linkViews**</span><br><code>linkViews: types.stripDefault(types.boolean, false)</code> |  | [LinearComparativeView](../linearcomparativeview#property-linkviews) |
| <span id="property-levels">**levels**</span><br><code>levels: types.array(LinearSyntenyViewHelper)</code> |  | [LinearComparativeView](../linearcomparativeview#property-levels) |
| <span id="property-views">**views**</span><br><details><summary><code>views: types.array( pluginManager.getViewType('LinearGenomeView…</code></summary><pre><code>views: types.array(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.getViewType('LinearGenomeView')&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;.stateModel as LinearGenomeViewStateModel,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></details> | <span data-pagefind-ignore>N genome rows, with N-1 synteny `levels` between adjacent pairs. The views/levels invariant is maintained by reconcileLevels().</span> | [LinearComparativeView](../linearcomparativeview#property-views) |
| <span id="property-viewtrackconfigs">**viewTrackConfigs**</span><br><details><summary><code>viewTrackConfigs: types.stripDefault( types.array(pluginManager…</code></summary><pre><code>viewTrackConfigs: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.array(pluginManager.pluggableConfigSchemaType('track')),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;[],&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></details> | <span data-pagefind-ignore>this represents tracks specific to this view specifically used for read vs ref dotplots where this track would not really apply elsewhere</span> | [LinearComparativeView](../linearcomparativeview#property-viewtrackconfigs) |
| <span id="property-displayname">**displayName**</span><br><code>displayName: types.maybe(types.string)</code> | <span data-pagefind-ignore>displayName is displayed in the header of the view, or assembly names being used if none is specified</span> | [BaseViewModel](../baseviewmodel#property-displayname) |
| <span id="property-minimized">**minimized**</span><br><code>minimized: types.stripDefault(types.boolean, false)</code> |  | [BaseViewModel](../baseviewmodel#property-minimized) |

## Volatiles

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="volatile-importformsyntenytrackselections">**importFormSyntenyTrackSelections**</span><br><details><summary><code>importFormSyntenyTrackSelections: observable.array&lt;ImportFormSy…</code></summary><pre><code>importFormSyntenyTrackSelections:&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;observable.array&lt;ImportFormSyntenyTrack&gt;()</code></pre></details> |  | LinearSyntenyView |
| <span id="volatile-width">**width**</span><br><code>width: undefined as number &#124; undefined</code> |  | [LinearComparativeView](../linearcomparativeview#volatile-width) |
| <span id="volatile-volatileerror">**volatileError**</span><br><code>volatileError: undefined as unknown</code> | <span data-pagefind-ignore>View-level failure (e.g. an `init` block that couldn't be applied). Volatile on purpose: a reload re-runs the init autorun from a clean slate, so a transient failure stays recoverable.</span> | [LinearComparativeView](../linearcomparativeview#volatile-volatileerror) |
| <span id="volatile-awaitingautodiagonalize">**awaitingAutoDiagonalize**</span><br><code>awaitingAutoDiagonalize: false</code> | <span data-pagefind-ignore>True while the init autorun is waiting on the diagonalize RPC. Gates the canvas off — otherwise the user watches an undiagonalized hairball flash before the reorder kicks in.</span> | [DiagonalizeProgressMixin](../diagonalizeprogressmixin#volatile-awaitingautodiagonalize) |
| <span id="volatile-autodiagonalizerequested">**autoDiagonalizeRequested**</span><br><code>autoDiagonalizeRequested: false</code> | <span data-pagefind-ignore>Set true as soon as an init-time autoDiagonalize is requested, before any render can paint. Gates `diagonalizeSettled` so a capture can't commit the pre-reorder view during the view-building await window, before `awaitingAutoDiagonalize` flips.</span> | [DiagonalizeProgressMixin](../diagonalizeprogressmixin#volatile-autodiagonalizerequested) |
| <span id="volatile-autodiagonalizecomplete">**autoDiagonalizeComplete**</span><br><code>autoDiagonalizeComplete: false</code> | <span data-pagefind-ignore>Set true only after the init-time diagonalize pass RESOLVES successfully. If the reorder is skipped or throws this stays false, so `diagonalizeSettled` never reports done on an undiagonalized view — the capture fails loudly (times out) instead of committing a hairball.</span> | [DiagonalizeProgressMixin](../diagonalizeprogressmixin#volatile-autodiagonalizecomplete) |
| <span id="volatile-diagonalizestatus">**diagonalizeStatus**</span><br><code>diagonalizeStatus: undefined as RpcStatus &#124; undefined</code> | <span data-pagefind-ignore>Live status from the auto-diagonalize RPC (download %, parse, algorithm phase) shown on the reordering spinner; undefined outside that wait.</span> | [DiagonalizeProgressMixin](../diagonalizeprogressmixin#volatile-diagonalizestatus) |
| <span id="volatile-diagonalizestoptoken">**diagonalizeStopToken**</span><br><code>diagonalizeStopToken: undefined as StopToken &#124; undefined</code> | <span data-pagefind-ignore>Stop token for the in-flight auto-diagonalize, so the spinner's Cancel can abort it; undefined when none is running.</span> | [DiagonalizeProgressMixin](../diagonalizeprogressmixin#volatile-diagonalizestoptoken) |

## Getters

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="getter-hassomethingtoshow">**hasSomethingToShow**</span><br><code>boolean</code> |  | LinearSyntenyView |
| <span id="getter-showassemblynameinsubviewscalebar">**showAssemblyNameInSubviewScalebar**</span><br><code>boolean</code> | Opt each sub-view's scalebar into prefixing its refName labels with the assembly name (e.g. "hg38:chr1"), so stacked genome rows of different assemblies stay distinguishable. Read duck-typed by the child LinearGenomeView (scalebarDisplayPrefix) to avoid an upward plugin dependency. | LinearSyntenyView |
| <span id="getter-drawcigar">**drawCIGAR**</span><br><code>boolean</code> |  | LinearSyntenyView |
| <span id="getter-drawcigarmatchesonly">**drawCIGARMatchesOnly**</span><br><code>boolean</code> |  | LinearSyntenyView |
| <span id="getter-haslodcapableadapter">**hasLodCapableAdapter**</span><br><code>boolean</code> | True if any track on any level has an adapter with tiered storage. Used to gate the LOD menu — PAFAdapter, BlastTabularAdapter and friends have nothing to switch between. | LinearSyntenyView |
| <span id="getter-hascigardata">**hasCigarData**</span><br><code>boolean</code> | True if any currently-loaded synteny display has at least one feature with a CIGAR. Used to gate CIGAR-related menu items — coarse-tier PIF files and CIGAR-less PAFs have nothing to show. Optimistic while no display has finished a fetch yet, so the menu is there from the first render rather than popping in once data lands (the common case: most synteny files carry CIGARs). A view with no synteny tracks at all has nothing to gate, so it reports false. | LinearSyntenyView |
| <span id="getter-presentcigarkinds">**presentCigarKinds**</span><br><code>number</code> | Union across every loaded synteny display of which CIGAR indel ops are actually drawn on screen. The floating legend lists an indel chip only when a visible-width op of that kind is painted somewhere in the view. | LinearSyntenyView |
| <span id="getter-fadethinalignments">**fadeThinAlignments**</span><br><code>boolean</code> | Resolved fade-thin flag that every display's renderParams reads. In 'auto' mode the fade turns on once ANY loaded synteny display is dominated by sub-pixel ribbons (`autoFadeThinAlignments` — a thin hairball that benefits from decluttering); a sparse view keeps its few ribbons at full alpha. 'on'/'off' pin it.<br><br>Deliberately view-wide rather than per display: stacked levels are read as one picture, so levels resolving the fade independently would paint the same ribbon density differently from row to row. | LinearSyntenyView |
| <span id="getter-anchorassemblyname">**anchorAssemblyName**</span><br><code>string &#124; undefined</code> | The "anchor" assembly for colorBy:'reference': the assembly bordering the most synteny levels. In a stacked ref-vs-A / ref-vs-B layout each interior assembly touches two levels and the ends touch one, so the max-adjacency assembly is the shared reference. Ties resolve to the topmost. Every level then colors by this assembly's chromosome names, so a region keeps its color as it's traced across levels. | LinearSyntenyView |
| <span id="getter-showloading">**showLoading**</span><br><code>boolean</code> | Whether to show a loading indicator instead of the import form or view | LinearSyntenyView |
| <span id="getter-loadingmessage">**loadingMessage**</span><br><code>"Loading" &#124; undefined</code> | Label for the generic loading spinner. The auto-diagonalize wait is a separate render branch (DiagonalizeLoadingScreen), so this only covers the plain "view not ready" case. | LinearSyntenyView |
| <span id="getter-showimportform">**showImportForm**</span><br><code>boolean</code> | Whether to show the import form. A failed `init` counts: `init` is kept so a reload can retry it, but in this session there is nothing to show and no second attempt coming, so the form (with the error banner) is the only way forward — matching LGV/dotplot/circular, which also fall back to the form on error rather than spinning. | LinearSyntenyView |
| <span id="getter-scrollzoom">**scrollZoom**</span><br><code>boolean</code> | <span data-pagefind-ignore>scroll-to-zoom is a global, personal preference resolved from the session; toggling it in any view applies everywhere</span> | [LinearComparativeView](../linearcomparativeview#getter-scrollzoom) |
| <span id="getter-initialized">**initialized**</span><br><code>boolean</code> |  | [LinearComparativeView](../linearcomparativeview#getter-initialized) |
| <span id="getter-error">**error**</span><br><code>unknown</code> |  | [LinearComparativeView](../linearcomparativeview#getter-error) |
| <span id="getter-assemblynames">**assemblyNames**</span><br><code>string[]</code> |  | [LinearComparativeView](../linearcomparativeview#getter-assemblynames) |
| <span id="getter-allsyntenydisplays">**allSyntenyDisplays**</span><br><code>any[]</code> | <span data-pagefind-ignore>Every synteny display across every level, flattened. One memoized getter for the view-wide aggregates that would otherwise each re-flatten the levels.</span> | [LinearComparativeView](../linearcomparativeview#getter-allsyntenydisplays) |
| <span id="getter-syntenywarnings">**syntenyWarnings**</span><br><code>SyntenyWarning[]</code> | <span data-pagefind-ignore>Data-quality warnings raised by every synteny display, e.g. a reversed assembly row order. Surfaced by the header's warning button and its dialog, which both read this rather than re-deriving it.</span> | [LinearComparativeView](../linearcomparativeview#getter-syntenywarnings) |
| <span id="getter-diagonalizesettled">**diagonalizeSettled**</span><br><code>boolean</code> | <span data-pagefind-ignore>The diagonalize half of a view's `settled` gate: either no reorder was requested, or the one that was has completed.</span> | [DiagonalizeProgressMixin](../diagonalizeprogressmixin#getter-diagonalizesettled) |

## Methods

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="method-showmenuitems">**showMenuItems**</span><br><details><summary><code>() =&gt; (MenuDivider &#124; MenuSubHeader &#124; NormalMenuItem &#124; CheckboxM…</code></summary><pre><code>() =&gt; (MenuDivider &#124; MenuSubHeader &#124; NormalMenuItem &#124; CheckboxMenuItem &#124; RadioMenuItem &#124; SubMenuItem &#124; CustomMenuItem &#124; { ...; })[]</code></pre></details> |  | LinearSyntenyView |
| <span id="method-headermenuitems">**headerMenuItems**</span><br><details><summary><code>() =&gt; (MenuDivider &#124; MenuSubHeader &#124; NormalMenuItem &#124; CheckboxM…</code></summary><pre><code>() =&gt; (MenuDivider &#124; MenuSubHeader &#124; NormalMenuItem &#124; CheckboxMenuItem &#124; RadioMenuItem &#124; SubMenuItem &#124; CustomMenuItem &#124; { ...; } &#124; { ...; })[]</code></pre></details> | includes a subset of view menu options because the full list is a little overwhelming | LinearSyntenyView |
| <span id="method-menuitems">**menuItems**</span><br><details><summary><code>() =&gt; (MenuDivider &#124; MenuSubHeader &#124; NormalMenuItem &#124; CheckboxM…</code></summary><pre><code>() =&gt; (MenuDivider &#124; MenuSubHeader &#124; NormalMenuItem &#124; CheckboxMenuItem &#124; RadioMenuItem &#124; SubMenuItem &#124; CustomMenuItem &#124; { ...; })[]</code></pre></details> |  | LinearSyntenyView |
| <span id="method-isviewcompact">**isViewCompact**</span><br><code>(idx: number) =&gt; boolean</code> |  | [LinearComparativeView](../linearcomparativeview#method-isviewcompact) |
| <span id="method-rubberbandmenuitems">**rubberBandMenuItems**</span><br><code>() =&gt; { label: string; onClick: () =&gt; void; }[]</code> |  | [LinearComparativeView](../linearcomparativeview#method-rubberbandmenuitems) |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-importformremoverow">**importFormRemoveRow**</span><br><code>(pairIdx: number) =&gt; void</code> | Remove the pair-selection at the given index — the pair that vanishes when an assembly row is removed. The caller computes which pair index that is, since the row-to-pair mapping lives with the React-side assembly list. | LinearSyntenyView |
| <span id="action-clearimportformsyntenytracks">**clearImportFormSyntenyTracks**</span><br><code>() =&gt; void</code> |  | LinearSyntenyView |
| <span id="action-setimportformsyntenytrack">**setImportFormSyntenyTrack**</span><br><code>(arg: number, val: ImportFormSyntenyTrack) =&gt; void</code> |  | LinearSyntenyView |
| <span id="action-setdrawcurves">**setDrawCurves**</span><br><code>(arg: boolean) =&gt; void</code> |  | LinearSyntenyView |
| <span id="action-setcigarmode">**setCigarMode**</span><br><code>(arg: CigarMode) =&gt; void</code> |  | LinearSyntenyView |
| <span id="action-setdrawlocationmarkers">**setDrawLocationMarkers**</span><br><code>(arg: boolean) =&gt; void</code> |  | LinearSyntenyView |
| <span id="action-setoverdrawpx">**setOverdrawPx**</span><br><code>(arg: number) =&gt; void</code> |  | LinearSyntenyView |
| <span id="action-setalpha">**setAlpha**</span><br><code>(arg: number) =&gt; void</code> |  | LinearSyntenyView |
| <span id="action-setminalignmentlength">**setMinAlignmentLength**</span><br><code>(arg: number) =&gt; void</code> |  | LinearSyntenyView |
| <span id="action-setlodmode">**setLodMode**</span><br><code>(arg: LodMode) =&gt; void</code> |  | LinearSyntenyView |
| <span id="action-setcolorby">**setColorBy**</span><br><details><summary><code>(arg: "default" &#124; "strand" &#124; "query" &#124; "target" &#124; "reference" &#124;…</code></summary><pre><code>(arg: "default" &#124; "strand" &#124; "query" &#124; "target" &#124; "reference" &#124; "identity" &#124; "meanQueryIdentity" &#124; "mappingQuality") =&gt; void</code></pre></details> |  | LinearSyntenyView |
| <span id="action-setshowcolorlegend">**setShowColorLegend**</span><br><code>(arg: boolean) =&gt; void</code> |  | LinearSyntenyView |
| <span id="action-setopacitybyidentity">**setOpacityByIdentity**</span><br><code>(arg: boolean) =&gt; void</code> |  | LinearSyntenyView |
| <span id="action-setfadethinalignmentsmode">**setFadeThinAlignmentsMode**</span><br><code>(arg: FadeThinMode) =&gt; void</code> |  | LinearSyntenyView |
| <span id="action-showallregions">**showAllRegions**</span><br><code>() =&gt; void</code> |  | LinearSyntenyView |
| <span id="action-setinit">**setInit**</span><br><code>(init?: LinearSyntenyViewInit &#124; undefined) =&gt; void</code> |  | LinearSyntenyView |
| <span id="action-clearview">**clearView**</span><br><code>() =&gt; void</code> | Also drops `init`, which `hasSomethingToShow` keys off while views is empty — leaving it set would bounce "return to import form" straight back to the loading spinner. | LinearSyntenyView |
| <span id="action-exportsvg">**exportSvg**</span><br><code>(opts: ExportSvgOptions) =&gt; Promise&lt;void&gt;</code> |  | LinearSyntenyView |
| <span id="action-reconcilelevels">**reconcileLevels**</span><br><code>() =&gt; void</code> | <span data-pagefind-ignore>Reconcile the levels array to the views array: exactly one synteny level per gap between adjacent views (N views -> N-1 levels). Grows or shrinks from the end, preserving existing levels and their tracks. The single source of truth for the views/levels invariant.</span> | [LinearComparativeView](../linearcomparativeview#action-reconcilelevels) |
| <span id="action-setwidth">**setWidth**</span><br><code>(newWidth: number) =&gt; void</code> |  | [LinearComparativeView](../linearcomparativeview#action-setwidth) |
| <span id="action-seterror">**setError**</span><br><code>(e: unknown) =&gt; void</code> |  | [LinearComparativeView](../linearcomparativeview#action-seterror) |
| <span id="action-setviews">**setViews**</span><br><details><summary><code>(views: ModelCreationType&lt;ExtractCFromProps&lt;_OverrideProps&lt;_Ove…</code></summary><pre><code>(views: ModelCreationType&lt;ExtractCFromProps&lt;_OverrideProps&lt;_OverrideProps&lt;…&gt;, { ...; }&gt;&gt;&gt;[]) =&gt; void</code></pre></details> |  | [LinearComparativeView](../linearcomparativeview#action-setviews) |
| <span id="action-addview">**addView**</span><br><details><summary><code>(view: ModelCreationType&lt;ExtractCFromProps&lt;_OverrideProps&lt;_Over…</code></summary><pre><code>(view: ModelCreationType&lt;ExtractCFromProps&lt;_OverrideProps&lt;_OverrideProps&lt;…&gt;, { ...; }&gt;&gt;&gt;) =&gt; void</code></pre></details> | <span data-pagefind-ignore>Push a new genome row. The new trailing level starts with no synteny tracks.</span> | [LinearComparativeView](../linearcomparativeview#action-addview) |
| <span id="action-removelastrow">**removeLastRow**</span><br><code>() =&gt; void</code> | <span data-pagefind-ignore>Drop the bottom genome row and its synteny level. Only terminal removal is supported: a level's `level` index addresses views[level]/[level+1], so removing a middle row would require reindexing every level below it. Growth and shrinkage both happen at the end of the chain.</span> | [LinearComparativeView](../linearcomparativeview#action-removelastrow) |
| <span id="action-setlinkviews">**setLinkViews**</span><br><code>(arg: boolean) =&gt; void</code> |  | [LinearComparativeView](../linearcomparativeview#action-setlinkviews) |
| <span id="action-setscrollzoom">**setScrollZoom**</span><br><code>(arg: boolean) =&gt; void</code> |  | [LinearComparativeView](../linearcomparativeview#action-setscrollzoom) |
| <span id="action-activatetrackselector">**activateTrackSelector**</span><br><code>(level: number) =&gt; Widget</code> |  | [LinearComparativeView](../linearcomparativeview#action-activatetrackselector) |
| <span id="action-toggletrack">**toggleTrack**</span><br><code>(trackId: string, level?: any) =&gt; any</code> |  | [LinearComparativeView](../linearcomparativeview#action-toggletrack) |
| <span id="action-showtrack">**showTrack**</span><br><code>(trackId: string, level?: any, initialSnapshot?: any) =&gt; void</code> | <span data-pagefind-ignore>No-op for a level that doesn't exist, matching hideTrack/toggleTrack. reconcileLevels already materializes exactly one level per adjacent view pair, so a missing level means the caller named a gap that has no views (e.g. an `init.tracks` with more levels than `init.views` has gaps); creating one here would append a level whose views[level+1] is absent, which renders nothing and silently breaks the views/levels invariant.</span> | [LinearComparativeView](../linearcomparativeview#action-showtrack) |
| <span id="action-hidetrack">**hideTrack**</span><br><code>(trackId: string, level?: any) =&gt; void</code> |  | [LinearComparativeView](../linearcomparativeview#action-hidetrack) |
| <span id="action-squareview">**squareView**</span><br><code>() =&gt; void</code> |  | [LinearComparativeView](../linearcomparativeview#action-squareview) |
| <span id="action-togglecompactview">**toggleCompactView**</span><br><code>(idx: number) =&gt; void</code> |  | [LinearComparativeView](../linearcomparativeview#action-togglecompactview) |
| <span id="action-compactallviews">**compactAllViews**</span><br><code>() =&gt; void</code> |  | [LinearComparativeView](../linearcomparativeview#action-compactallviews) |
| <span id="action-expandallviews">**expandAllViews**</span><br><code>() =&gt; void</code> |  | [LinearComparativeView](../linearcomparativeview#action-expandallviews) |
| <span id="action-autoscalelevelheights">**autoScaleLevelHeights**</span><br><code>() =&gt; void</code> |  | [LinearComparativeView](../linearcomparativeview#action-autoscalelevelheights) |
| <span id="action-appendrow">**appendRow**</span><br><details><summary><code>({ assembly, loc, syntenyTrackId, }: { assembly: string; loc?:…</code></summary><pre><code>({ assembly, loc, syntenyTrackId, }: { assembly: string; loc?: string &#124; undefined; syntenyTrackId?: string &#124; undefined; }) =&gt; void</code></pre></details> | <span data-pagefind-ignore>Append an assembly to the bottom of the stack and optionally show a synteny track on the new level connecting it to the previous bottom row. A synteny dataset is an edge between two adjacent assemblies, so rows are only ever added at the chain's end.<br><br>The new row is created with a LinearGenomeView `init` — its own afterAttach autorun loads the assembly regions and navigates (whole genome, or `loc` when given), so we don't reimplement that imperatively here.</span> | [LinearComparativeView](../linearcomparativeview#action-appendrow) |
| <span id="action-setdisplayname">**setDisplayName**</span><br><code>(name: string) =&gt; void</code> |  | [BaseViewModel](../baseviewmodel#action-setdisplayname) |
| <span id="action-setminimized">**setMinimized**</span><br><code>(flag: boolean) =&gt; void</code> |  | [BaseViewModel](../baseviewmodel#action-setminimized) |
| <span id="action-setawaitingautodiagonalize">**setAwaitingAutoDiagonalize**</span><br><code>(arg: boolean) =&gt; void</code> |  | [DiagonalizeProgressMixin](../diagonalizeprogressmixin#action-setawaitingautodiagonalize) |
| <span id="action-setautodiagonalizerequested">**setAutoDiagonalizeRequested**</span><br><code>(arg: boolean) =&gt; void</code> |  | [DiagonalizeProgressMixin](../diagonalizeprogressmixin#action-setautodiagonalizerequested) |
| <span id="action-setautodiagonalizecomplete">**setAutoDiagonalizeComplete**</span><br><code>(arg: boolean) =&gt; void</code> |  | [DiagonalizeProgressMixin](../diagonalizeprogressmixin#action-setautodiagonalizecomplete) |
| <span id="action-setdiagonalizestatus">**setDiagonalizeStatus**</span><br><code>(arg?: RpcStatus &#124; undefined) =&gt; void</code> |  | [DiagonalizeProgressMixin](../diagonalizeprogressmixin#action-setdiagonalizestatus) |
| <span id="action-setdiagonalizestoptoken">**setDiagonalizeStopToken**</span><br><code>(arg?: StopToken &#124; undefined) =&gt; void</code> |  | [DiagonalizeProgressMixin](../diagonalizeprogressmixin#action-setdiagonalizestoptoken) |
| <span id="action-cancelautodiagonalize">**cancelAutoDiagonalize**</span><br><code>() =&gt; void</code> | <span data-pagefind-ignore>Abort an in-flight auto-diagonalize; `withDiagonalizeProgress`'s finally clears the wait flag, revealing the (undiagonalized) view.</span> | [DiagonalizeProgressMixin](../diagonalizeprogressmixin#action-cancelautodiagonalize) |
