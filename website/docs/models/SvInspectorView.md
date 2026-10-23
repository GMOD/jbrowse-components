---
id: svinspectorview
title: SvInspectorView
description: "Shows a file of structural variants as a table beside a circular view that draws them as chords. The model holds a SpreadsheetView and a CircularView side by side, without extending either."
sidebar_label: View -> SvInspectorView
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `sv-inspector` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sv-inspector/src/SvInspectorView/model.ts).

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
| <span id="property-type">**type**</span><br><code>type: types.literal('SvInspectorView')</code> |  |
| <span id="property-height">**height**</span><br><code>height: types.stripDefault(types.number, defaultHeight)</code> | height of the whole view in pixels |
| <span id="property-onlydisplayrelevantregionsincircularview">**onlyDisplayRelevantRegionsInCircularView**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>onlyDisplayRelevantRegionsInCircularView: types.stripDefault( t…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>onlyDisplayRelevantRegionsInCircularView: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.boolean,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;false,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | draw only the chromosomes the visible rows touch |
| <span id="property-spreadsheetwidthfraction">**spreadsheetWidthFraction**</span><br><code>spreadsheetWidthFraction: types.stripDefault(types.number, 0.66)</code> | share of the view's width given to the spreadsheet |
| <span id="property-spreadsheetview">**spreadsheetView**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>spreadsheetView: types.optional(SpreadsheetModel, () =&gt; Spreads…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>spreadsheetView: types.optional(SpreadsheetModel, () =&gt;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;SpreadsheetModel.create({&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;type: 'SpreadsheetView',&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;hideVerticalResizeHandle: true,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;}),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="property-circularview">**circularView**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>circularView: types.optional(CircularModel, () =&gt; CircularModel…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>circularView: types.optional(CircularModel, () =&gt;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;CircularModel.create({&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;type: 'CircularView',&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;hideVerticalResizeHandle: true,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;disableImportForm: true,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;}),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="property-launch">**launch**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>launch: types.frozen&lt; LaunchInput&lt;SvInspectorViewCommands&gt; &#124; un…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>launch: types.frozen&lt;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;LaunchInput&lt;SvInspectorViewCommands&gt; &#124; undefined&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&gt;()</code></pre></dialog></span> | transient launch keys, forwarded to the sheet on attach and cleared; author them directly on the view |

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
<summary>2 inherited volatiles from one model</summary>

From [BaseViewModel](../baseviewmodel): <span id="volatile-width">[`width`](../baseviewmodel#volatile-width)</span>, <span id="volatile-bodymounted">[`bodyMounted`](../baseviewmodel#volatile-bodymounted)</span>

</details>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-pendinglaunch">**pendingLaunch**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>LaunchInput&lt;SvInspectorViewCommands &amp; { unknown?: Record&lt;string…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>LaunchInput&lt;SvInspectorViewCommands &amp; { unknown?: Record&lt;string, unknown&gt; &#124; undefined; malformed?: Record&lt;string, unknown&gt; &#124; undefined; legacyInit?: boolean &#124; undefined; }&gt; &#124; undefined</code></pre></dialog></span> |  |
| <span id="getter-currentassembly">**currentAssembly**</span><br><code><a href="../assembly">Assembly</a> &#124; undefined</code> |  |
| <span id="getter-assemblyname">**assemblyName**</span><br><code>string &#124; undefined</code> |  |
| <span id="getter-showcircularview">**showCircularView**</span><br><code>boolean</code> | false while the sheet shows its import form |
| <span id="getter-showloading">**showLoading**</span><br><code>boolean</code> | both halves' loading state; the circle counts only while shown |
| <span id="getter-ownviews">**ownViews**</span><br><code>(<a href="../spreadsheetview">SpreadsheetView</a> &#124; <a href="../circularview">CircularView</a>)[]</code> | an unshown circle never initializes, so it would read as loading forever |
| <span id="getter-features">**features**</span><br><code>SimpleFeatureSerialized[]</code> | the records of the rows the sheet's filters leave |
| <span id="getter-allfeatures">**allFeatures**</span><br><code>SimpleFeatureSerialized[]</code> | every record of the sheet, which the chord track holds; filters narrow it through visibleChordIds rather than rebuilding the track |
| <span id="getter-visiblechordids">**visibleChordIds**</span><br><code>string[] &#124; undefined</code> | undefined while no filter narrows the sheet |
| <span id="getter-canonicalfeaturerefnameset">**canonicalFeatureRefNameSet**</span><br><code>Set&lt;string&gt;</code> | every canonical refName the visible features' chords end on, both ends included |
| <span id="getter-circulardisplayedregions">**circularDisplayedRegions**</span><br><code>BasicRegion[] &#124; undefined</code> | never narrowed to nothing, which would draw an empty circle |
| <span id="getter-effectivespreadsheetwidthfraction">**effectiveSpreadsheetWidthFraction**</span><br><code>number</code> |  |
| <span id="getter-subviewwidths">**subviewWidths**</span><br><code>{ spreadsheet: number; circular: number; }</code> |  |
| <span id="getter-highlightedchordids">**highlightedChordIds**</span><br><code>string[] &#124; undefined</code> | the records of the selected record's event, which the circle keeps at full strength while it dims the rest |
| <span id="getter-varianttrackid">**variantTrackId**</span><br><code>string</code> |  |
| <span id="getter-featurescirculartrackconfiguration">**featuresCircularTrackConfiguration**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ type: string; trackId: string; name: string; adapter: { type:…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ type: string; trackId: string; name: string; adapter: { type: string; features: SimpleFeatureSerialized[]; } &amp; { adapterId: string; }; assemblyNames: string[]; displays: { type: string; displayId: string; onChordClick: string; encoding: { color: { field: string; }; }; opacity: number; }[]; } &#124; undefined</code></pre></dialog></span> |  |

<details class="inherited-members" data-pagefind-ignore>
<summary>3 inherited getters from one model</summary>

From [BaseViewModel](../baseviewmodel): <span id="getter-rendersdisplays">[`rendersDisplays`](../baseviewmodel#getter-rendersdisplays)</span>, <span id="getter-effectivebodymounted">[`effectiveBodyMounted`](../baseviewmodel#getter-effectivebodymounted)</span>, <span id="getter-owntracks">[`ownTracks`](../baseviewmodel#getter-owntracks)</span>

</details>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-menuitems">**menuItems**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>() =&gt; { label: string; icon: OverridableComponent&lt;SvgIconTypeMa…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>() =&gt; { label: string; icon: OverridableComponent&lt;SvgIconTypeMap&lt;{}, "svg"&gt;&gt; &amp; { muiName: string; }; onClick: () =&gt; void; }[]</code></pre></dialog></span> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setheight">**setHeight**</span><br><code>(newHeight: number) =&gt; number</code> |  |
| <span id="action-setonlydisplayrelevantregionsincircularview">**setOnlyDisplayRelevantRegionsInCircularView**</span><br><code>(val: boolean) =&gt; void</code> |  |
| <span id="action-resizespreadsheetwidth">**resizeSpreadsheetWidth**</span><br><code>(distance: number) =&gt; void</code> | accumulates onto the fraction, not the rounded spreadsheetView.width, so the divider doesn't creep a pixel per drag frame |
| <span id="action-setlaunch">**setLaunch**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(launch?: LaunchInput&lt;SvInspectorViewCommands&gt; &#124; undefined) =&gt;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(launch?: LaunchInput&lt;SvInspectorViewCommands&gt; &#124; undefined) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-resizeheight">**resizeHeight**</span><br><code>(distance: number) =&gt; number</code> |  |

<details class="inherited-members" data-pagefind-ignore>
<summary>4 inherited actions from one model</summary>

From [BaseViewModel](../baseviewmodel): <span id="action-setdisplayname">[`setDisplayName`](../baseviewmodel#action-setdisplayname)</span>, <span id="action-setwidth">[`setWidth`](../baseviewmodel#action-setwidth)</span>, <span id="action-setbodymounted">[`setBodyMounted`](../baseviewmodel#action-setbodymounted)</span>, <span id="action-setminimized">[`setMinimized`](../baseviewmodel#action-setminimized)</span>

</details>
