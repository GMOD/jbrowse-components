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
`assembly` and the structural-variant `tracks` to draw as chords. A track entry
may carry display config inline, and `displayedRegionNames` keeps an assembly's
alt/unplaced contigs off the circle:

```js
{
  type: 'CircularView',
  init: {
    assembly: 'hg38',
    displayedRegionNames: ['chr1', 'chr2', 'chr3'],
    tracks: [{ trackId: 'my-sv-vcf', strokeColor: 'red' }],
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
| <span id="property-offsetradians">**offsetRadians**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>offsetRadians: types.stripDefault(types.number, defaultOffsetRa…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>offsetRadians: types.stripDefault(types.number, defaultOffsetRadians)</code></pre></dialog></span> | similar to offsetPx in linear genome view | CircularView |
| <span id="property-bpperpx">**bpPerPx**</span><br><code>bpPerPx: types.stripDefault(types.number, defaultBpPerPx)</code> | the zoom level, base-pairs per pixel. Capped by `minimumRadiusPx`, and refit over by the first resize unless `autoFit` is false. | CircularView |
| <span id="property-autofit">**autoFit**</span><br><code>autoFit: types.stripDefault(types.boolean, true)</code> | whether the view keeps re-fitting to its container on resize. Cleared once the user manually zooms/pans so their view (persisted via bpPerPx/offsetRadians) is preserved across resizes and reloads. | CircularView |
| <span id="property-tracks">**tracks**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>tracks: types.array( pluginManager.pluggableMstType('track', 's…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>tracks: types.array(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('track', 'stateModel'),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  | CircularView |
| <span id="property-hideverticalresizehandle">**hideVerticalResizeHandle**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>hideVerticalResizeHandle: types.stripDefault(types.boolean, fal…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>hideVerticalResizeHandle: types.stripDefault(types.boolean, false)</code></pre></dialog></span> | chrome switch, for an embed that drives the view itself | CircularView |
| <span id="property-hidetrackselectorbutton">**hideTrackSelectorButton**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>hideTrackSelectorButton: types.stripDefault(types.boolean, fals…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>hideTrackSelectorButton: types.stripDefault(types.boolean, false)</code></pre></dialog></span> | chrome switch, for an embed that drives the view itself | CircularView |
| <span id="property-disableimportform">**disableImportForm**</span><br><code>disableImportForm: types.stripDefault(types.boolean, false)</code> | suppress the import form even on an error — what the SV inspector's circle wants, since its assembly comes from the sheet beside it and a form there would offer a control that cannot work | CircularView |
| <span id="property-height">**height**</span><br><code>height: types.stripDefault(types.number, defaultHeight)</code> | the height of the view in pixels. The circle auto-fits its container, so this is what sizes the drawing. | CircularView |
| <span id="property-displayedregions">**displayedRegions**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>displayedRegions: types.stripDefault(types.frozen&lt;Region[]&gt;(),…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>displayedRegions: types.stripDefault(types.frozen&lt;Region[]&gt;(), [])</code></pre></dialog></span> | the regions the circle lays out, one arc each, in this order. `displayedRegionNames` names the same thing by refName and is the shorter form. | CircularView |
| <span id="property-minimumradiuspx">**minimumRadiusPx**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>minimumRadiusPx: types.stripDefault( types.number, defaultMinim…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>minimumRadiusPx: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.number,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;defaultMinimumRadiusPx,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | how far in the circle may be zoomed, as a floor on the radius; it is what caps bpPerPx | CircularView |
| <span id="property-spacingpx">**spacingPx**</span><br><code>spacingPx: types.stripDefault(types.number, defaultSpacingPx)</code> | the gap drawn between adjacent chromosome arcs | CircularView |
| <span id="property-paddingpx">**paddingPx**</span><br><code>paddingPx: types.stripDefault(types.number, defaultPaddingPx)</code> | blank margin between the circle and the edge of the figure | CircularView |
| <span id="property-minvisiblewidth">**minVisibleWidth**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>minVisibleWidth: types.stripDefault( types.number, defaultMinVi…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>minVisibleWidth: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.number,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;defaultMinVisibleWidth,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | arcs thinner than this many pixels are elided instead of drawn, which is what stops a few thousand unplaced contigs becoming a ring of hairlines | CircularView |
| <span id="property-trackselectortype">**trackSelectorType**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>trackSelectorType: types.stripDefault(types.string, 'hierarchic…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>trackSelectorType: types.stripDefault(types.string, 'hierarchical')</code></pre></dialog></span> | vestigial: the hierarchical selector is the only one that exists, so this value is ignored. Retained because saved sessions and configs persist it. | CircularView |
| <span id="property-init">**init**</span><br><code>init: types.frozen&lt;CircularViewInit &#124; undefined&gt;()</code> | used for initializing the view from a session snapshot | CircularView |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  | [BaseViewModel](../baseviewmodel#property-id) |
| <span id="property-displayname">**displayName**</span><br><code>displayName: types.maybe(types.string)</code> | <span data-pagefind-ignore>displayName is displayed in the header of the view, or assembly names being used if none is specified</span> | [BaseViewModel](../baseviewmodel#property-displayname) |
| <span id="property-minimized">**minimized**</span><br><code>minimized: types.stripDefault(types.boolean, false)</code> | <span data-pagefind-ignore>collapse the view to its header bar, keeping it in the session rather than closing it</span> | [BaseViewModel](../baseviewmodel#property-minimized) |

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
| <span id="getter-effectivepaddingpx">**effectivePaddingPx**</span><br><code>number</code> | `paddingPx`, capped so it cannot eat a small box.<br><br>The declared value is a fixed 80px sized for a circle with a window to itself, and it comes out of the radius twice. In the SV inspector, whose circle gets about a third of the width, that left the drawn disc covering 41% of the area it was given, and in a 316px-tall one — the height the SV tutorial's figure sets — the radius fell to 78px.<br><br>Capped as a fraction of the half-box rather than at a pixel count, so the circle holds one shape at every size. The fraction is the one the declared 80px already is at the size it was tuned for, so a roomy circle is untouched and a cramped one is merely not made worse. The floor is what the ruler labels need to sit outside the arc at all. |
| <span id="getter-effectivespacingpx">**effectiveSpacingPx**</span><br><code>number</code> | `spacingPx`, capped so the inter-chromosome gaps cannot take the ring.<br><br>Also a fixed pixel count, and it is charged once per slice, so what it costs depends entirely on how big the circle ended up: 27% of the circumference at the SV inspector's default and 49% of it at that 316px-tall one, where the chromosomes drew as ticks with holes between them. Capping the total rather than the gap keeps a roomy circle on the declared value and only closes up where the ring is genuinely short.<br><br>Measured against the radius the box would fit rather than `radiusPx`, which is derived from this. |
| <span id="getter-fitradiuspx">**fitRadiusPx**</span><br><code>number</code> | the radius the current box has room for — what `fitToWindow` aims at, and the scale `effectiveSpacingPx` measures itself against. A pure function of the box, so neither reads back a value derived from it |
| <span id="getter-circumferencepx">**circumferencePx**</span><br><code>number</code> |  |
| <span id="getter-radiuspx">**radiusPx**</span><br><code>number</code> |  |
| <span id="getter-bpperradian">**bpPerRadian**</span><br><code>number</code> |  |
| <span id="getter-centerxy">**centerXY**</span><br><code>[number, number]</code> |  |
| <span id="getter-totalbp">**totalBp**</span><br><code>number</code> |  |
| <span id="getter-maxbpperpx">**maxBpPerPx**</span><br><code>number</code> |  |
| <span id="getter-minbpperpx">**minBpPerPx**</span><br><code>number</code> |  |
| <span id="getter-atmaxbpperpx">**atMaxBpPerPx**</span><br><code>boolean</code> |  |
| <span id="getter-atminbpperpx">**atMinBpPerPx**</span><br><code>boolean</code> |  |
| <span id="getter-figuresize">**figureSize**</span><br><code>number</code> | figure is always square, so width === height |
| <span id="getter-figureoriginxy">**figureOriginXY**</span><br><code>[number, number]</code> | top-left of the figure within the view's box, then shifted by the zoom-to-cursor pan.<br><br>Centered horizontally: a view much wider than it is tall would otherwise leave the circle jammed in the corner under the controls.<br><br>Vertically it hangs from the top of a box taller than it is wide — see `figureMiddleY`, which `zoomToPoint` reads for the same reason. |
| <span id="getter-elidedregions">**elidedRegions**</span><br><code>SliceRegion[]</code> | this is displayedRegions, post-processed to elide regions that are too small to see reasonably |
| <span id="getter-assemblynames">**assemblyNames**</span><br><code>string[]</code> |  |
| <span id="getter-initialized">**initialized**</span><br><code>boolean</code> |  |
| <span id="getter-assemblyerrors">**assemblyErrors**</span><br><code>string</code> |  |
| <span id="getter-error">**error**</span><br><code>unknown</code> |  |
| <span id="getter-hassomethingtoshow">**hasSomethingToShow**</span><br><code>boolean</code> |  |
| <span id="getter-showloading">**showLoading**</span><br><code>boolean</code> | Whether to show a loading indicator instead of the import form or view |
| <span id="getter-loadingassembly">**loadingAssembly**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { error: unknown; loadingP: Promis…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { error: unknown; loadingP: Promise&lt;…&gt; &#124; undefined; ... 9 more ...; refNameMismatches: Map&lt;...&gt;; } &amp; ... 13 more ... &amp; IStateTreeNode&lt;...&gt;) &#124; undefined</code></pre></dialog></span> | The assembly whose load the spinner is waiting on. `init` names it before displayedRegions exist, so it is the source until then — the same order `initialized` above resolves in. |
| <span id="getter-loadingmessage">**loadingMessage**</span><br><code>string &#124; undefined</code> | What the spinner says: which of the assembly's files is downloading, rather than a bare "Loading" for the slow part of startup. See agent-docs/reference/PROGRESS_REPORTING.md. |
| <span id="getter-loadingprogress">**loadingProgress**</span><br><code>number &#124; undefined</code> | Determinate fraction for the spinner's bar, when the assembly load reports one |
| <span id="getter-showview">**showView**</span><br><code>boolean</code> | Whether the view is fully initialized and ready to display |
| <span id="getter-showimportform">**showImportForm**</span><br><code>boolean</code> | `!hasSomethingToShow \|\| !!error`, the same predicate as every other view, with `disableImportForm` suppressing the whole thing rather than only its first half.<br><br>The `\|\|` used to bind the other way, so an error re-enabled a form the embedder had turned off. That is reachable, and the sv-inspector — `disableImportForm`'s only setter — is where: its circle is driven by the spreadsheet's assembly, so a circle left sitting on regions whose assembly the config no longer has reports an error (the case the region-binding autorun's comment describes). The inspector then grew a circular-view import form inside its own panel, offering an assembly dropdown whose Open the inspector's autorun overwrites on the next pass — a control that cannot work, in a view that asked not to have it.<br><br>The error still has to be reported, so the component renders a bare ErrorBanner in that case; the form is only the *usual* place a circular view puts one. |
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
| <span id="action-fittowindow">**fitToWindow**</span><br><code>() =&gt; void</code> | size the figure so it exactly fills the smaller of the view's two dimensions | CircularView |
| <span id="action-setwidth">**setWidth**</span><br><code>(newWidth: number) =&gt; number</code> |  | CircularView |
| <span id="action-setheight">**setHeight**</span><br><code>(newHeight: number) =&gt; number</code> |  | CircularView |
| <span id="action-rotateclockwisebutton">**rotateClockwiseButton**</span><br><code>() =&gt; void</code> |  | CircularView |
| <span id="action-rotatecounterclockwisebutton">**rotateCounterClockwiseButton**</span><br><code>() =&gt; void</code> |  | CircularView |
| <span id="action-rotate">**rotate**</span><br><code>(delta: number) =&gt; void</code> |  | CircularView |
| <span id="action-resetview">**resetView**</span><br><code>() =&gt; void</code> | reset rotation, pan, and zoom back to the default fit-to-window view | CircularView |
| <span id="action-zoominbutton">**zoomInButton**</span><br><code>() =&gt; void</code> |  | CircularView |
| <span id="action-zoomoutbutton">**zoomOutButton**</span><br><code>() =&gt; void</code> |  | CircularView |
| <span id="action-setbpperpx">**setBpPerPx**</span><br><code>(newVal: number) =&gt; void</code> |  | CircularView |
| <span id="action-zoomtopoint">**zoomToPoint**</span><br><code>(newBpPerPx: number, cursorX: number, cursorY: number) =&gt; void</code> | zoom toward/away from a point on the figure, keeping whatever is under it visually fixed. The point is its offset in screen px from the middle of the circle — what `offsetFromCenter` in the component hands back | CircularView |
| <span id="action-setdisplayedregions">**setDisplayedRegions**</span><br><code>(regions: Region[]) =&gt; void</code> |  | CircularView |
| <span id="action-activatetrackselector">**activateTrackSelector**</span><br><code>() =&gt; Widget &#124; undefined</code> |  | CircularView |
| <span id="action-toggletrack">**toggleTrack**</span><br><code>(trackId: string) =&gt; boolean</code> |  | CircularView |
| <span id="action-seterror">**setError**</span><br><code>(error: unknown) =&gt; void</code> |  | CircularView |
| <span id="action-setinit">**setInit**</span><br><code>(init?: CircularViewInit &#124; undefined) =&gt; void</code> |  | CircularView |
| <span id="action-showtrack">**showTrack**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackId: string, initialSnapshot?: any, displayInitialSnapshot…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackId: string, initialSnapshot?: any, displayInitialSnapshot?: any, inlineConf?: Record&lt;string, unknown&gt; &#124; undefined) =&gt; any</code></pre></dialog></span> |  | CircularView |
| <span id="action-addtrackconf">**addTrackConf**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(configuration: Record&lt;string, unknown&gt;, initialSnapshot?: any)…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(configuration: Record&lt;string, unknown&gt;, initialSnapshot?: any) =&gt; any</code></pre></dialog></span> |  | CircularView |
| <span id="action-hidetrack">**hideTrack**</span><br><code>(trackId: string) =&gt; boolean</code> |  | CircularView |
| <span id="action-openexportdialog">**openExportDialog**</span><br><code>() =&gt; void</code> |  | CircularView |
| <span id="action-exportsvg">**exportSvg**</span><br><code>(opts?: ExportSvgOptions) =&gt; Promise&lt;void&gt;</code> | creates an svg export and save using FileSaver | CircularView |
| <span id="action-launchtrack">**launchTrack**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackId: string, initialSnapshot?: any, displayInitialSnapshot…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackId: string, initialSnapshot?: any, displayInitialSnapshot?: any) =&gt; Promise&lt;any&gt;</code></pre></dialog></span> | showTrack for a track whose display state model may be lazily loaded: loads it, then shows | CircularView |
| <span id="action-launchtoggletrack">**launchToggleTrack**</span><br><code>(trackId: string) =&gt; Promise&lt;boolean&gt;</code> | toggleTrack with launchTrack's loading behavior | CircularView |
| <span id="action-launchtrackconf">**launchTrackConf**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(configuration: Record&lt;string, unknown&gt;, initialSnapshot?: any)…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(configuration: Record&lt;string, unknown&gt;, initialSnapshot?: any) =&gt; Promise&lt;any&gt;</code></pre></dialog></span> | `addTrackConf` with `launchTrack`'s loading behavior, for a track the caller synthesizes and hands over inline — the SV inspector's chord track is built from its sheet's rows and never reaches a session list | CircularView |
| <span id="action-resizeheight">**resizeHeight**</span><br><code>(distance: number) =&gt; number</code> |  | CircularView |
| <span id="action-resizewidth">**resizeWidth**</span><br><code>(distance: number) =&gt; number</code> |  | CircularView |
| <span id="action-setdisplayname">**setDisplayName**</span><br><code>(name: string) =&gt; void</code> |  | [BaseViewModel](../baseviewmodel#action-setdisplayname) |
| <span id="action-setminimized">**setMinimized**</span><br><code>(flag: boolean) =&gt; void</code> |  | [BaseViewModel](../baseviewmodel#action-setminimized) |
