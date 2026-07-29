---
id: circularview
title: CircularView
sidebar_label: View -> CircularView
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`circular-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/CircularView/model.ts).

## Example usage

Hand-authored under `defaultSession.views`. The `init` shorthand takes a single
`assembly` and the structural-variant `tracks` to draw as arcs:

```js
{
  type: 'CircularView',
  init: {
    assembly: 'hg38',
    tracks: ['my-sv-vcf'],
  },
}
```

Members a composed model contributes are listed here too, so these tables are
the whole surface.

## Properties

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal('CircularView') as unknown as string</code> | this is a string instead of the const literal 'CircularView' to reduce some typescripting strictness, but you should pass the string 'CircularView' to the model explicitly | CircularView |
| <span id="property-offsetradians">**offsetRadians**</span><br><details><summary><code>offsetRadians: types.stripDefault(types.number, defaultOffsetRa…</code></summary><pre><code>offsetRadians: types.stripDefault(types.number, defaultOffsetRadians)</code></pre></details> | similar to offsetPx in linear genome view | CircularView |
| <span id="property-bpperpx">**bpPerPx**</span><br><code>bpPerPx: types.stripDefault(types.number, defaultBpPerPx)</code> |  | CircularView |
| <span id="property-autofit">**autoFit**</span><br><code>autoFit: types.stripDefault(types.boolean, true)</code> | whether the view keeps re-fitting to its container on resize. Cleared once the user manually zooms/pans so their view (persisted via bpPerPx/offsetRadians) is preserved across resizes and reloads. | CircularView |
| <span id="property-tracks">**tracks**</span><br><details><summary><code>tracks: types.array( pluginManager.pluggableMstType('track', 's…</code></summary><pre><code>tracks: types.array(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('track', 'stateModel'),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></details> |  | CircularView |
| <span id="property-hideverticalresizehandle">**hideVerticalResizeHandle**</span><br><details><summary><code>hideVerticalResizeHandle: types.stripDefault(types.boolean, fal…</code></summary><pre><code>hideVerticalResizeHandle: types.stripDefault(types.boolean, false)</code></pre></details> |  | CircularView |
| <span id="property-hidetrackselectorbutton">**hideTrackSelectorButton**</span><br><details><summary><code>hideTrackSelectorButton: types.stripDefault(types.boolean, fals…</code></summary><pre><code>hideTrackSelectorButton: types.stripDefault(types.boolean, false)</code></pre></details> |  | CircularView |
| <span id="property-disableimportform">**disableImportForm**</span><br><code>disableImportForm: types.stripDefault(types.boolean, false)</code> |  | CircularView |
| <span id="property-height">**height**</span><br><code>height: types.stripDefault(types.number, defaultHeight)</code> |  | CircularView |
| <span id="property-displayedregions">**displayedRegions**</span><br><details><summary><code>displayedRegions: types.stripDefault(types.frozen&lt;Region[]&gt;(),…</code></summary><pre><code>displayedRegions: types.stripDefault(types.frozen&lt;Region[]&gt;(), [])</code></pre></details> |  | CircularView |
| <span id="property-minimumradiuspx">**minimumRadiusPx**</span><br><details><summary><code>minimumRadiusPx: types.stripDefault( types.number, defaultMinim…</code></summary><pre><code>minimumRadiusPx: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.number,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;defaultMinimumRadiusPx,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></details> |  | CircularView |
| <span id="property-spacingpx">**spacingPx**</span><br><code>spacingPx: types.stripDefault(types.number, defaultSpacingPx)</code> |  | CircularView |
| <span id="property-paddingpx">**paddingPx**</span><br><code>paddingPx: types.stripDefault(types.number, defaultPaddingPx)</code> |  | CircularView |
| <span id="property-minvisiblewidth">**minVisibleWidth**</span><br><details><summary><code>minVisibleWidth: types.stripDefault( types.number, defaultMinVi…</code></summary><pre><code>minVisibleWidth: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.number,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;defaultMinVisibleWidth,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></details> |  | CircularView |
| <span id="property-minimumblockwidth">**minimumBlockWidth**</span><br><details><summary><code>minimumBlockWidth: types.stripDefault( types.number, defaultMin…</code></summary><pre><code>minimumBlockWidth: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.number,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;defaultMinimumBlockWidth,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></details> |  | CircularView |
| <span id="property-trackselectortype">**trackSelectorType**</span><br><details><summary><code>trackSelectorType: types.stripDefault(types.string, 'hierarchic…</code></summary><pre><code>trackSelectorType: types.stripDefault(types.string, 'hierarchical')</code></pre></details> | vestigial: the hierarchical selector is the only one that exists, so this value is ignored. Retained because saved sessions and configs persist it. | CircularView |
| <span id="property-init">**init**</span><br><code>init: types.frozen&lt;CircularViewInit &#124; undefined&gt;()</code> | used for initializing the view from a session snapshot | CircularView |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  | [BaseViewModel](../baseviewmodel#property-id) |
| <span id="property-displayname">**displayName**</span><br><code>displayName: types.maybe(types.string)</code> | <span data-pagefind-ignore>displayName is displayed in the header of the view, or assembly names being used if none is specified</span> | [BaseViewModel](../baseviewmodel#property-displayname) |
| <span id="property-minimized">**minimized**</span><br><code>minimized: types.stripDefault(types.boolean, false)</code> |  | [BaseViewModel](../baseviewmodel#property-minimized) |

## Volatiles

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="volatile-volatilewidth">**volatileWidth**</span><br><code>volatileWidth: undefined as number &#124; undefined</code> |  | CircularView |
| <span id="volatile-volatileerror">**volatileError**</span><br><code>volatileError: undefined as unknown</code> |  | CircularView |
| <span id="volatile-panx">**panX**</span><br><code>panX: 0</code> |  | CircularView |
| <span id="volatile-pany">**panY**</span><br><code>panY: 0</code> |  | CircularView |
| <span id="volatile-width">**width**</span><br><code>width: 800</code> |  | [BaseViewModel](../baseviewmodel#volatile-width) |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-width">**width**</span><br><code>number</code> |  |
| <span id="getter-circumferencepx">**circumferencePx**</span><br><code>number</code> |  |
| <span id="getter-radiuspx">**radiusPx**</span><br><code>number</code> |  |
| <span id="getter-bpperradian">**bpPerRadian**</span><br><code>number</code> |  |
| <span id="getter-centerxy">**centerXY**</span><br><code>[number, number]</code> |  |
| <span id="getter-totalbp">**totalBp**</span><br><code>number</code> |  |
| <span id="getter-maximumradiuspx">**maximumRadiusPx**</span><br><code>number</code> |  |
| <span id="getter-maxbpperpx">**maxBpPerPx**</span><br><code>number</code> |  |
| <span id="getter-minbpperpx">**minBpPerPx**</span><br><code>number</code> |  |
| <span id="getter-atmaxbpperpx">**atMaxBpPerPx**</span><br><code>boolean</code> |  |
| <span id="getter-atminbpperpx">**atMinBpPerPx**</span><br><code>boolean</code> |  |
| <span id="getter-figuresize">**figureSize**</span><br><code>number</code> | figure is always square, so width === height |
| <span id="getter-elidedregions">**elidedRegions**</span><br><code>SliceRegion[]</code> | this is displayedRegions, post-processed to elide regions that are too small to see reasonably |
| <span id="getter-assemblynames">**assemblyNames**</span><br><code>string[]</code> |  |
| <span id="getter-initialized">**initialized**</span><br><code>boolean</code> |  |
| <span id="getter-assemblyerrors">**assemblyErrors**</span><br><code>string</code> |  |
| <span id="getter-error">**error**</span><br><code>unknown</code> |  |
| <span id="getter-hassomethingtoshow">**hasSomethingToShow**</span><br><code>boolean</code> |  |
| <span id="getter-showloading">**showLoading**</span><br><code>boolean</code> | Whether to show a loading indicator instead of the import form or view |
| <span id="getter-showview">**showView**</span><br><code>boolean</code> | Whether the view is fully initialized and ready to display |
| <span id="getter-showimportform">**showImportForm**</span><br><code>boolean</code> | Whether to show the import form (when not ready to display and import form is enabled, or when there's an error) |
| <span id="getter-staticslices">**staticSlices**</span><br><code>Slice[]</code> |  |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-menuitems">**menuItems**</span><br><code>() =&gt; MenuItem[]</code> | return the view menu items |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-fittowindow">**fitToWindow**</span><br><code>() =&gt; void</code> |  | CircularView |
| <span id="action-setwidth">**setWidth**</span><br><code>(newWidth: number) =&gt; number</code> |  | CircularView |
| <span id="action-setheight">**setHeight**</span><br><code>(newHeight: number) =&gt; number</code> |  | CircularView |
| <span id="action-rotateclockwisebutton">**rotateClockwiseButton**</span><br><code>() =&gt; void</code> |  | CircularView |
| <span id="action-rotatecounterclockwisebutton">**rotateCounterClockwiseButton**</span><br><code>() =&gt; void</code> |  | CircularView |
| <span id="action-rotate">**rotate**</span><br><code>(delta: number) =&gt; void</code> |  | CircularView |
| <span id="action-resetview">**resetView**</span><br><code>() =&gt; void</code> | reset rotation, pan, and zoom back to the default fit-to-window view | CircularView |
| <span id="action-zoominbutton">**zoomInButton**</span><br><code>() =&gt; void</code> |  | CircularView |
| <span id="action-zoomoutbutton">**zoomOutButton**</span><br><code>() =&gt; void</code> |  | CircularView |
| <span id="action-setbpperpx">**setBpPerPx**</span><br><code>(newVal: number) =&gt; void</code> |  | CircularView |
| <span id="action-zoomtopoint">**zoomToPoint**</span><br><code>(newBpPerPx: number, cursorAngle: number) =&gt; void</code> | zoom toward/away from a specific angle on the circle, keeping the genome position at that angle visually fixed under the cursor | CircularView |
| <span id="action-setdisplayedregions">**setDisplayedRegions**</span><br><code>(regions: Region[]) =&gt; void</code> |  | CircularView |
| <span id="action-activatetrackselector">**activateTrackSelector**</span><br><code>() =&gt; Widget &#124; undefined</code> |  | CircularView |
| <span id="action-toggletrack">**toggleTrack**</span><br><code>(trackId: string) =&gt; boolean</code> |  | CircularView |
| <span id="action-seterror">**setError**</span><br><code>(error: unknown) =&gt; void</code> |  | CircularView |
| <span id="action-setinit">**setInit**</span><br><code>(init?: CircularViewInit &#124; undefined) =&gt; void</code> |  | CircularView |
| <span id="action-showtrack">**showTrack**</span><br><code>(trackId: string, initialSnapshot?: any) =&gt; any</code> |  | CircularView |
| <span id="action-addtrackconf">**addTrackConf**</span><br><details><summary><code>(configuration: Record&lt;string, unknown&gt;, initialSnapshot?: any)…</code></summary><pre><code>(configuration: Record&lt;string, unknown&gt;, initialSnapshot?: any) =&gt; any</code></pre></details> |  | CircularView |
| <span id="action-hidetrack">**hideTrack**</span><br><code>(trackId: string) =&gt; boolean</code> |  | CircularView |
| <span id="action-openexportdialog">**openExportDialog**</span><br><code>() =&gt; void</code> |  | CircularView |
| <span id="action-exportsvg">**exportSvg**</span><br><code>(opts?: ExportSvgOptions) =&gt; Promise&lt;void&gt;</code> | creates an svg export and save using FileSaver | CircularView |
| <span id="action-resizeheight">**resizeHeight**</span><br><code>(distance: number) =&gt; number</code> |  | CircularView |
| <span id="action-resizewidth">**resizeWidth**</span><br><code>(distance: number) =&gt; number</code> |  | CircularView |
| <span id="action-setdisplayname">**setDisplayName**</span><br><code>(name: string) =&gt; void</code> |  | [BaseViewModel](../baseviewmodel#action-setdisplayname) |
| <span id="action-setminimized">**setMinimized**</span><br><code>(flag: boolean) =&gt; void</code> |  | [BaseViewModel](../baseviewmodel#action-setminimized) |
