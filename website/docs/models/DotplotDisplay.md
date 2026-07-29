---
id: dotplotdisplay
title: DotplotDisplay
sidebar_label: Display -> DotplotDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`dotplot-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/dotplot-view/src/DotplotDisplay/stateModelFactory.tsx).

The configuration slots for this model are documented on its
[config schema page](../../config/dotplotdisplay).

Members a composed model contributes are listed here too, so these tables are
the whole surface.

## Properties

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal('DotplotDisplay')</code> |  | DotplotDisplay |
| <span id="property-configuration">**configuration**</span><br><code>configuration: ConfigurationReference(configSchema)</code> |  | DotplotDisplay |
| <span id="property-colorby">**colorBy**</span><br><code>colorBy: types.optional(types.string, 'default')</code> | color by setting that overrides the config setting | DotplotDisplay |
| <span id="property-alpha">**alpha**</span><br><code>alpha: types.optional(types.number, 1)</code> |  | DotplotDisplay |
| <span id="property-minalignmentlength">**minAlignmentLength**</span><br><code>minAlignmentLength: types.optional(types.number, 0)</code> |  | DotplotDisplay |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  | [BaseDisplay](../basedisplay#property-id) |
| <span id="property-rpcdrivername">**rpcDriverName**</span><br><code>rpcDriverName: types.maybe(types.string)</code> |  | [BaseDisplay](../basedisplay#property-rpcdrivername) |
| <span id="property-ignorepromoteddefaults">**ignorePromotedDefaults**</span><br><code>ignorePromotedDefaults: types.stripDefault(types.boolean, false)</code> | <span data-pagefind-ignore>true for a display that arrived inside a session received from someone else (a share link, an encoded/json session, a `spec-` URL). Such a display resolves its `promotable` config slots from its own config only, never from this browser's promoted display-type defaults (see `configuration/promotableDefaults.ts`) — the received session is a record of what the sender saw, and a local preference silently repainting it would make it a lie. A track opened *afterwards* in that same session is a fresh track of this user's, so it never gets the flag and picks up their defaults normally. Cleared by `resetSlotsToInherit` when the user deliberately makes the display follow a default.</span> | [BaseDisplay](../basedisplay#property-ignorepromoteddefaults) |

## Volatiles

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="volatile-rpcdata">**rpcData**</span><br><code>rpcData: undefined as DotplotRpcData &#124; undefined</code> | RPC-computed feature data | DotplotDisplay |
| <span id="volatile-geometry">**geometry**</span><br><code>geometry: undefined as DotplotGeometryData &#124; undefined</code> | GPU-instance geometry produced from featPositions, self- describing via embedded bpPerPx. The containing DotplotView aggregates one of these per display and uploads them to the shared backend keyed by track index. | DotplotDisplay |
| <span id="volatile-fetchwarnings">**fetchWarnings**</span><br><code>fetchWarnings: [] as { message: string; effect: string }[]</code> |  | DotplotDisplay |
| <span id="volatile-error">**error**</span><br><code>error: undefined as unknown</code> |  | [BaseDisplay](../basedisplay#volatile-error) |
| <span id="volatile-statusmessage">**statusMessage**</span><br><code>statusMessage: undefined as string &#124; undefined</code> |  | [BaseDisplay](../basedisplay#volatile-statusmessage) |
| <span id="volatile-statusprogress">**statusProgress**</span><br><code>statusProgress: undefined as number &#124; undefined</code> | <span data-pagefind-ignore>determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate. Set alongside `statusMessage` by `setStatusMessage`; a display that never shows a bar simply leaves it undefined.</span> | [BaseDisplay](../basedisplay#volatile-statusprogress) |
| <span id="volatile-fetching">**fetching**</span><br><code>fetching: false</code> | <span data-pagefind-ignore>True while an RPC fetch is in-flight. Combined with `ready` it distinguishes a first load (no data yet — full overlay) from a refetch (stale content still on screen — corner indicator).</span> | [SyntenyFetchStateMixin](../syntenyfetchstatemixin#volatile-fetching) |
| <span id="volatile-loadedfetchkey">**loadedFetchKey**</span><br><code>loadedFetchKey: undefined as string &#124; undefined</code> | <span data-pagefind-ignore>Fetch-input signature the currently held data was fetched for (each display builds its own `currentFetchKey`). Compared against the live inputs in `dataCurrent` to catch data gone stale after a region/zoom change — including during the pre-refetch debounce gap, where `fetching` is still false and would otherwise report done on content drawn against the old viewport.</span> | [SyntenyFetchStateMixin](../syntenyfetchstatemixin#volatile-loadedfetchkey) |
| <span id="volatile-assembliesswapped">**assembliesSwapped**</span><br><code>assembliesSwapped: false</code> | <span data-pagefind-ignore>Set once at view load by a refName-comparison check, independent of the per-render fetch, so it never re-fires or misfires on zoom. Surfaces through each display's `warnings`.</span> | [SyntenyFetchStateMixin](../syntenyfetchstatemixin#volatile-assembliesswapped) |

## Getters

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="getter-ready">**ready**</span><br><code>boolean</code> | A fetch has completed (data is present, even if it mapped zero features). Not a feature-count test — an empty-but-finished fetch is ready, otherwise an empty plot spins the loading overlay forever. | DotplotDisplay |
| <span id="getter-loading">**loading**</span><br><code>boolean</code> | First load: no data has arrived yet. Excludes error so error UI and loading UI never show simultaneously. Drives the centered overlay. | DotplotDisplay |
| <span id="getter-refetching">**refetching**</span><br><code>boolean</code> | Refetch in-flight: a new fetch is running but a stale plot is still on screen (zoom, diagonalize reorder, pan past the buffer). Drives a subtle corner indicator instead of the full overlay so the visible plot isn't masked on every viewport change. | DotplotDisplay |
| <span id="getter-fetchregions">**fetchRegions**</span><br><code>Region[]</code> | The h-axis fetch window: the visible content blocks expanded by the shared pan buffer and snapped outward to a buffer-sized grid, so a pan within the buffer neither refetches nor exposes an unfetched strip, and zoomed out it collapses to the whole displayed region. The v axis is deliberately not scoped: the fetch is one-dimensional (h regions in, every mate out), so a vertical pan needs no data the h window didn't already bring, and must never trigger a refetch.<br><br>Unlike synteny, nothing culls this window again in the worker — executeDotplotFeaturesAndPositions maps every feature it is handed — so the window's only job is to be a superset of what's on screen. | DotplotDisplay |
| <span id="getter-currentfetchkey">**currentFetchKey**</span><br><code>string</code> | The fetch-input signature (see fetchKey.ts) for the view's current state. Reactive: recomputes when either axis's zoom or displayed-region order/orientation changes, or when a pan carries the h axis into a new snapped fetch window. As a computed it only notifies when the string itself changes, which is what lets the fetch autorun track it and stay quiet through sub-buffer pans. | DotplotDisplay |
| <span id="getter-lodtier">**lodTier**</span><br><code>LodTier</code> | The detail tier this plot's fetch asks the adapter for. Resolved here on the main thread, not adapter-side from `bpPerPx`, so it is part of `currentFetchKey` — see `resolveLodTier`. Both axes feed it: CIGAR detail is worth drawing when a block is wide on either one, so dropping to the no-CIGAR tier is only safe once both are past the threshold. | DotplotDisplay |
| <span id="getter-datacurrent">**dataCurrent**</span><br><code>boolean</code> | True when the rendered rpcData was fetched for the view's current inputs. Goes false the instant a zoom or diagonalize reorder changes the axes — before the debounced refetch begins and while stale geometry is still on screen — so the `settled` done-gate can't fire on it. The dotplot analog of LGV's `viewportWithinLoadedData`. | DotplotDisplay |
| <span id="getter-warnings">**warnings**</span><br><code>{ message: string; effect: string; }[]</code> | Per-render fetch warnings, plus the load-time reversed-assembly hint. | DotplotDisplay |
| <span id="getter-svgready">**svgReady**</span><br><code>boolean</code> | Off-screen SVG export gate: "Export SVG" waits on this before drawing (see the [SVG export guide](/docs/developer_guides/svg_export)). Runs the same shared `computeSvgReady` policy every other display does and awaits it via the shared `awaitSvgReady` — no inlined `when()`. No `regionTooLarge` state: the fetch is gated by LOD, not region size. Stale-safe via `dataCurrent`: an export fired right after a zoom/diagonalize reorder waits for geometry rebuilt from the fresh fetch instead of exporting the stale plot. | DotplotDisplay |
| <span id="getter-parenttrack">**parentTrack**</span><br><code>AbstractTrackModel</code> |  | [BaseDisplay](../basedisplay#getter-parenttrack) |
| <span id="getter-parentdisplay">**parentDisplay**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ type?: string &#124; undefined; effectiveRpcDriverName?: string &#124;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ type?: string &#124; undefined; effectiveRpcDriverName?: string &#124; undefined; } &#124; undefined</code></pre></dialog></span> | <span data-pagefind-ignore>Returns the parent display if this display is nested within another display (e.g., PileupDisplay inside LinearAlignmentsDisplay)</span> | [BaseDisplay](../basedisplay#getter-parentdisplay) |
| <span id="getter-renderingcomponent">**RenderingComponent**</span><br><code>FC&lt;…&gt;</code> |  | [BaseDisplay](../basedisplay#getter-renderingcomponent) |
| <span id="getter-displayblurb">**DisplayBlurb**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>FC&lt;{ model: ModelInstanceTypeProps&lt;…&gt; &amp; { ...; } &amp; { ...; } &amp; I…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>FC&lt;{ model: ModelInstanceTypeProps&lt;…&gt; &amp; { ...; } &amp; { ...; } &amp; IStateTreeNode&lt;...&gt;; }&gt; &#124; null</code></pre></dialog></span> |  | [BaseDisplay](../basedisplay#getter-displayblurb) |
| <span id="getter-adapterconfig">**adapterConfig**</span><br><code>any</code> |  | [BaseDisplay](../basedisplay#getter-adapterconfig) |
| <span id="getter-isminimized">**isMinimized**</span><br><code>boolean</code> | <span data-pagefind-ignore>Returns true if the parent track is minimized. Used to skip expensive operations like autoruns when track is not visible.</span> | [BaseDisplay](../basedisplay#getter-isminimized) |
| <span id="getter-effectiverpcdrivername">**effectiveRpcDriverName**</span><br><code>any</code> | <span data-pagefind-ignore>Returns the effective RPC driver name with hierarchical fallback: 1. This display's explicit rpcDriverName 2. Parent display's effectiveRpcDriverName (for nested displays) 3. Track config's rpcDriverName</span> | [BaseDisplay](../basedisplay#getter-effectiverpcdrivername) |
| <span id="getter-displaymessagecomponent">**DisplayMessageComponent**</span><br><code>FC&lt;any&gt; &#124; undefined</code> | <span data-pagefind-ignore>if a display-level message should be displayed instead, make this return a react component</span> | [BaseDisplay](../basedisplay#getter-displaymessagecomponent) |

## Methods

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="method-rendersvg">**renderSvg**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(opts: ExportSvgOptions &amp; { theme?: ThemeOptions &#124; undefined; }…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(opts: ExportSvgOptions &amp; { theme?: ThemeOptions &#124; undefined; }) =&gt; Promise&lt;Element&gt;</code></pre></dialog></span> |  | DotplotDisplay |
| <span id="method-renderingprops">**renderingProps**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>() =&gt; { displayModel: ModelInstanceTypeProps&lt;…&gt; &amp; { ...; } &amp; {…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>() =&gt; { displayModel: ModelInstanceTypeProps&lt;…&gt; &amp; { ...; } &amp; { ...; } &amp; { ...; } &amp; IStateTreeNode&lt;...&gt;; }</code></pre></dialog></span> | <span data-pagefind-ignore>props passed to the renderer's React "Rendering" component. these are client-side only and never sent to the worker. includes displayModel and callbacks</span> | [BaseDisplay](../basedisplay#method-renderingprops) |
| <span id="method-trackmenuitems">**trackMenuItems**</span><br><code>() =&gt; MenuItem[]</code> |  | [BaseDisplay](../basedisplay#method-trackmenuitems) |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-setloading">**setLoading**</span><br><code>() =&gt; void</code> |  | DotplotDisplay |
| <span id="action-setrpcdata">**setRpcData**</span><br><code>(data: DotplotRpcData, fetchKey: string) =&gt; void</code> |  | DotplotDisplay |
| <span id="action-setwarnings">**setWarnings**</span><br><code>(w: { message: string; effect: string; }[]) =&gt; void</code> |  | DotplotDisplay |
| <span id="action-setgeometry">**setGeometry**</span><br><code>(data: DotplotGeometryData &#124; undefined) =&gt; void</code> |  | DotplotDisplay |
| <span id="action-seterror">**setError**</span><br><code>(error: unknown) =&gt; void</code> |  | DotplotDisplay |
| <span id="action-setalpha">**setAlpha**</span><br><code>(value: number) =&gt; void</code> |  | DotplotDisplay |
| <span id="action-setminalignmentlength">**setMinAlignmentLength**</span><br><code>(value: number) =&gt; void</code> |  | DotplotDisplay |
| <span id="action-setcolorby">**setColorBy**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(value: "default" &#124; "strand" &#124; "query" &#124; "target" &#124; "reference"…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(value: "default" &#124; "strand" &#124; "query" &#124; "target" &#124; "reference" &#124; "identity" &#124; "meanQueryIdentity" &#124; "mappingQuality") =&gt; void</code></pre></dialog></span> |  | DotplotDisplay |
| <span id="action-setignorepromoteddefaults">**setIgnorePromotedDefaults**</span><br><code>(flag: boolean) =&gt; void</code> | <span data-pagefind-ignore>see the `ignorePromotedDefaults` property</span> | [BaseDisplay](../basedisplay#action-setignorepromoteddefaults) |
| <span id="action-setstatusmessage">**setStatusMessage**</span><br><code>(status?: RpcStatus &#124; undefined) =&gt; void</code> |  | [BaseDisplay](../basedisplay#action-setstatusmessage) |
| <span id="action-setrpcdrivername">**setRpcDriverName**</span><br><code>(rpcDriverName: string) =&gt; void</code> |  | [BaseDisplay](../basedisplay#action-setrpcdrivername) |
| <span id="action-reload">**reload**</span><br><code>() =&gt; void</code> | <span data-pagefind-ignore>base display reload does nothing, see specialized displays for details</span> | [BaseDisplay](../basedisplay#action-reload) |
| <span id="action-setfetching">**setFetching**</span><br><code>(arg: boolean) =&gt; void</code> |  | [SyntenyFetchStateMixin](../syntenyfetchstatemixin#action-setfetching) |
| <span id="action-setassembliesswapped">**setAssembliesSwapped**</span><br><code>(arg: boolean) =&gt; void</code> |  | [SyntenyFetchStateMixin](../syntenyfetchstatemixin#action-setassembliesswapped) |
