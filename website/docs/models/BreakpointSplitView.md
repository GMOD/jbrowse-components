---
id: breakpointsplitview
title: BreakpointSplitView
description: "Properties, getters and actions of the BreakpointSplitView state model."
sidebar_label: View -> BreakpointSplitView
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `breakpoint-split-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/breakpoint-split-view/src/BreakpointSplitView/model.ts).

## Example usage

Hand-authored under `defaultSession.views`, with every setting written
directly on the view object. `views` is one entry per stacked panel, each
declaring the `assembly`, a `loc`, and the `tracks` to show. The two panels
flank a structural-variant breakpoint:

```js
{
  type: 'BreakpointSplitView',
  views: [
    { assembly: 'hg38', loc: 'chr1:1,000,000-1,100,000', tracks: ['alignments'] },
    { assembly: 'hg38', loc: 'chr5:2,000,000-2,100,000', tracks: ['alignments'] },
  ],
}
```

Each `tracks` entry can also be a `{ trackId, displaySnapshot }` object to
set per-panel display options (e.g. a shorter alignments height).

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal('BreakpointSplitView')</code> |  |
| <span id="property-height">**height**</span><br><code>height: types.stripDefault(types.number, defaultHeight)</code> | the height of the whole view in pixels, panels and overlay together |
| <span id="property-showintraviewlinks">**showIntraviewLinks**</span><br><code>showIntraviewLinks: types.stripDefault(types.boolean, true)</code> | draw the links whose two ends land in the same panel, as well as the ones that cross between panels |
| <span id="property-linkviews">**linkViews**</span><br><code>linkViews: types.stripDefault(types.boolean, false)</code> | sync scroll and zoom across the panels, so panning one pans them all |
| <span id="property-interactiveoverlay">**interactiveOverlay**</span><br><code>interactiveOverlay: types.stripDefault(types.boolean, true)</code> | make the alignment squiggles drawn between the panels clickable, rather than a static overlay |
| <span id="property-showheader">**showHeader**</span><br><code>showHeader: types.stripDefault(types.boolean, true)</code> | show the view's own header bar, above the panels' own |
| <span id="property-views">**views**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>views: types.array( pluginManager.getViewType('LinearGenomeView…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>views: types.array(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.getViewType('LinearGenomeView').stateModel,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="property-launch">**launch**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>launch: types.frozen&lt; LaunchInput&lt;BreakpointSplitViewCommands&gt;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>launch: types.frozen&lt;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;LaunchInput&lt;BreakpointSplitViewCommands&gt; &#124; undefined&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&gt;()</code></pre></dialog></span> | transient launch state: the declarative panels written on the view object as `views`, which need a measured width before they can be built rows. `preProcessSnapshot` moves them here off the snapshot, the afterAttach autorun applies them and clears this, so a saved session never retains it. Not written by hand: author every setting directly on the view. |

<span data-pagefind-ignore>From [BaseViewModel](../baseviewmodel): <span id="property-id">[`id`](../baseviewmodel#property-id)</span>, <span id="property-displayname">[`displayName`](../baseviewmodel#property-displayname)</span>, <span id="property-minimized">[`minimized`](../baseviewmodel#property-minimized)</span></span>

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-width">**width**</span><br><code>number</code> |  |
| <span id="volatile-matchedtrackfeatures">**matchedTrackFeatures**</span><br><code>Record&lt;string, Feature[][]&gt;</code> |  |
| <span id="volatile-reloadcounter">**reloadCounter**</span><br><code>number</code> | The pure "go again" signal the shared fetch skeleton reads above every gate, bumped by `reload()`: after a failure every other input of the overlay fetch is unchanged, so nothing else can rewake it. The Retry on the failure notification is what spends it. |
| <span id="volatile-fetchstatus">**fetchStatus**</span><br><code>StatusChannel</code> | What the overlay-feature fetch is doing, for the corner chip. A `StatusChannel` rather than the `statusMessage`/`statusProgress`/ `setStatusMessage` trio a display declares: this is a view with one operation to narrate, and the trio is a status vocabulary it has no other use for. |
| <span id="volatile-hoveredoverlay">**hoveredOverlay**</span><br><code>OverlayHover &#124; undefined</code> | Which overlay curve the pointer is on, and the reason it lives here rather than in each overlay's React state: a hover the viewport can invalidate needs one place to be cleared from, and `overlayTransformKey` and the `afterAttach` reaction clear it here. |

<span data-pagefind-ignore>From [BaseViewModel](../baseviewmodel): <span id="volatile-bodymounted">[`bodyMounted`](../baseviewmodel#volatile-bodymounted)</span></span>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-ownviews">**ownViews**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…}…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; { rubberbandClickMenuItems(clickOffset: BpOffset): MenuItem[]; highlightMenuItems(_highlight: HighlightType): MenuItem[]; } &amp; { flyTo: (centerBp: number, windowWidthBp: number) =&gt; void; flyToCenter(coord: number, refName: string, displayedRegionIndex?: number &#124; undefined): void; flyToFit(centerBp: number, fitWidthBp: number): void; } &amp; { afterCreate(): void; afterAttach(): void; } &amp; IStateTreeNode&lt;…&gt;)[]</code></pre></dialog></span> | The census entry for this view: its panels are views in their own right, and it holds no tracks outside them. |
| <span id="getter-scrollzoom">**scrollZoom**</span><br><code>boolean</code> | scroll-to-zoom is a global, personal preference resolved from the session; toggling it in any view applies everywhere |
| <span id="getter-pendinglaunch">**pendingLaunch**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>LaunchInput&lt;BreakpointSplitViewCommands &amp; { unknown?: Record&lt;st…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>LaunchInput&lt;BreakpointSplitViewCommands &amp; { unknown?: Record&lt;string, unknown&gt; &#124; undefined; malformed?: Record&lt;string, unknown&gt; &#124; undefined; legacyInit?: boolean &#124; undefined; } &amp; IStateTreeNode&lt;IType&lt;LaunchInput&lt;BreakpointSplitViewCommands&gt; &#124; undefined, LaunchInput&lt;BreakpointSplitViewCommands&gt; &#124; undefined, LaunchInput&lt;BreakpointSplitViewCommands&gt; &#124; undefined&gt;&gt;&gt; &#124; undefined</code></pre></dialog></span> | the launch state that still has something to apply — the gate the loading and import-form paths below read. |
| <span id="getter-hassomethingtoshow">**hasSomethingToShow**</span><br><code>boolean</code> |  |
| <span id="getter-initialized">**initialized**</span><br><code>boolean</code> | True on the import form too: with no panels and none pending there is nothing left to initialize, and `AppReadyMarker` reads a false here as the app still loading — which held `data-app-phase` at `loading` for as long as an empty split view stayed open. |
| <span id="getter-error">**error**</span><br><code>unknown</code> | Resolved, like LGV's and linear-comparative's: it folds in the sub-views, whose assemblies are what `initialized` waits on. Without them a failed assembly leaves `initialized` false forever with nothing to report, and an SVG export waiting on it hangs behind the dialog's spinner instead of raising the error (see `awaitViewInitialized`). |
| <span id="getter-showloading">**showLoading**</span><br><code>boolean</code> | Spinner instead of content, i.e. sub-views exist but haven't loaded their assemblies yet. Named to match LGV/dotplot/synteny/circular, since ViewContainer reads this name to publish `data-view-phase`. |
| <span id="getter-loadingassembly">**loadingAssembly**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…}…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; { getCanonicalRefName2(refName: string): string; isValidRefName(refName: string): boolean; } &amp; { isCircularRefName(refName: string): boolean; getRefNamePosition(refName: string): number &#124; undefined; getAliasesForRefName(refName: string): string[]; getRefNameMapForAdapter(adapterConf: AdapterConf, options: BaseOptions): Promise&lt;…&gt;; getRefNameMismatch(adapterCacheKey: string): RefNameMismatch &#124; undefined; } &amp; IStateTreeNode&lt;…&gt;) &#124; undefined</code></pre></dialog></span> | The assembly whose load the spinner is waiting on. Delegated to the first sub-view that hasn't initialized, since each LGV already resolves this for itself; before the sub-views exist, `init` is what names them. |
| <span id="getter-loading">**loading**</span><br><code>ViewLoading &#124; undefined</code> | What the loading screen says while `showLoading`, read off the assembly whose load is the wait; undefined otherwise. |
| <span id="getter-showimportform">**showImportForm**</span><br><code>boolean</code> | A failed assembly counts: the views it left behind never initialize, so there is nothing to show and no second attempt coming in this session. The form — which reports `error` in its banner — is then the only way forward, matching LGV/synteny/dotplot/circular rather than spinning on a `showLoading` that can never resolve. |
| <span id="getter-assemblies">**assemblies**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>((ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…}…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>((ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; { getCanonicalRefName2(refName: string): string; isValidRefName(refName: string): boolean; } &amp; { isCircularRefName(refName: string): boolean; getRefNamePosition(refName: string): number &#124; undefined; getAliasesForRefName(refName: string): string[]; getRefNameMapForAdapter(adapterConf: AdapterConf, options: BaseOptions): Promise&lt;…&gt;; getRefNameMismatch(adapterCacheKey: string): RefNameMismatch &#124; undefined; } &amp; IStateTreeNode&lt;…&gt;) &#124; undefined)[]</code></pre></dialog></span> | One assembly per row, index-aligned with `views`.<br><br>Per row and not one for the view, because the rows are independently assembly-picked (the import form has an assembly selector per row, and `init` carries one per entry). Resolving every row's refNames through row 0's assembly is right only while they all name the same one: on a genuinely cross-assembly view the strict resolver answers `undefined` for every contig belonging to any other row, and the overlay drew NO connectors at all.<br><br>A row whose assembly has not loaded is `undefined` rather than a hole, so a level index stays a level index; its features drop, as they do for any unresolvable refName. |
| <span id="getter-matchedtracks">**matchedTracks**</span><br><code>OverlayTrack[]</code> | Find all track ids that match across multiple views, or return just the single view's track if only a single row is used |
| <span id="getter-overlaytracks">**overlayTracks**</span><br><code>OverlayTrack[]</code> | The matched tracks the overlay draws for — alignments and variants. |
| <span id="getter-fetchedtracks">**fetchedTracks**</span><br><code>OverlayTrack[]</code> | The overlay tracks the overlay fetch asks for: the variant tracks. An alignments track's reads come off its own display instead. |
| <span id="getter-fetchinert">**fetchInert**</span><br><code>boolean</code> | Same name and same meaning as `FetchMixin.fetchInert`, on a view rather than a display: with no variant track matched across the rows there is nothing for the overlay fetch to ask for, so `prepare` declines instead of running an empty fetch and commit on every pan. |
| <span id="getter-overlaytransformkey">**overlayTransformKey**</span><br><code>string</code> | Every number that moves the overlay under a stationary cursor, in one value — what `installClearHoverOnSurfaceMove` watches.<br><br>Per row, `offsetPx` and `bpPerPx`, which covers a pan or a zoom from any entry point: the wheel, the header buttons, a locstring search, or a `linkViews` echo of the row next to it. Per matched track and per row, where the track sits and the body's `scrollTop` and `height`, since a pileup scrolls and a track above it resizes under a pointer that never moved, plus `regionTooLarge`, whose flip swaps the body for the banner and back.<br><br>Scoped to what places the overlay tracks: a track below them growing moves nothing the overlay draws on, and clearing the hover for it would read as a flicker. |
| <span id="getter-variantjunctionsbytrack">**variantJunctionsByTrack**</span><br><code>Map&lt;string, Feature[][]&gt;</code> | Each fetched variant track's records paired into junctions, keyed by trackId. A function of the fetched features alone, kept apart from `overlayMatches` so a track resize re-runs only the layout half. |
| <span id="getter-readchainsbytrack">**readChainsByTrack**</span><br><code>Map&lt;string, ReadChain[]&gt;</code> | Each alignments track's split reads and discordant pairs, read off the displays in every row and resolved into connections, keyed by trackId. Reads no row, so a resize or a scroll leaves it alone. |
| <span id="getter-overlaymatches">**overlayMatches**</span><br><code>Map&lt;string, OverlayMatch&gt;</code> | Every overlay track's connections with their layout rects, keyed by trackId. Cached, so scrolling within loaded data does not look a row up again. |

<span data-pagefind-ignore>From [BaseViewModel](../baseviewmodel): <span id="getter-rendersdisplays">[`rendersDisplays`](../baseviewmodel#getter-rendersdisplays)</span>, <span id="getter-effectivebodymounted">[`effectiveBodyMounted`](../baseviewmodel#getter-effectivebodymounted)</span>, <span id="getter-owntracks">[`ownTracks`](../baseviewmodel#getter-owntracks)</span></span>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-exportsvg">**exportSvg**</span><br><code>(opts?: ExportSvgOptions) =&gt; Promise&lt;string&gt;</code> | renders the view to SVG markup, which it returns; saves it through FileSaver unless `save: false` |
| <span id="method-getmatchedtracks">**getMatchedTracks**</span><br><code>(trackConfigId: string) =&gt; OverlayTrack[]</code> | Get tracks with a given trackId across multiple views. Callers that index the result by view level (getTrackOverlayData, getMatchedFeaturesInLayout) rely on it staying aligned with `views` — which holds only because overlays are driven by `overlayMatches`, whose trackIds come from `matchedTracks` (the intersect across all views), so the track is present in every view and `filter` drops nothing. Don't level-index the result for an arbitrary trackId. |
| <span id="method-connectorrows">**connectorRows**</span><br><code>(trackId: string) =&gt; ConnectorRow[]</code> | Per row, whether the track is minimized and whether its own pileup draws a junction's connector, so the overlay leaves it out. Reads no scroll or zoom. |
| <span id="method-readsources">**readSources**</span><br><code>(trackId: string) =&gt; (ReadSource &#124; undefined)[]</code> | The reads each row's alignments display lays out, one entry per row. |
| <span id="method-gettrackoverlaydata">**getTrackOverlayData**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackId: string, yOffsetsOverride?: (number &#124; undefined)[] &#124; u…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackId: string, yOffsetsOverride?: (number &#124; undefined)[] &#124; undefined) =&gt; { tracks: OverlayTrack[]; levels: OverlayLevel[]; layouts: ViewLayout[]; getX: (level: number, refName: string, coord: number) =&gt; { x: number; reversed: boolean; } &#124; undefined; getY: (level: number, layout: LayoutRecord, at?: number &#124; undefined) =&gt; number; }</code></pre></dialog></span> | Per-render precompute for an overlay track. Resolves an OverlayLevel of geometry per view level, then returns getX/getY closures for converting feature layout records to SVG coordinates.<br><br>`yOffsetsOverride` — SVG export: fixed track tops. Each track keeps its scroll, which the exported bodies draw at too. Live rendering stacks each view's `height` and reads its `getTrackYOffset`, which the LGV keeps equal to the pixels (its label bands are measured into the model), so the overlay re-renders from MobX alone rather than polling the DOM. |
| <span id="method-getmatchedfeaturesinlayout">**getMatchedFeaturesInLayout**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackConfigId: string, features: Feature[][]) =&gt; { feature: Fe…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackConfigId: string, features: Feature[][]) =&gt; { feature: Feature; layout: LayoutRecord; level: number; }[][]</code></pre></dialog></span> |  |
| <span id="method-menuitems">**menuItems**</span><br><code>() =&gt; MenuItem[]</code> |  |
| <span id="method-rubberbandmenuitems">**rubberBandMenuItems**</span><br><code>() =&gt; MenuItem[]</code> |  |
| <span id="method-rubberbandclickmenuitemsatpx">**rubberbandClickMenuItemsAtPx**</span><br><code>(px: number) =&gt; MenuItem[]</code> | What a bare click on the shared rubberband strip offers: one row per panel, each holding that panel's own click menu at the base it paints under `px`. A pixel rather than an offset, since each panel maps it through its own `pxToBp`. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setwidth">**setWidth**</span><br><code>(newWidth: number) =&gt; void</code> |  |
| <span id="action-sethoveredoverlay">**setHoveredOverlay**</span><br><code>(arg: OverlayHover &#124; undefined) =&gt; void</code> | `undefined` when the pointer leaves a curve, and when the picture moves out from under it — see `overlayTransformKey`. |
| <span id="action-setinteractiveoverlay">**setInteractiveOverlay**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-setshowintraviewlinks">**setShowIntraviewLinks**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-setlinkviews">**setLinkViews**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-setscrollzoom">**setScrollZoom**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-setshowheader">**setShowHeader**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-setmatchedtrackfeatures">**setMatchedTrackFeatures**</span><br><code>(obj: Record&lt;string, Feature[][]&gt;) =&gt; void</code> |  |
| <span id="action-reload">**reload**</span><br><code>() =&gt; void</code> | Re-run the overlay-feature fetch with no input change — what the Retry on its failure notification calls. |
| <span id="action-reversevieworder">**reverseViewOrder**</span><br><code>() =&gt; void</code> |  |
| <span id="action-squareview">**squareView**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setlaunch">**setLaunch**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(launch?: LaunchInput&lt;BreakpointSplitViewCommands&gt; &#124; undefined)…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(launch?: LaunchInput&lt;BreakpointSplitViewCommands&gt; &#124; undefined) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-setviews">**setViews**</span><br><code>(viewInits: BreakpointSplitViewInitView[]) =&gt; void</code> |  |

<span data-pagefind-ignore>From [BaseViewModel](../baseviewmodel): <span id="action-setdisplayname">[`setDisplayName`](../baseviewmodel#action-setdisplayname)</span>, <span id="action-setbodymounted">[`setBodyMounted`](../baseviewmodel#action-setbodymounted)</span>, <span id="action-setminimized">[`setMinimized`](../baseviewmodel#action-setminimized)</span></span>
