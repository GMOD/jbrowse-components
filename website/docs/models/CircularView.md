---
id: circularview
title: CircularView
sidebar_label: View -> CircularView
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the `circular-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/CircularView/model.ts).

## Example usage

Hand-authored under `defaultSession.views`, with every setting written
directly on the view object. `assembly` picks the genome, a `tracks` entry may
carry display config inline, and `displayedRegionNames` keeps an assembly's
alt/unplaced contigs off the circle:

```js
{
  type: 'CircularView',
  assembly: 'hg38',
  displayedRegionNames: ['chr1', 'chr2', 'chr3'],
  tracks: [{ trackId: 'my-sv-vcf', strokeColor: 'red' }],
}
```

Members a composed model contributes are listed here too, so these tables are the whole surface.

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
| <span id="property-launch">**launch**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>launch: types.frozen&lt;LaunchInput&lt;CircularViewCommands&gt; &#124; undefi…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>launch: types.frozen&lt;LaunchInput&lt;CircularViewCommands&gt; &#124; undefined&gt;()</code></pre></dialog></span> | transient launch state: the settings written on the view object that need resolving before they can be view state — the assembly the circle is drawn from, the refNames to restrict it to, chord track recipes. `preProcessSnapshot` moves them here off the snapshot, the afterAttach autorun applies them and clears this, so a saved session never retains it. Not written by hand: author every setting directly on the view. | CircularView |
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
| <span id="volatile-bodymounted">**bodyMounted**</span><br><code>bodyMounted: true</code> | <span data-pagefind-ignore>Whether the container has this view's body in the DOM.<br><br>`ViewContainer` mounts a view's body only while an IntersectionObserver says it is on screen, to hold the app under the WebGL2 context ceiling (`reference/GPU_CONTEXT_BUDGET.md`). A view below the fold therefore has no canvas, so nothing ever calls `markCanvasDrawn` and the pre-first-paint term of `displayPhase` pins every display in it at `loading` with nothing left to resolve it — which parks `[data-app-phase="ready"]` for the whole app on a view the user cannot see.<br><br>Defaults true so the containers that always mount a body — embedded views, workspace panels, and any test rendering a display directly — are unaffected and need not set it.<br><br>The raw flag, written by this view's own container. A display asks `effectiveBodyMounted` instead, because a nested view has no container of its own.</span> | [BaseViewModel](../baseviewmodel#volatile-bodymounted) |

## Getters

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="getter-width">**width**</span><br><code>number</code> |  | CircularView |
| <span id="getter-effectivepaddingpx">**effectivePaddingPx**</span><br><code>number</code> | `paddingPx`, capped so it cannot eat a small box.<br><br>The declared value is a fixed 80px sized for a circle with a window to itself, and it comes out of the radius twice. In the SV inspector, whose circle gets about a third of the width, that left the drawn disc covering 41% of the area it was given, and in a 316px-tall one — the height the SV tutorial's figure sets — the radius fell to 78px.<br><br>Capped as a fraction of the half-box rather than at a pixel count, so the circle holds one shape at every size. The fraction is the one the declared 80px already is at the size it was tuned for, so a roomy circle is untouched and a cramped one is merely not made worse. The floor is what the ruler labels need to sit outside the arc at all. | CircularView |
| <span id="getter-effectivespacingpx">**effectiveSpacingPx**</span><br><code>number</code> | `spacingPx`, capped so the inter-chromosome gaps cannot take the ring.<br><br>Also a fixed pixel count, and it is charged once per slice, so what it costs depends entirely on how big the circle ended up: 27% of the circumference at the SV inspector's default and 49% of it at that 316px-tall one, where the chromosomes drew as ticks with holes between them. Capping the total rather than the gap keeps a roomy circle on the declared value and only closes up where the ring is genuinely short.<br><br>Measured against the radius the box would fit rather than `radiusPx`, which is derived from this. | CircularView |
| <span id="getter-fitradiuspx">**fitRadiusPx**</span><br><code>number</code> | the radius the current box has room for — what `fitToWindow` aims at, and the scale `effectiveSpacingPx` measures itself against. A pure function of the box, so neither reads back a value derived from it | CircularView |
| <span id="getter-circumferencepx">**circumferencePx**</span><br><code>number</code> |  | CircularView |
| <span id="getter-radiuspx">**radiusPx**</span><br><code>number</code> |  | CircularView |
| <span id="getter-bpperradian">**bpPerRadian**</span><br><code>number</code> |  | CircularView |
| <span id="getter-centerxy">**centerXY**</span><br><code>[number, number]</code> |  | CircularView |
| <span id="getter-totalbp">**totalBp**</span><br><code>number</code> |  | CircularView |
| <span id="getter-maxbpperpx">**maxBpPerPx**</span><br><code>number</code> |  | CircularView |
| <span id="getter-minbpperpx">**minBpPerPx**</span><br><code>number</code> |  | CircularView |
| <span id="getter-atmaxbpperpx">**atMaxBpPerPx**</span><br><code>boolean</code> |  | CircularView |
| <span id="getter-atminbpperpx">**atMinBpPerPx**</span><br><code>boolean</code> |  | CircularView |
| <span id="getter-figuresize">**figureSize**</span><br><code>number</code> | figure is always square, so width === height | CircularView |
| <span id="getter-figureoriginxy">**figureOriginXY**</span><br><code>[number, number]</code> | top-left of the figure within the view's box, then shifted by the zoom-to-cursor pan.<br><br>Centered horizontally: a view much wider than it is tall would otherwise leave the circle jammed in the corner under the controls.<br><br>Vertically it hangs from the top of a box taller than it is wide — see `figureMiddleY`, which `zoomToPoint` reads for the same reason. | CircularView |
| <span id="getter-elidedregions">**elidedRegions**</span><br><code>SliceRegion[]</code> | this is displayedRegions, post-processed to elide regions that are too small to see reasonably | CircularView |
| <span id="getter-pendinglaunch">**pendingLaunch**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>LaunchInput&lt;CircularViewCommands &amp; { unknown?: Record&lt;…&gt; &#124; unde…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>LaunchInput&lt;CircularViewCommands &amp; { unknown?: Record&lt;…&gt; &#124; undefined; malformed?: Record&lt;…&gt; &#124; undefined; legacyInit?: boolean &#124; undefined; } &amp; IStateTreeNode&lt;...&gt;&gt; &#124; undefined</code></pre></dialog></span> | the launch state that still has something to apply — the gate the loading and import-form paths below read. | CircularView |
| <span id="getter-assemblynames">**assemblyNames**</span><br><code>string[]</code> |  | CircularView |
| <span id="getter-launchassemblyname">**launchAssemblyName**</span><br><code>string &#124; undefined</code> | The assembly a pending launch names, which is what the gates below wait on before `displayedRegions` exist. A blob carrying only tracks names none, and waiting on one nobody named never ends. | CircularView |
| <span id="getter-initialized">**initialized**</span><br><code>boolean</code> |  | CircularView |
| <span id="getter-assemblyerrors">**assemblyErrors**</span><br><code>string</code> |  | CircularView |
| <span id="getter-error">**error**</span><br><code>unknown</code> |  | CircularView |
| <span id="getter-hassomethingtoshow">**hasSomethingToShow**</span><br><code>boolean</code> |  | CircularView |
| <span id="getter-showloading">**showLoading**</span><br><code>boolean</code> | Whether to show a loading indicator instead of the import form or view | CircularView |
| <span id="getter-loadingassembly">**loadingAssembly**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { error: unknown; loadingP: Promis…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { error: unknown; loadingP: Promise&lt;…&gt; &#124; undefined; ... 10 more ...; refNameMismatches: Map&lt;…&gt;; } &amp; ... 13 more ... &amp; IStateTreeNode&lt;...&gt;) &#124; undefined</code></pre></dialog></span> | The assembly whose load the spinner is waiting on. A pending launch names it before displayedRegions exist, so it is the source until then — the same order `initialized` above resolves in. | CircularView |
| <span id="getter-loadingmessage">**loadingMessage**</span><br><code>string &#124; undefined</code> | What the spinner says: which of the assembly's files is downloading, rather than a bare "Loading" for the slow part of startup. See agent-docs/reference/PROGRESS_REPORTING.md. | CircularView |
| <span id="getter-loadingprogress">**loadingProgress**</span><br><code>number &#124; undefined</code> | Determinate fraction for the spinner's bar, when the assembly load reports one | CircularView |
| <span id="getter-loadingsource">**loadingSource**</span><br><code>string &#124; undefined</code> | The URL the assembly load is currently fetching, when the phase named one. Only the stalled-load notice reads it — see `ViewLoadingScreen`. | CircularView |
| <span id="getter-showview">**showView**</span><br><code>boolean</code> | Whether the view is fully initialized and ready to display | CircularView |
| <span id="getter-showimportform">**showImportForm**</span><br><code>boolean</code> | `!hasSomethingToShow \|\| !!error`, the same predicate as every other view, with `disableImportForm` suppressing the whole thing rather than only its first half.<br><br>The `\|\|` used to bind the other way, so an error re-enabled a form the embedder had turned off. That is reachable, and the sv-inspector — `disableImportForm`'s only setter — is where: its circle is driven by the spreadsheet's assembly, so a circle left sitting on regions whose assembly the config no longer has reports an error (the case the region-binding autorun's comment describes). The inspector then grew a circular-view import form inside its own panel, offering an assembly dropdown whose Open the inspector's autorun overwrites on the next pass — a control that cannot work, in a view that asked not to have it.<br><br>The error still has to be reported, so the component renders a bare ErrorBanner in that case; the form is only the *usual* place a circular view puts one. | CircularView |
| <span id="getter-status">**status**</span><br><code>ViewStatus</code> | The view's lifecycle as one value — ready, error, loading or noRegions — for a host that draws its own chrome and has to render all four. Same shape and same precedence as the linear view's, through `computeViewStatus`. | CircularView |
| <span id="getter-staticslices">**staticSlices**</span><br><code>Slice[]</code> |  | CircularView |
| <span id="getter-effectivebodymounted">**effectiveBodyMounted**</span><br><code>boolean</code> | <span data-pagefind-ignore>Whether this view's body is in the DOM, counting the views it is nested inside — which is the question a display's phase actually asks.<br><br>`bodyMounted` alone answers it only for a view a container renders directly. A view nested in another view (a synteny row, a breakpoint panel) has no container writing its flag, so it reads `true` forever while its whole subtree is out of the DOM, and every display in it waits for a first paint that nothing will make — the hang this flag exists to prevent, one level down.<br><br>An ancestor that does not carry the flag at all leaves the answer alone rather than excusing the paint: only an explicit `false` unmounts, so a duck-typed stand-in that forgot it keeps waiting, which is the failure that shows up as a slow test rather than as a picture of an empty view.</span> | [BaseViewModel](../baseviewmodel#getter-effectivebodymounted) |
| <span id="getter-owntracks">**ownTracks**</span><br><code>AbstractTrackModel[]</code> | <span data-pagefind-ignore>Every track open on this view itself: its own `tracks` array plus any track containers it owns instead (the synteny view keeps one list per band on `trackContainers` and its own `tracks` empty). Tracks on nested views are `allTracks`'s, not this getter's.</span> | [BaseViewModel](../baseviewmodel#getter-owntracks) |
| <span id="getter-allviews">**allViews**</span><br><code>AbstractViewModel[]</code> | <span data-pagefind-ignore>This view and every view nested inside it, to any depth — a synteny stack's genome rows, a breakpoint split view's panels. Each view answers for its own children, so a consumer never walks the nesting itself: before this getter, four consumers each carried a copy of the walk and two of them had drifted (one read `levels`, one read `trackContainers`, and each was blind to the other's spelling).</span> | [BaseViewModel](../baseviewmodel#getter-allviews) |
| <span id="getter-alltracks">**allTracks**</span><br><code>AbstractTrackModel[]</code> | <span data-pagefind-ignore>Every track open on this view or any view nested inside it.</span> | [BaseViewModel](../baseviewmodel#getter-alltracks) |

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
| <span id="action-setlaunch">**setLaunch**</span><br><code>(launch?: LaunchInput&lt;CircularViewCommands&gt; &#124; undefined) =&gt; void</code> |  | CircularView |
| <span id="action-showtrack">**showTrack**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackId: string, initialSnapshot?: any, displayInitialSnapshot…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackId: string, initialSnapshot?: any, displayInitialSnapshot?: any) =&gt; any</code></pre></dialog></span> |  | CircularView |
| <span id="action-addtrackconf">**addTrackConf**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(configuration: Record&lt;string, unknown&gt;, initialSnapshot?: any)…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(configuration: Record&lt;string, unknown&gt;, initialSnapshot?: any) =&gt; any</code></pre></dialog></span> |  | CircularView |
| <span id="action-hidetrack">**hideTrack**</span><br><code>(trackId: string) =&gt; boolean</code> |  | CircularView |
| <span id="action-openexportdialog">**openExportDialog**</span><br><code>() =&gt; void</code> |  | CircularView |
| <span id="action-exportsvg">**exportSvg**</span><br><code>(opts?: ExportSvgOptions) =&gt; Promise&lt;void&gt;</code> | creates an svg export and save using FileSaver | CircularView |
| <span id="action-resizeheight">**resizeHeight**</span><br><code>(distance: number) =&gt; number</code> |  | CircularView |
| <span id="action-resizewidth">**resizeWidth**</span><br><code>(distance: number) =&gt; number</code> |  | CircularView |
| <span id="action-setdisplayname">**setDisplayName**</span><br><code>(name: string) =&gt; void</code> |  | [BaseViewModel](../baseviewmodel#action-setdisplayname) |
| <span id="action-setbodymounted">**setBodyMounted**</span><br><code>(flag: boolean) =&gt; void</code> | <span data-pagefind-ignore>See `bodyMounted`. Written by the view's container, which is the only thing that knows whether it rendered the body.</span> | [BaseViewModel](../baseviewmodel#action-setbodymounted) |
| <span id="action-setminimized">**setMinimized**</span><br><code>(flag: boolean) =&gt; void</code> |  | [BaseViewModel](../baseviewmodel#action-setminimized) |
