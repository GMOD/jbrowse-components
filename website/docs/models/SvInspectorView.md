---
id: svinspectorview
title: SvInspectorView
description: "Shows a file of structural variants as a table beside a circular view that draws them as chords. The model holds a SpreadsheetView and a CircularView side by side, without extending either."
sidebar_label: View -> SvInspectorView
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source. See the [developer guide](/docs/developer_guide/) for concepts. Provided by the `sv-inspector` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sv-inspector/src/SvInspectorView/model.ts).

Shows a file of structural variants as a table beside a circular view that
draws them as chords. The model holds a
[SpreadsheetView](../spreadsheetview) and a
[CircularView](../circularview) side by side, without extending either.

## Example usage

```js
{
  type: 'SvInspectorView',
  assembly: 'hg38',
  uri: 'https://example.com/sv.vcf.gz',
  fileType: 'VCF',
}
```

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-type">**type**</span><br><code>"SvInspectorView"</code> | Always `"SvInspectorView"`, the name a snapshot selects this model by. |
| <span id="property-height">**height**</span><br><code>number</code> · default <code>500</code> | height of the whole view in pixels |
| <span id="property-onlydisplayrelevantregionsincircularview">**onlyDisplayRelevantRegionsInCircularView**</span><br><code>boolean</code> · default <code>false</code> | draw only the chromosomes the visible rows touch |
| <span id="property-spreadsheetwidthfraction">**spreadsheetWidthFraction**</span><br><code>number</code> · default <code>0.66</code> | share of the view's width given to the spreadsheet |
| <span id="property-spreadsheetview">**spreadsheetView**</span><br><code><a href="../spreadsheetview">SpreadsheetView</a></code> · default <span class="cell-more"><button type="button" class="cell-more-trigger"><code>SpreadsheetModel.create({ type: 'SpreadsheetView', … })</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>SpreadsheetModel.create({ type: 'SpreadsheetView', hideVerticalResizeHandle: true })</code></pre></dialog></span> |  |
| <span id="property-circularview">**circularView**</span><br><code><a href="../circularview">CircularView</a></code> · default <span class="cell-more"><button type="button" class="cell-more-trigger"><code>CircularModel.create({ type: 'CircularView', … })</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>CircularModel.create({ type: 'CircularView', hideVerticalResizeHandle: true, disableImportForm: true })</code></pre></dialog></span> |  |
| <span id="property-launch">**launch**</span><br><code>LaunchInput&lt;SvInspectorViewCommands&gt; &#124; undefined</code> | transient launch keys, forwarded to the sheet on attach and cleared; author them directly on the view |

<details class="inherited-members" data-pagefind-ignore>
<summary>3 inherited properties from one model</summary>

