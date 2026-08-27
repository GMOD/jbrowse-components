---
id: breakpointsplitview
title: BreakpointSplitView
sidebar_label: View -> BreakpointSplitView
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`breakpoint-split-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/breakpoint-split-view/src/BreakpointSplitView/model.ts).

## Example usage

Hand-authored under `defaultSession.views`. `init` is an array — one entry per
stacked panel — each declaring the `assembly`, a `loc`, and the `tracks` to
show. The two panels flank a structural-variant breakpoint:

```js
{
  type: 'BreakpointSplitView',
  init: [
    { assembly: 'hg38', loc: 'chr1:1,000,000-1,100,000', tracks: ['alignments'] },
    { assembly: 'hg38', loc: 'chr5:2,000,000-2,100,000', tracks: ['alignments'] },
  ],
}
```

Each `tracks` entry can also be a `{ trackId, displaySnapshot }` object to set
per-panel display options (e.g. a shorter alignments height).

Members a composed model contributes are listed here too, so these tables are
the whole surface.

## Properties

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal('BreakpointSplitView')</code> |  | BreakpointSplitView |
| <span id="property-height">**height**</span><br><code>height: types.stripDefault(types.number, defaultHeight)</code> | the height of the whole view in pixels, panels and overlay together | BreakpointSplitView |
| <span id="property-showintraviewlinks">**showIntraviewLinks**</span><br><code>showIntraviewLinks: types.stripDefault(types.boolean, true)</code> | draw the links whose two ends land in the same panel, as well as the ones that cross between panels | BreakpointSplitView |
| <span id="property-linkviews">**linkViews**</span><br><code>linkViews: types.stripDefault(types.boolean, false)</code> | sync scroll and zoom across the panels, so panning one pans them all | BreakpointSplitView |
| <span id="property-interactiveoverlay">**interactiveOverlay**</span><br><code>interactiveOverlay: types.stripDefault(types.boolean, true)</code> | make the alignment squiggles drawn between the panels clickable, rather than a static overlay | BreakpointSplitView |
| <span id="property-showheader">**showHeader**</span><br><code>showHeader: types.stripDefault(types.boolean, true)</code> | show the view's own header bar, above the panels' own | BreakpointSplitView |
| <span id="property-views">**views**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>views: types.array( pluginManager.getViewType('LinearGenomeView…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>views: types.array(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.getViewType('LinearGenomeView')&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;.stateModel as LinearGenomeViewStateModel,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  | BreakpointSplitView |
| <span id="property-init">**init**</span><br><code>init: types.frozen&lt;BreakpointSplitViewInitView[] &#124; undefined&gt;()</code> | declarative child panels (loc/assembly/tracks) resolved into `views` once the view has a width; used for initializing from a session snapshot. Transient — stripped by postProcessSnapshot. | BreakpointSplitView |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  | [BaseViewModel](../baseviewmodel#property-id) |
| <span id="property-displayname">**displayName**</span><br><code>displayName: types.maybe(types.string)</code> | <span data-pagefind-ignore>displayName is displayed in the header of the view, or assembly names being used if none is specified</span> | [BaseViewModel](../baseviewmodel#property-displayname) |
| <span id="property-minimized">**minimized**</span><br><code>minimized: types.stripDefault(types.boolean, false)</code> | <span data-pagefind-ignore>collapse the view to its header bar, keeping it in the session rather than closing it</span> | [BaseViewModel](../baseviewmodel#property-minimized) |

## Volatiles

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="volatile-width">**width**</span><br><code>width: 800</code> |  | BreakpointSplitView |
| <span id="volatile-matchedtrackfeatures">**matchedTrackFeatures**</span><br><code>matchedTrackFeatures: {}</code> |  | BreakpointSplitView |
| <span id="volatile-reloadcounter">**reloadCounter**</span><br><code>reloadCounter: 0</code> | The pure "go again" signal the shared fetch skeleton reads above every gate, bumped by `reload()`: after a failure every other input of the overlay fetch is unchanged, so nothing else can rewake it. The Retry on the failure notification is what spends it. | BreakpointSplitView |
| <span id="volatile-fetchstatus">**fetchStatus**</span><br><code>fetchStatus: createStatusChannel()</code> | What the overlay-feature fetch is doing, for the corner chip. A `StatusChannel` rather than the `statusMessage`/`statusProgress`/ `setStatusMessage` trio a display declares: this is a view with one operation to narrate, and the trio is a status vocabulary it has no other use for. | BreakpointSplitView |
| <span id="volatile-hoveredoverlay">**hoveredOverlay**</span><br><code>hoveredOverlay: undefined</code> | Which overlay curve the pointer is on, and the reason it lives here rather than in each overlay's React state: a hover the viewport can invalidate needs one place to be cleared from, which is what `overlayTransformKey` and the `afterAttach` reaction give it. | BreakpointSplitView |
| <span id="volatile-bodymounted">**bodyMounted**</span><br><code>bodyMounted: true</code> | <span data-pagefind-ignore>Whether the container has this view's body in the DOM.<br><br>`ViewContainer` mounts a view's body only while an IntersectionObserver says it is on screen, to hold the app under the WebGL2 context ceiling (`reference/GPU_CONTEXT_BUDGET.md`). A view below the fold therefore has no canvas, so nothing ever calls `markCanvasDrawn` and the pre-first-paint term of `displayPhase` pins every display in it at `loading` with nothing left to resolve it — which parks `[data-app-phase="ready"]` for the whole app on a view the user cannot see.<br><br>Defaults true so the containers that always mount a body — embedded views, workspace panels, and any test rendering a display directly — are unaffected and need not set it.<br><br>The raw flag, written by this view's own container. A display asks `effectiveBodyMounted` instead, because a nested view has no container of its own.</span> | [BaseViewModel](../baseviewmodel#volatile-bodymounted) |

## Getters

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="getter-scrollzoom">**scrollZoom**</span><br><code>boolean</code> | scroll-to-zoom is a global, personal preference resolved from the session; toggling it in any view applies everywhere | BreakpointSplitView |
| <span id="getter-hassomethingtoshow">**hasSomethingToShow**</span><br><code>boolean</code> |  | BreakpointSplitView |
| <span id="getter-initialized">**initialized**</span><br><code>boolean</code> |  | BreakpointSplitView |
| <span id="getter-error">**error**</span><br><code>unknown</code> | Resolved, like LGV's and linear-comparative's: it folds in the sub-views, whose assemblies are what `initialized` waits on. Without them a failed assembly leaves `initialized` false forever with nothing to report, and an SVG export waiting on it hangs behind the dialog's spinner instead of raising the error (see `awaitViewInitialized`). | BreakpointSplitView |
| <span id="getter-showloading">**showLoading**</span><br><code>boolean</code> | Spinner instead of content, i.e. sub-views exist but haven't loaded their assemblies yet. Named to match LGV/dotplot/synteny/circular, which is what ViewContainer reads to publish `data-view-phase`. | BreakpointSplitView |
| <span id="getter-loadingassembly">**loadingAssembly**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { error: unknown; loadingP: Promis…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; { error: unknown; loadingP: Promise&lt;…&gt; &#124; undefined; ... 10 more ...; refNameMismatches: Map&lt;…&gt;; } &amp; ... 13 more ... &amp; IStateTreeNode&lt;...&gt;) &#124; undefined</code></pre></dialog></span> | The assembly whose load the spinner is waiting on. Delegated to the first sub-view that hasn't initialized, since each LGV already resolves this for itself; before the sub-views exist, `init` is what names them. | BreakpointSplitView |
| <span id="getter-loadingmessage">**loadingMessage**</span><br><code>string &#124; undefined</code> | What the spinner says: which of the assembly's files is downloading, rather than a bare "Loading" for the slow part of startup. See agent-docs/reference/PROGRESS_REPORTING.md. | BreakpointSplitView |
| <span id="getter-loadingprogress">**loadingProgress**</span><br><code>number &#124; undefined</code> | Determinate fraction for the spinner's bar, when the assembly load reports one | BreakpointSplitView |
| <span id="getter-loadingsource">**loadingSource**</span><br><code>string &#124; undefined</code> | The URL the assembly load is currently fetching, when the phase named one. Only the stalled-load notice reads it — see `ViewLoadingScreen`. | BreakpointSplitView |
| <span id="getter-showimportform">**showImportForm**</span><br><code>boolean</code> | A failed assembly counts: the views it left behind never initialize, so there is nothing to show and no second attempt coming in this session. The form — which reports `error` in its banner — is then the only way forward, matching LGV/synteny/dotplot/circular rather than spinning on a `showLoading` that can never resolve. | BreakpointSplitView |
| <span id="getter-assemblies">**assemblies**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>((ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; ... 13 more ... &amp; IStateTre…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>((ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; ... 13 more ... &amp; IStateTreeNode&lt;…&gt;) &#124; undefined)[]</code></pre></dialog></span> | One assembly per row, index-aligned with `views`.<br><br>Per row and not one for the view, because the rows are independently assembly-picked (the import form has an assembly selector per row, and `init` carries one per entry). Resolving every row's refNames through row 0's assembly is right only while they all name the same one: on a genuinely cross-assembly view the strict resolver answers `undefined` for every contig belonging to any other row, and the overlay drew NO connectors at all.<br><br>A row whose assembly has not loaded is `undefined` rather than a hole, so a level index stays a level index; its features drop, which is what an unresolvable refName does anyway. | BreakpointSplitView |
| <span id="getter-matchedtracks">**matchedTracks**</span><br><code>OverlayTrack[]</code> | Find all track ids that match across multiple views, or return just the single view's track if only a single row is used | BreakpointSplitView |
| <span id="getter-fetchinert">**fetchInert**</span><br><code>boolean</code> | Same name and same meaning as `FetchMixin.fetchInert`, on a view rather than a display: with nothing matched across the rows there is nothing for the overlay fetch to ask for, so the dev-only retry check the fetch skeleton installs must not call that decline a dead Retry. | BreakpointSplitView |
| <span id="getter-overlaytransformkey">**overlayTransformKey**</span><br><code>string</code> | Every number that moves the overlay under a stationary cursor, in one value — what `installClearHoverOnSurfaceMove` watches.<br><br>Per row, `offsetPx` and `bpPerPx`, which covers a pan or a zoom from any entry point: the wheel, the header buttons, a locstring search, or a `linkViews` echo of the row next to it. Per matched track and per row, the body's `scrollTop` and `height`, since a pileup scrolls and a track resizes under a pointer that never moved, plus `regionTooLarge`, whose flip swaps the body for the banner and back.<br><br>Scoped to the matched tracks rather than every track in the view: an unrelated track finishing its first render resizes nothing the overlay draws on, and clearing the hover for it would read as a flicker. | BreakpointSplitView |
| <span id="getter-matchedtrackchunks">**matchedTrackChunks**</span><br><code>Map&lt;string, MatchedChunks&gt;</code> | Classifies each matched track and pairs its features, keyed by trackId. Everything here is a function of the fetched features alone, so it is deliberately kept out of `overlayMatches`, which additionally reads each track's layout: the layout reads invalidate on a track resize or a compactness change, and fusing the two would re-run this whole pass — including the SA-chain parse, the expensive part — on every drag frame. | BreakpointSplitView |
| <span id="getter-overlaymatches">**overlayMatches**</span><br><code>Map&lt;string, OverlayMatch&gt;</code> | Zero-arg cached getter: resolves each matched chunk's features to layout rectangles, returning a Map keyed by trackId. Mobx caches this across renders and only invalidates when the underlying feature or layout reads change — so scrolling within already-loaded data does NOT trigger a re-lookup. | BreakpointSplitView |
| <span id="getter-effectivebodymounted">**effectiveBodyMounted**</span><br><code>boolean</code> | <span data-pagefind-ignore>Whether this view's body is in the DOM, counting the views it is nested inside — which is the question a display's phase actually asks.<br><br>`bodyMounted` alone answers it only for a view a container renders directly. A view nested in another view (a synteny row, a breakpoint panel) has no container writing its flag, so it reads `true` forever while its whole subtree is out of the DOM, and every display in it waits for a first paint that nothing will make — the hang this flag exists to prevent, one level down.<br><br>An ancestor that does not carry the flag at all leaves the answer alone rather than excusing the paint: only an explicit `false` unmounts, so a duck-typed stand-in that forgot it keeps waiting, which is the failure that shows up as a slow test rather than as a picture of an empty view.</span> | [BaseViewModel](../baseviewmodel#getter-effectivebodymounted) |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-exportsvg">**exportSvg**</span><br><code>(opts?: ExportSvgOptions) =&gt; Promise&lt;void&gt;</code> | creates an svg export and save using FileSaver |
| <span id="method-getmatchedtracks">**getMatchedTracks**</span><br><code>(trackConfigId: string) =&gt; OverlayTrack[]</code> | Get tracks with a given trackId across multiple views. Callers that index the result by view level (getTrackOverlayData, getMatchedFeaturesInLayout) rely on it staying aligned with `views` — which holds only because overlays are driven by `overlayMatches`, whose trackIds come from `matchedTracks` (the intersect across all views), so the track is present in every view and `filter` drops nothing. Don't level-index the result for an arbitrary trackId. |
| <span id="method-gettrackoverlaydata">**getTrackOverlayData**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackId: string, yOffsetsOverride?: number[] &#124; undefined, domY…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackId: string, yOffsetsOverride?: number[] &#124; undefined, domYOffsets?: (number &#124; undefined)[] &#124; undefined) =&gt; {…}</code></pre></dialog></span> | Per-render precompute for an overlay track. Resolves an OverlayLevel of geometry per view level, then returns getX/getY closures for converting feature layout records to SVG coordinates.<br><br>`yOffsetsOverride` — SVG export: fixed track tops, scrollTops zeroed. `domYOffsets` — live rendering: DOM-measured track tops (relative to the overlay SVG), scrollTops still read from model. |
| <span id="method-getmatchedfeaturesinlayout">**getMatchedFeaturesInLayout**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackConfigId: string, features: Feature[][]) =&gt; { feature: Fe…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackConfigId: string, features: Feature[][]) =&gt; { feature: Feature; layout: LayoutRecord; level: number; clipLengthAtStartOfRead: number; }[][]</code></pre></dialog></span> |  |
| <span id="method-menuitems">**menuItems**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>() =&gt; ({…} &#124; {…} &#124; { label: string; icon: OverridableComponent&lt;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>() =&gt; ({…} &#124; {…} &#124; { label: string; icon: OverridableComponent&lt;…&gt; &amp; { ...; }; onClick: () =&gt; void; subMenu?: undefined; } &#124; { ...; })[]</code></pre></dialog></span> |  |
| <span id="method-rubberbandmenuitems">**rubberBandMenuItems**</span><br><code>() =&gt; { label: string; onClick: () =&gt; void; }[]</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-setwidth">**setWidth**</span><br><code>(newWidth: number) =&gt; void</code> |  | BreakpointSplitView |
| <span id="action-sethoveredoverlay">**setHoveredOverlay**</span><br><code>(arg: OverlayHover &#124; undefined) =&gt; void</code> | `undefined` when the pointer leaves a curve, and when the picture moves out from under it — see `overlayTransformKey`. | BreakpointSplitView |
| <span id="action-setinteractiveoverlay">**setInteractiveOverlay**</span><br><code>(arg: boolean) =&gt; void</code> |  | BreakpointSplitView |
| <span id="action-setshowintraviewlinks">**setShowIntraviewLinks**</span><br><code>(arg: boolean) =&gt; void</code> |  | BreakpointSplitView |
| <span id="action-setlinkviews">**setLinkViews**</span><br><code>(arg: boolean) =&gt; void</code> |  | BreakpointSplitView |
| <span id="action-setscrollzoom">**setScrollZoom**</span><br><code>(arg: boolean) =&gt; void</code> |  | BreakpointSplitView |
| <span id="action-setshowheader">**setShowHeader**</span><br><code>(arg: boolean) =&gt; void</code> |  | BreakpointSplitView |
| <span id="action-setmatchedtrackfeatures">**setMatchedTrackFeatures**</span><br><code>(obj: Record&lt;string, Feature[][]&gt;) =&gt; void</code> |  | BreakpointSplitView |
| <span id="action-reload">**reload**</span><br><code>() =&gt; void</code> | Re-run the overlay-feature fetch with no input change — what the Retry on its failure notification calls. | BreakpointSplitView |
| <span id="action-reversevieworder">**reverseViewOrder**</span><br><code>() =&gt; void</code> |  | BreakpointSplitView |
| <span id="action-squareview">**squareView**</span><br><code>() =&gt; void</code> |  | BreakpointSplitView |
| <span id="action-setinit">**setInit**</span><br><code>(init?: BreakpointSplitViewInitView[] &#124; undefined) =&gt; void</code> |  | BreakpointSplitView |
| <span id="action-setviews">**setViews**</span><br><code>(viewInits: BreakpointSplitViewInitView[]) =&gt; void</code> |  | BreakpointSplitView |
| <span id="action-setdisplayname">**setDisplayName**</span><br><code>(name: string) =&gt; void</code> |  | [BaseViewModel](../baseviewmodel#action-setdisplayname) |
| <span id="action-setbodymounted">**setBodyMounted**</span><br><code>(flag: boolean) =&gt; void</code> | <span data-pagefind-ignore>See `bodyMounted`. Written by the view's container, which is the only thing that knows whether it rendered the body.</span> | [BaseViewModel](../baseviewmodel#action-setbodymounted) |
| <span id="action-setminimized">**setMinimized**</span><br><code>(flag: boolean) =&gt; void</code> |  | [BaseViewModel](../baseviewmodel#action-setminimized) |
