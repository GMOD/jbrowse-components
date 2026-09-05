---
id: svinspectorview
title: SvInspectorView
sidebar_label: View -> SvInspectorView
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the `sv-inspector` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sv-inspector/src/SvInspectorView/model.ts).

## Example usage

Hand-authored under `defaultSession.views`, with every setting written
directly on the view object. `uri` loads a structural-variant file into the
spreadsheet and mirrors the rows as arcs in the paired circular view;
`assembly` resolves coordinates for both:

```js
{
  type: 'SvInspectorView',
  assembly: 'hg38',
  uri: 'https://example.com/sv.vcf.gz',
  fileType: 'VCF',
}
```

does not extend, but is a combination of a
- [SpreadsheetView](../spreadsheetview)
- [CircularView](../circularview)

Members a composed model contributes are listed here too, so these tables are the whole surface.

## Properties

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  | SvInspectorView |
| <span id="property-type">**type**</span><br><code>type: types.literal('SvInspectorView')</code> |  | SvInspectorView |
| <span id="property-height">**height**</span><br><code>height: types.stripDefault(types.number, defaultHeight)</code> | the height of the whole view in pixels, sheet and circle together | SvInspectorView |
| <span id="property-onlydisplayrelevantregionsincircularview">**onlyDisplayRelevantRegionsInCircularView**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>onlyDisplayRelevantRegionsInCircularView: types.stripDefault( t…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>onlyDisplayRelevantRegionsInCircularView: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.boolean,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;false,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | restrict the circular half to the chromosomes the loaded rows actually touch, instead of drawing an arc for every one in the assembly | SvInspectorView |
| <span id="property-spreadsheetwidthfraction">**spreadsheetWidthFraction**</span><br><code>spreadsheetWidthFraction: types.stripDefault(types.number, 0.66)</code> | share of the view's width given to the spreadsheet, the rest goes to the circular view. Persisted so dragging the divider survives both a window resize and a session reload | SvInspectorView |
| <span id="property-spreadsheetview">**spreadsheetView**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>spreadsheetView: types.optional(SpreadsheetModel, () =&gt; Spreads…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>spreadsheetView: types.optional(SpreadsheetModel, () =&gt;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;SpreadsheetModel.create({&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;type: 'SpreadsheetView',&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;hideVerticalResizeHandle: true,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;}),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  | SvInspectorView |
| <span id="property-circularview">**circularView**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>circularView: types.optional(CircularModel, () =&gt; CircularModel…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>circularView: types.optional(CircularModel, () =&gt;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;CircularModel.create({&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;type: 'CircularView',&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;hideVerticalResizeHandle: true,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;disableImportForm: true,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;}),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  | SvInspectorView |
| <span id="property-launch">**launch**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>launch: types.frozen&lt; LaunchInput&lt;SvInspectorViewCommands&gt; &#124; un…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>launch: types.frozen&lt;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;LaunchInput&lt;SvInspectorViewCommands&gt; &#124; undefined&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&gt;()</code></pre></dialog></span> | transient launch state: the settings written on the view object that need resolving before they can be view state — the file both halves are built from and the assembly it is read against. `preProcessSnapshot` moves them here off the snapshot, the afterAttach autorun forwards them to the sheet and clears this, so a saved session never retains it. Not written by hand: author every setting directly on the view. | SvInspectorView |
| <span id="property-displayname">**displayName**</span><br><code>displayName: types.maybe(types.string)</code> | <span data-pagefind-ignore>displayName is displayed in the header of the view, or assembly names being used if none is specified</span> | [BaseViewModel](../baseviewmodel#property-displayname) |
| <span id="property-minimized">**minimized**</span><br><code>minimized: types.stripDefault(types.boolean, false)</code> | <span data-pagefind-ignore>collapse the view to its header bar, keeping it in the session rather than closing it</span> | [BaseViewModel](../baseviewmodel#property-minimized) |

## Volatiles

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="volatile-spreadsheetviewreactcomponent">**SpreadsheetViewReactComponent**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>SpreadsheetViewReactComponent: SpreadsheetViewType.ReactCompone…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>SpreadsheetViewReactComponent: SpreadsheetViewType.ReactComponent</code></pre></dialog></span> |  | SvInspectorView |
| <span id="volatile-circularviewreactcomponent">**CircularViewReactComponent**</span><br><code>CircularViewReactComponent: CircularViewType.ReactComponent</code> |  | SvInspectorView |
| <span id="volatile-width">**width**</span><br><code>width: 800</code> |  | [BaseViewModel](../baseviewmodel#volatile-width) |
| <span id="volatile-bodymounted">**bodyMounted**</span><br><code>bodyMounted: true</code> | <span data-pagefind-ignore>Whether the container has this view's body in the DOM.<br><br>`ViewContainer` mounts a view's body only while an IntersectionObserver says it is on screen, to hold the app under the WebGL2 context ceiling (`reference/GPU_CONTEXT_BUDGET.md`). A view below the fold therefore has no canvas, so nothing ever calls `markCanvasDrawn` and the pre-first-paint term of `displayPhase` pins every display in it at `loading` with nothing left to resolve it — which parks `[data-app-phase="ready"]` for the whole app on a view the user cannot see.<br><br>Defaults true so the containers that always mount a body — embedded views, workspace panels, and any test rendering a display directly — are unaffected and need not set it.<br><br>The raw flag, written by this view's own container. A display asks `effectiveBodyMounted` instead, because a nested view has no container of its own.</span> | [BaseViewModel](../baseviewmodel#volatile-bodymounted) |

## Getters

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="getter-pendinglaunch">**pendingLaunch**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>LaunchInput&lt;SvInspectorViewCommands &amp; { unknown?: Record&lt;…&gt; &#124; u…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>LaunchInput&lt;SvInspectorViewCommands &amp; { unknown?: Record&lt;…&gt; &#124; undefined; malformed?: Record&lt;…&gt; &#124; undefined; legacyInit?: boolean &#124; undefined; } &amp; IStateTreeNode&lt;...&gt;&gt; &#124; undefined</code></pre></dialog></span> | the launch state that still has something to apply — what the afterAttach autorun forwards to the sheet. | SvInspectorView |
| <span id="getter-currentassembly">**currentAssembly**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { error: unknown; loadingP: Promis…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { error: unknown; loadingP: Promise&lt;…&gt; &#124; undefined; ... 10 more ...; refNameMismatches: Map&lt;…&gt;; } &amp; ... 13 more ... &amp; IStateTreeNode&lt;...&gt;) &#124; undefined</code></pre></dialog></span> |  | SvInspectorView |
| <span id="getter-assemblyname">**assemblyName**</span><br><code>string &#124; undefined</code> |  | SvInspectorView |
| <span id="getter-showcircularview">**showCircularView**</span><br><code>boolean</code> | gated on the same condition the spreadsheet renders its grid on, so the circle never appears alongside the import form | SvInspectorView |
| <span id="getter-showloading">**showLoading**</span><br><code>boolean</code> | Named to match the other views, which is what `ViewContainer` reads to publish `data-view-phase`. Folds in both halves because neither publishes its own: the child views are rendered directly by this component rather than through a ViewContainer, so a spreadsheet still parsing or a circle still waiting on its assembly was invisible to every readiness wait, and `website/scripts/specs/sv.ts` captures five figures of this view.<br><br>The circular term is gated on `showCircularView` so a circle that isn't rendered can never hold the phase open — `waitForViewPhases` is deliberately not best-effort, so a phase that never clears is a hang rather than a degraded capture. | SvInspectorView |
| <span id="getter-features">**features**</span><br><code>SimpleFeatureSerialized[]</code> |  | SvInspectorView |
| <span id="getter-featurerefnames">**featureRefNames**</span><br><code>string[]</code> | every refName the features' chords land on, both ends included | SvInspectorView |
| <span id="getter-canonicalfeaturerefnameset">**canonicalFeatureRefNameSet**</span><br><code>Set&lt;string&gt;</code> |  | SvInspectorView |
| <span id="getter-circulardisplayedregions">**circularDisplayedRegions**</span><br><code>BasicRegion[] &#124; undefined</code> | the regions the paired circular view should show, never narrowed to nothing: the relevant-set is empty until the features are parsed, and can also miss every region outright, since getCanonicalRefName2 hands back a refName the assembly doesn't know rather than dropping it. Both show everything rather than an empty circle | SvInspectorView |
| <span id="getter-subviewwidths">**subviewWidths**</span><br><code>{ spreadsheet: number; circular: number; }</code> | the two subview widths, with the divider taken out of the total first: the two plus the divider have to add up to our own width, or the flex row overflows and squeezes the circle.<br><br>The fraction is clamped on read as well as on write, so a session carrying an out-of-range one (hand-authored, or from a future default) can't drive the circle under the width floor it clamps itself to | SvInspectorView |
| <span id="getter-varianttrackid">**variantTrackId**</span><br><code>string</code> |  | SvInspectorView |
| <span id="getter-featurescirculartrackconfiguration">**featuresCircularTrackConfiguration**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ type: string; trackId: string; name: string; adapter: {…}; as…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ type: string; trackId: string; name: string; adapter: {…}; assemblyNames: string[]; displays: {…}[]; } &#124; undefined</code></pre></dialog></span> | undefined until the sheet has an assembly to resolve coordinates against, which is also when the paired circular view has nothing to draw the chords on | SvInspectorView |
| <span id="getter-effectivebodymounted">**effectiveBodyMounted**</span><br><code>boolean</code> | <span data-pagefind-ignore>Whether this view's body is in the DOM, counting the views it is nested inside — which is the question a display's phase actually asks.<br><br>`bodyMounted` alone answers it only for a view a container renders directly. A view nested in another view (a synteny row, a breakpoint panel) has no container writing its flag, so it reads `true` forever while its whole subtree is out of the DOM, and every display in it waits for a first paint that nothing will make — the hang this flag exists to prevent, one level down.<br><br>An ancestor that does not carry the flag at all leaves the answer alone rather than excusing the paint: only an explicit `false` unmounts, so a duck-typed stand-in that forgot it keeps waiting, which is the failure that shows up as a slow test rather than as a picture of an empty view.</span> | [BaseViewModel](../baseviewmodel#getter-effectivebodymounted) |
| <span id="getter-owntracks">**ownTracks**</span><br><code>AbstractTrackModel[]</code> | <span data-pagefind-ignore>The tracks this view puts in the census — its own, not a nested view's.<br><br>Empty here, and overridden by the views that have any: the base cannot read `self.tracks` for them, because what a view keeps under that name is the view's business. react-msaview's holds its MSA annotation rows — `{ReactComponent, model}` objects with no configuration and no displays — and a base that helped itself to them handed them to the readiness marker as tracks, which error-paged every session holding an MSA view.</span> | [BaseViewModel](../baseviewmodel#getter-owntracks) |
| <span id="getter-ownviews">**ownViews**</span><br><code>AbstractViewModel[]</code> | <span data-pagefind-ignore>The views nested directly inside this one, which the census counts as views in their own right — a synteny stack's genome rows, a breakpoint split view's panels.<br><br>Empty here for the same reason, and the dotplot is why it has to be a declaration rather than a walk of `views`: that prop name holds its two 1D *axis* models, which are view-shaped and are not views the user opened. No structural test separates the two — only the view knows.</span> | [BaseViewModel](../baseviewmodel#getter-ownviews) |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-menuitems">**menuItems**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>() =&gt; { label: string; icon: OverridableComponent&lt;SvgIconTypeMa…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>() =&gt; { label: string; icon: OverridableComponent&lt;SvgIconTypeMap&lt;{}, "svg"&gt;&gt; &amp; { muiName: string; }; onClick: () =&gt; void; }[]</code></pre></dialog></span> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-setheight">**setHeight**</span><br><code>(newHeight: number) =&gt; number</code> |  | SvInspectorView |
| <span id="action-setonlydisplayrelevantregionsincircularview">**setOnlyDisplayRelevantRegionsInCircularView**</span><br><code>(val: boolean) =&gt; void</code> |  | SvInspectorView |
| <span id="action-resizespreadsheetwidth">**resizeSpreadsheetWidth**</span><br><code>(distance: number) =&gt; void</code> | move the divider between the two subviews. Stored as a fraction so the width binding can reapply it, rather than resizing the subviews directly and having the next parent resize overwrite it.<br><br>The delta accumulates onto the fraction rather than being read back off spreadsheetView.width: the binding writes a rounded, divider-adjusted width there, so a round trip through it lost a pixel on every drag frame and the divider crept left even while the pointer was still | SvInspectorView |
| <span id="action-setlaunch">**setLaunch**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(launch?: LaunchInput&lt;SvInspectorViewCommands&gt; &#124; undefined) =&gt;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(launch?: LaunchInput&lt;SvInspectorViewCommands&gt; &#124; undefined) =&gt; void</code></pre></dialog></span> |  | SvInspectorView |
| <span id="action-resizeheight">**resizeHeight**</span><br><code>(distance: number) =&gt; number</code> |  | SvInspectorView |
| <span id="action-setdisplayname">**setDisplayName**</span><br><code>(name: string) =&gt; void</code> |  | [BaseViewModel](../baseviewmodel#action-setdisplayname) |
| <span id="action-setwidth">**setWidth**</span><br><code>(newWidth: number) =&gt; void</code> | <span data-pagefind-ignore>width is an important attribute of the view model, when it becomes set, it often indicates when the app can start drawing to it. certain views like lgv are strict about this because if it tries to draw before it knows the width it should draw to, it may start fetching data for regions it doesn't need to<br><br>setWidth is updated by a ResizeObserver generally, the views often need to know how wide they are to properly draw genomic regions</span> | [BaseViewModel](../baseviewmodel#action-setwidth) |
| <span id="action-setbodymounted">**setBodyMounted**</span><br><code>(flag: boolean) =&gt; void</code> | <span data-pagefind-ignore>See `bodyMounted`. Written by the view's container, which is the only thing that knows whether it rendered the body.</span> | [BaseViewModel](../baseviewmodel#action-setbodymounted) |
| <span id="action-setminimized">**setMinimized**</span><br><code>(flag: boolean) =&gt; void</code> |  | [BaseViewModel](../baseviewmodel#action-setminimized) |
