---
id: svinspectorview
title: SvInspectorView
sidebar_label: View -> SvInspectorView
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`sv-inspector` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sv-inspector/src/SvInspectorView/model.ts).

## Example usage

Hand-authored under `defaultSession.views`. The `init` shorthand loads a
structural-variant file into the spreadsheet and mirrors the rows as arcs in the
paired circular view; `assembly` resolves coordinates for both:

```js
{
  type: 'SvInspectorView',
  init: {
    assembly: 'hg38',
    uri: 'https://example.com/sv.vcf.gz',
    fileType: 'VCF',
  },
}
```

does not extend, but is a combination of a

- [SpreadsheetView](../spreadsheetview)
- [CircularView](../circularview)

Members a composed model contributes are listed here too, so these tables are
the whole surface.

## Properties

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  | SvInspectorView |
| <span id="property-type">**type**</span><br><code>type: types.literal('SvInspectorView')</code> |  | SvInspectorView |
| <span id="property-height">**height**</span><br><code>height: types.stripDefault(types.number, defaultHeight)</code> |  | SvInspectorView |
| <span id="property-onlydisplayrelevantregionsincircularview">**onlyDisplayRelevantRegionsInCircularView**</span><br><details><summary><code>onlyDisplayRelevantRegionsInCircularView: types.stripDefault( t…</code></summary><pre><code>onlyDisplayRelevantRegionsInCircularView: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.boolean,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;false,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></details> |  | SvInspectorView |
| <span id="property-spreadsheetwidthfraction">**spreadsheetWidthFraction**</span><br><code>spreadsheetWidthFraction: types.stripDefault(types.number, 0.66)</code> | share of the view's width given to the spreadsheet, the rest goes to the circular view. Persisted so dragging the divider survives both a window resize and a session reload | SvInspectorView |
| <span id="property-spreadsheetview">**spreadsheetView**</span><br><details><summary><code>spreadsheetView: types.optional(SpreadsheetModel, () =&gt; Spreads…</code></summary><pre><code>spreadsheetView: types.optional(SpreadsheetModel, () =&gt;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;SpreadsheetModel.create({&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;type: 'SpreadsheetView',&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;hideVerticalResizeHandle: true,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;}),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></details> |  | SvInspectorView |
| <span id="property-circularview">**circularView**</span><br><details><summary><code>circularView: types.optional(CircularModel, () =&gt; CircularModel…</code></summary><pre><code>circularView: types.optional(CircularModel, () =&gt;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;CircularModel.create({&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;type: 'CircularView',&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;hideVerticalResizeHandle: true,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;hideTrackSelectorButton: true,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;disableImportForm: true,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;}),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></details> |  | SvInspectorView |
| <span id="property-init">**init**</span><br><code>init: types.frozen&lt;SvInspectorViewInit &#124; undefined&gt;()</code> | used for initializing the view from a session snapshot | SvInspectorView |
| <span id="property-displayname">**displayName**</span><br><code>displayName: types.maybe(types.string)</code> | <span data-pagefind-ignore>displayName is displayed in the header of the view, or assembly names being used if none is specified</span> | [BaseViewModel](../baseviewmodel#property-displayname) |
| <span id="property-minimized">**minimized**</span><br><code>minimized: types.stripDefault(types.boolean, false)</code> |  | [BaseViewModel](../baseviewmodel#property-minimized) |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-width">**width**</span><br><code>width: 800</code> |  |
| <span id="volatile-spreadsheetviewreactcomponent">**SpreadsheetViewReactComponent**</span><br><details><summary><code>SpreadsheetViewReactComponent: SpreadsheetViewType.ReactCompone…</code></summary><pre><code>SpreadsheetViewReactComponent: SpreadsheetViewType.ReactComponent</code></pre></details> |  |
| <span id="volatile-circularviewreactcomponent">**CircularViewReactComponent**</span><br><code>CircularViewReactComponent: CircularViewType.ReactComponent</code> |  |
| <span id="volatile-circularviewoptionsbarheight">**circularViewOptionsBarHeight**</span><br><code>circularViewOptionsBarHeight: 52</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-currentassembly">**currentAssembly**</span><br><details><summary><code>(ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; ... 12 more ... &amp; IStateTree…</code></summary><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; ... 12 more ... &amp; IStateTreeNode&lt;…&gt;) &#124; undefined</code></pre></details> |  |
| <span id="getter-assemblyname">**assemblyName**</span><br><code>string &#124; undefined</code> |  |
| <span id="getter-showcircularview">**showCircularView**</span><br><code>boolean</code> | gated on the same condition the spreadsheet renders its grid on, so the circle never appears alongside the import form |
| <span id="getter-features">**features**</span><br><code>SimpleFeatureSerialized[]</code> |  |
| <span id="getter-featuresadapterconfigsnapshot">**featuresAdapterConfigSnapshot**</span><br><code>{ type: string; features: SimpleFeatureSerialized[]; }</code> |  |
| <span id="getter-featurerefnames">**featureRefNames**</span><br><code>string[]</code> |  |
| <span id="getter-canonicalfeaturerefnameset">**canonicalFeatureRefNameSet**</span><br><code>Set&lt;string&gt;</code> |  |
| <span id="getter-circulardisplayedregions">**circularDisplayedRegions**</span><br><code>BasicRegion[] &#124; undefined</code> | the regions the paired circular view should show. An empty relevant-set means the features aren't parsed yet, so show everything rather than an empty circle |
| <span id="getter-varianttrackid">**variantTrackId**</span><br><code>string</code> |  |
| <span id="getter-featurescirculartrackconfiguration">**featuresCircularTrackConfiguration**</span><br><details><summary><code>{ type: string; trackId: string; name: string; adapter: {…}; as…</code></summary><pre><code>{ type: string; trackId: string; name: string; adapter: {…}; assemblyNames: string[]; displays: { type: string; displayId: string; onChordClick: string; renderer: { ...; }; }[]; }</code></pre></details> |  |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-menuitems">**menuItems**</span><br><details><summary><code>() =&gt; { label: string; icon: OverridableComponent&lt;SvgIconTypeMa…</code></summary><pre><code>() =&gt; { label: string; icon: OverridableComponent&lt;SvgIconTypeMap&lt;{}, "svg"&gt;&gt; &amp; { muiName: string; }; onClick: () =&gt; void; }[]</code></pre></details> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-setwidth">**setWidth**</span><br><code>(newWidth: number) =&gt; void</code> |  | SvInspectorView |
| <span id="action-setheight">**setHeight**</span><br><code>(newHeight: number) =&gt; number</code> |  | SvInspectorView |
| <span id="action-setonlydisplayrelevantregionsincircularview">**setOnlyDisplayRelevantRegionsInCircularView**</span><br><code>(val: boolean) =&gt; void</code> |  | SvInspectorView |
| <span id="action-resizespreadsheetwidth">**resizeSpreadsheetWidth**</span><br><code>(distance: number) =&gt; void</code> | move the divider between the two subviews. Stored as a fraction so the width binding can reapply it, rather than resizing the subviews directly and having the next parent resize overwrite it | SvInspectorView |
| <span id="action-setinit">**setInit**</span><br><code>(init?: SvInspectorViewInit &#124; undefined) =&gt; void</code> |  | SvInspectorView |
| <span id="action-resizeheight">**resizeHeight**</span><br><code>(distance: number) =&gt; number</code> |  | SvInspectorView |
| <span id="action-setdisplayname">**setDisplayName**</span><br><code>(name: string) =&gt; void</code> |  | [BaseViewModel](../baseviewmodel#action-setdisplayname) |
| <span id="action-setminimized">**setMinimized**</span><br><code>(flag: boolean) =&gt; void</code> |  | [BaseViewModel](../baseviewmodel#action-setminimized) |
