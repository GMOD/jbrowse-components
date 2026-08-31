---
id: regiontoolargemixin
title: RegionTooLargeMixin
sidebar_label: Mixin -> RegionTooLargeMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/RegionTooLargeMixin.ts).

The region-too-large gate: a display opts in by overriding `gateEnabled` and
passing `byteLimit: self.resolvedByteLimit()` to its fetch RPC. The RPC measures
the index before it downloads and answers a refusal when a region is over
budget; the fetch runners commit what it measured, and `regionTooLarge` is
derived from that last measurement. While the banner is up the fetch runs once
per settled viewport and settings, which is the re-measure. Composed by
`MultiRegionDisplayMixin` and `GlobalFetchMixin`. The rules and the numbers
behind them: agent-docs/reference/REGION_TOO_LARGE.md.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-forceloadtrack">**forceLoadTrack**</span><br><code>forceLoadTrack: false</code> | The force-load button's track-wide approval. Volatile so it never reaches a saved session; the `forceLoad` config slot is the durable form. |
| <span id="volatile-byteestimate">**byteEstimate**</span><br><code>byteEstimate: undefined as ByteEstimate &#124; undefined</code> | The last byte measurement: bytes, the span they were taken at, and whether zooming has been shown not to shrink them. Survives `clearAllRpcData`; dropped on chromosome navigation and on a tier swap. |
| <span id="volatile-gatemeasuredviewportkey">**gateMeasuredViewportKey**</span><br><code>gateMeasuredViewportKey: undefined as string &#124; undefined</code> | The `gateViewport` key the gate last asked the adapter about, on either axis — the viewport AND the settings it asked under. Separate from `byteEstimate` because a density refusal measures no bytes. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-gateenabled">**gateEnabled**</span><br><code>boolean</code> | The opt-in. Overridden with a literal `true` by gated displays, and `check-gated-adapter-budgets` insists on a literal: this mixin returns early on it in an autorun and in `commitFetchBytes`. |
| <span id="getter-densitygateenabled">**densityGateEnabled**</span><br><code>boolean</code> | Whether the density axis applies. `CanvasFeatureGateMixin` contributes `true` beside its measurement; byte-only displays leave it. |
| <span id="getter-bytegateadapterconfig">**byteGateAdapterConfig**</span><br><code>Record&lt;string, unknown&gt;</code> | The adapter config the gate measures — the one at `byteGateAdapterPath`. Overridable for a display whose adapter config is synthesized rather than read off the track. |
| <span id="getter-configuredfetchsizelimit">**configuredFetchSizeLimit**</span><br><code>number &#124; undefined</code> | The display's `fetchSizeLimit` slot, from `regionTooLargeConfigSchemaFields`. `number \| undefined`, because `getConf` answers `undefined` for a slot a composing display's schema never declared and typing it `number` hid the whole failure — `resolveByteLimit` falls back closed, and says why. |
| <span id="getter-densitytoolarge">**densityTooLarge**</span><br><code>boolean</code> | The density axis's verdict; canvas overrides it. |
| <span id="getter-bytegateadapterpath">**byteGateAdapterPath**</span><br><code>string[]</code> | Where on the track config the measured adapter sits. A tiered display overrides this one hook (MAF: `['adapter', 'summaryAdapter']` while `showSummary`), and both the measurement and the budget follow it. |
| <span id="getter-adapterfetchsizelimit">**adapterFetchSizeLimit**</span><br><code>number &#124; undefined</code> | The measured adapter's own `fetchSizeLimit` slot, read off the live track config rather than the `adapterConfig` snapshot, which omits slots at their default. |
| <span id="getter-configforceload">**configForceLoad**</span><br><code>boolean</code> | The declarative `forceLoad` slot. |
| <span id="getter-gateviewport">**gateViewport**</span><br><code>GateViewport &#124; undefined</code> | What a measurement taken now would be about: the span on screen, and a key for the stretch of genome it covers **and the settings it would be taken under**. Undefined until the view is measured, and the mixin's only read of the view. Captured before the fetch's round trip, never at commit, so the stamp names the settings the worker actually counted under.<br><br>The settings term is `rpcPropsCacheKey`, the axis both families already invalidate data on. It belongs in the measurement because the worker's density probe counts ADMITTED features (`densityGate`'s `admit`), so a filter admitting almost nothing is a different measurement of the same viewport — and while staleness was viewport-only, the main thread never went back to ask. The byte axis is an index read no `rpcProps` field can move; the rule is one rule rather than one per axis. |
| <span id="getter-bytegateadapterkey">**byteGateAdapterKey**</span><br><code>string</code> | Which tier the estimate is about, as a comparable string. |
| <span id="getter-aboveforceloadfloor">**aboveForceLoadFloor**</span><br><code>boolean</code> | Whether the span on screen is at or above `AUTO_FORCE_LOAD_BP`, the one comparison against that constant. False on an unmeasured view. |
| <span id="getter-gateexempt">**gateExempt**</span><br><code>boolean</code> | Nothing may gate on either axis: the `forceLoad` slot or the button. |
| <span id="getter-estimatedfetchbytes">**estimatedFetchBytes**</span><br><code>number &#124; undefined</code> | The stored estimate's bytes; undefined when nothing has been measured. |
| <span id="getter-gatemeasurementstale">**gateMeasurementStale**</span><br><code>boolean</code> | Whether the last measurement still describes what a fetch issued now would ask: the viewport on screen, under the settings on screen. True before any measurement. The triple's third term, the adapter tier, is not here — a tier swap drops the measurement outright (`ClearByteEstimateOnNavOrTierSwap`) rather than marking it stale. |
| <span id="getter-gatebytelimit">**gateByteLimit**</span><br><code>number</code> | The byte budget: the adapter's limit, else the display's, doubled below `AUTO_FORCE_LOAD_BP`. Read only through `resolvedByteLimit()`. |
| <span id="getter-gateactive">**gateActive**</span><br><code>boolean</code> | Whether the gate may act right now, on any axis: opted in, not exempt, view measured. The view is read last, so an ungated display never touches it. |
| <span id="getter-densitygateactive">**densityGateActive**</span><br><code>boolean</code> | `gateActive` plus the density axis's own terms: the axis is on, and the span is above the floor. |
| <span id="getter-toolargestatus">**tooLargeStatus**</span><br><code>RegionTooLargeStatus</code> | The verdict and its banner text, from the stored estimate against `resolvedByteLimit()` and the density axis when it may act. |
| <span id="getter-regiontoolarge">**regionTooLarge**</span><br><code>boolean</code> |  |
| <span id="getter-regiontoolargereason">**regionTooLargeReason**</span><br><code>string</code> | Banner text for the axis that tripped; empty when not too large. |
| <span id="getter-zoomcanreleasegate">**zoomCanReleaseGate**</span><br><code>boolean</code> | Whether "zoom in to see features" is honest advice. Density always releases on zoom; bytes only if the last zoom-in moved the estimate. |
| <span id="getter-gateskipsmeasuredviewport">**gateSkipsMeasuredViewport**</span><br><code>boolean</code> | The skip both fetch skeletons apply: the banner is up and its measurement already describes the viewport on screen. |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-resolvedbytelimit">**resolvedByteLimit**</span><br><code>() =&gt; number &#124; undefined</code> | The budget the worker enforces and the banner compares against — the one spelling of that pair. Undefined when the gate may not act. |
| <span id="method-gatefetchstate">**gateFetchState**</span><br><code>() =&gt; GateFetchState</code> | The gate as it stands for a fetch about to be issued. Calling it is the capture, which is why it is a method. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setbyteestimate">**setByteEstimate**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(measurement: { bytes: number; viewport: GateViewport; }) =&gt; vo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(measurement: { bytes: number; viewport: GateViewport; }) =&gt; void</code></pre></dialog></span> | The bytes half of a measurement alone, for a test staging a display. Production commits through `commitFetchBytes`. |
| <span id="action-clearbyteestimate">**clearByteEstimate**</span><br><code>() =&gt; void</code> | Drops the estimate and the viewport stamp. `forceLoadTrack` survives: it is a track-wide approval. |
| <span id="action-setforceloadtrack">**setForceLoadTrack**</span><br><code>(flag: boolean) =&gt; void</code> |  |
| <span id="action-reload">**reload**</span><br><code>() =&gt; void</code> | Overridden by the composing display. |
| <span id="action-commitfetchbytes">**commitFetchBytes**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(perRegionBytes: (number &#124; undefined)[], issued: GateFetchState…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(perRegionBytes: (number &#124; undefined)[], issued: GateFetchState) =&gt; void</code></pre></dialog></span> | The byte axis of a finished fetch, called by the fetch runners with the `gateFetchState()` they captured at issue. Commits the per-region max; an empty batch, or an ungated display, commits nothing. |
| <span id="action-forceload">**forceLoad**</span><br><code>() =&gt; void</code> | The banner's button: exempt the track on both axes and refetch. |