From [BaseViewModel](../baseviewmodel): <span id="property-id">[`id`](../baseviewmodel#property-id)</span>, <span id="property-displayname">[`displayName`](../baseviewmodel#property-displayname)</span>, <span id="property-minimized">[`minimized`](../baseviewmodel#property-minimized)</span>

</details>

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-spreadsheetviewreactcomponent">**SpreadsheetViewReactComponent**</span><br><code>ViewComponentType</code> |  |
| <span id="volatile-circularviewreactcomponent">**CircularViewReactComponent**</span><br><code>ViewComponentType</code> |  |

<details class="inherited-members" data-pagefind-ignore>
<summary>3 inherited volatiles from one model</summary>

From [BaseViewModel](../baseviewmodel): <span id="volatile-width">[`width`](../baseviewmodel#volatile-width)</span>, <span id="volatile-problems">[`problems`](../baseviewmodel#volatile-problems)</span>, <span id="volatile-bodymounted">[`bodyMounted`](../baseviewmodel#volatile-bodymounted)</span>

</details>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-pendinglaunch">**pendingLaunch**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>LaunchInput&lt;SvInspectorViewCommands &amp; {…}&gt; &#124; undefined</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>LaunchInput&lt;SvInspectorViewCommands &amp; { unknown?: Record&lt;string, unknown&gt;; malformed?: Record&lt;string, unknown&gt;; legacyInit?: boolean; }&gt; &#124; undefined</code></pre></dialog></span> |  |
| <span id="getter-currentassembly">**currentAssembly**</span><br><code><a href="../assembly">Assembly</a> &#124; undefined</code> |  |
| <span id="getter-assemblyname">**assemblyName**</span><br><code>string &#124; undefined</code> |  |
| <span id="getter-showcircularview">**showCircularView**</span><br><code>boolean</code> | false while the sheet shows its import form |
| <span id="getter-showloading">**showLoading**</span><br><code>boolean</code> | both halves' loading state; the circle counts only while shown |
| <span id="getter-ownviews">**ownViews**</span><br><code>(<a href="../spreadsheetview">SpreadsheetView</a> &#124; <a href="../circularview">CircularView</a>)[]</code> | an unshown circle never initializes, so it would read as loading forever |
| <span id="getter-features">**features**</span><br><code>SimpleFeatureSerialized[]</code> | the records of the rows the sheet's filters leave |
| <span id="getter-allfeatures">**allFeatures**</span><br><code>SimpleFeatureSerialized[]</code> | every record of the sheet, which the chord track holds; filters narrow it through visibleChordIds rather than rebuilding the track |
| <span id="getter-visiblechordids">**visibleChordIds**</span><br><code>string[] &#124; undefined</code> | undefined while no filter narrows the sheet |
| <span id="getter-canonicalfeaturerefnameset">**canonicalFeatureRefNameSet**</span><br><code>Set&lt;string&gt;</code> | every canonical refName the visible features' chords end on, both ends included |
| <span id="getter-circulardisplayedregions">**circularDisplayedRegions**</span><br><code>BasicRegion[] &#124; undefined</code> | the assembly's whole genome (`Assembly.wholeGenomeRegions`), or the regions any feature names when narrowed to those, which may include a contig the whole genome leaves out. Never narrowed to nothing, which would draw an empty circle |
| <span id="getter-effectivespreadsheetwidthfraction">**effectiveSpreadsheetWidthFraction**</span><br><code>number</code> |  |
| <span id="getter-subviewwidths">**subviewWidths**</span><br><code>{ spreadsheet: number; circular: number; }</code> |  |
| <span id="getter-highlightedchordids">**highlightedChordIds**</span><br><code>string[] &#124; undefined</code> | the records of the selected record's event, which the circle keeps at full strength while it dims the rest |
| <span id="getter-varianttrackid">**variantTrackId**</span><br><code>string</code> |  |
| <span id="getter-chorddisplay">**chordDisplay**</span><br><code>(DisplayModel &amp; InspectorChordDisplay) &#124; undefined</code> | the display drawing the sheet's rows as chords, once its track is open |
| <span id="getter-chordscolorbysvtype">**chordsColorBySvType**</span><br><code>boolean</code> | false while the chords color by something else, when the legend's swatches would name colors the circle does not draw |
| <span id="getter-drawnsvtypes">**drawnSvTypes**</span><br><code>Set&lt;string&gt; &#124; undefined</code> | the SV classes a chord paints at this zoom, which leaves out a class whose records all end under a pixel apart; undefined until the chords have drawn |
| <span id="getter-svtypelegend">**svTypeLegend**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ type: string; label: string; count: number &#124; undefined; … }[]</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ type: string; label: string; count: number &#124; undefined; swatch: "filled" &#124; "hollow" &#124; undefined; }[]</code></pre></dialog></span> | the legend's rows, one per SV class in the sheet. `count` is the class's rows on screen, undefined for a class the type filter leaves out; `swatch` is undefined while the chords do not color by SV type, and `hollow` for a shown class the drawn circle has no chord of |
| <span id="getter-featurescirculartrackconfiguration">**featuresCircularTrackConfiguration**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ type: string; trackId: string; name: string; … } &#124; undefined</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ type: string; trackId: string; name: string; adapter: { type: string; features: SimpleFeatureSerialized[]; } &amp; { adapterId: string; }; assemblyNames: string[]; displays: { type: string; displayId: string; onChordClick: string; forceLoad: boolean; encoding: { color: { field: string; }; opacity: number; }; }[]; } &#124; undefined</code></pre></dialog></span> |  |

<details class="inherited-members" data-pagefind-ignore>
<summary>3 inherited getters from one model</summary>

From [BaseViewModel](../baseviewmodel): <span id="getter-rendersdisplays">[`rendersDisplays`](../baseviewmodel#getter-rendersdisplays)</span>, <span id="getter-effectivebodymounted">[`effectiveBodyMounted`](../baseviewmodel#getter-effectivebodymounted)</span>, <span id="getter-owntracks">[`ownTracks`](../baseviewmodel#getter-owntracks)</span>

</details>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-menuitems">**menuItems**</span><br><code>() =&gt; MenuItem[]</code> | the sheet's own items |
| <span id="method-circularviewmenuitems">**circularViewMenuItems**</span><br><code>() =&gt; MenuItem[]</code> | the circular pane's own menu: the inspector's setting for it, then the circular view's items |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setheight">**setHeight**</span><br><code>(newHeight: number) =&gt; number</code> |  |
| <span id="action-setonlydisplayrelevantregionsincircularview">**setOnlyDisplayRelevantRegionsInCircularView**</span><br><code>(val: boolean) =&gt; void</code> |  |
| <span id="action-resizespreadsheetwidth">**resizeSpreadsheetWidth**</span><br><code>(distance: number) =&gt; void</code> | accumulates onto the fraction, not the rounded spreadsheetView.width, so the divider doesn't creep a pixel per drag frame |
| <span id="action-setlaunch">**setLaunch**</span><br><code>(launch?: LaunchInput&lt;SvInspectorViewCommands&gt;) =&gt; void</code> |  |
| <span id="action-resizeheight">**resizeHeight**</span><br><code>(distance: number) =&gt; number</code> |  |

<details class="inherited-members" data-pagefind-ignore>
<summary>5 inherited actions from one model</summary>

From [BaseViewModel](../baseviewmodel): <span id="action-addproblem">[`addProblem`](../baseviewmodel#action-addproblem)</span>, <span id="action-setdisplayname">[`setDisplayName`](../baseviewmodel#action-setdisplayname)</span>, <span id="action-setwidth">[`setWidth`](../baseviewmodel#action-setwidth)</span>, <span id="action-setbodymounted">[`setBodyMounted`](../baseviewmodel#action-setbodymounted)</span>, <span id="action-setminimized">[`setMinimized`](../baseviewmodel#action-setminimized)</span>

</details>
