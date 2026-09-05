---
id: coarsetiermixin
title: CoarseTierMixin
sidebar_label: Mixin -> CoarseTierMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/CoarseTierMixin.ts).

The zoomed-out tier a display draws in place of its detail: the density
band's bins, MAF's summary bars. The verdict stays exactly what
`RegionTooLargeMixin` derives, and this mixin adds the swap decision, the
per-region payloads and the read that fills them, through the shared fetch
skeleton on its own rotation so the detail fetch's cancel never reaches it.

The payloads live beside the foundation's per-region store, never in it,
and the read records its own span: the two tiers fetch different widths of
the same `displayedRegionIndex`, so one `loadedRegions` entry stamped by
both narrowed the coarse span to the detail's on every zoom in and re-read
the coarse adapter about an octave back out. The detail store keeps its
entries under the tier — a display masks them where it draws, and zooming
back in draws what it held.

A display states its tier through the hooks below: the adapter slot the
source sits on, the mode, its own threshold, whether the byte gate measures
the coarse read, what its read depends on beyond the span, and the read
itself. Composed after `MultiRegionDisplayMixin`, so its `displayPhase` and
`svgReady` are the ones `types.compose` keeps.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-coarsetier">**coarseTier**</span><br><code>coarseTier: regionDataMap&lt;P&gt;('coarseTier')</code> | The coarse payload by `displayedRegionIndex`, over the regions the last read was issued for. Cleared on chromosome navigation. |
| <span id="volatile-coarsetierread">**coarseTierRead**</span><br><code>coarseTierRead: undefined as CoarseTierRead &#124; undefined</code> | What the held payloads were read over — the buffered regions and the read key — so a pan or a zoom inside them re-reads nothing. Undefined until a read lands. |
| <span id="volatile-coarsetierloading">**coarseTierLoading**</span><br><code>coarseTierLoading: false</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-coarseadapterslot">**coarseAdapterSlot**</span><br><code>string &#124; undefined</code> | Overridable hook (default none): the slot on the track's adapter the coarse source sits in — `densityAdapter`, `summaryAdapter`. With no slot there is no source and the tier never stands in. |
| <span id="getter-coarsetiermode">**coarseTierMode**</span><br><code>CoarseTierMode</code> | Overridable hook (default `auto`): the user's override, where the display offers one. |
| <span id="getter-coarsetierpastthreshold">**coarseTierPastThreshold**</span><br><code>boolean</code> | Overridable hook (default false): the display's own line past which `auto` swaps before the gate refuses anything — a bp/px slot, a span floor. |
| <span id="getter-coarsetiergated">**coarseTierGated**</span><br><code>boolean</code> | Overridable hook (default false): the coarse read is a feature download the byte gate has to measure. The gate then measures the coarse adapter while the tier is up, its refusal is the banner, the detail fetch stands down outright since the coarse read is the measurement pass, and the swap is by threshold alone — the verdict is about whichever tier is up, so it cannot also pick the tier. A read bounded by construction (bins per screen pixel) leaves this off. |
| <span id="getter-coarsereadkey">**coarseReadKey**</span><br><code>string</code> | Overridable hook (default `''`): what the read depends on beyond its span and its adapter — a zoom bucket, a settings key. A held read whose key differs re-reads. |
| <span id="getter-coarsesourceconfig">**coarseSourceConfig**</span><br><code>unknown</code> | The coarse source's config, read off the live track config so a re-pointed adapter follows. |
| <span id="getter-hascoarsesource">**hasCoarseSource**</span><br><code>boolean</code> |  |
| <span id="getter-coarsetieractive">**coarseTierActive**</span><br><code>boolean</code> | Whether the coarse tier stands in for the detail right now. |
| <span id="getter-coarsetierstandsin">**coarseTierStandsIn**</span><br><code>boolean</code> | Overridable hook (default: the tier's verdict) — whether the tier is standing in for the detail on screen right now. A display whose tier needs somewhere to draw narrows it: canvas adds the view geometry the draw is mapped through, alignments the coverage band that can be hidden. |
| <span id="getter-gatemeasurescoarse">**gateMeasuresCoarse**</span><br><code>boolean</code> | The byte gate is measuring the coarse read rather than the detail fetch, so its verdict is about the tier on screen. |
| <span id="getter-bytegateadapterpath">**byteGateAdapterPath**</span><br><code>string[]</code> | `RegionTooLargeMixin`'s hook: measure the adapter of the fetch that is about to run, so the estimate and the budget describe one file. |
| <span id="getter-gaterefusesdetail">**gateRefusesDetail**</span><br><code>boolean</code> | The gate's refusal is about the detail fetch, so that fetch owes the re-measure the gate releases through. |
| <span id="getter-coarsetierissuekey">**coarseTierIssueKey**</span><br><code>string</code> | The whole key a read is held under: the coarse adapter and the display's own term. |
| <span id="getter-fetchsuspended">**fetchSuspended**</span><br><code>boolean</code> | `MultiRegionDisplayMixin`'s hook, from `resolveFetchSuspended` over `coarseTierStandsIn`. |
| <span id="getter-displayphase">**displayPhase**</span><br><code>DisplayPhase</code> | The foundation's phase with the too-large banner swapped for the tier — see `coarseTierDisplayPhase`. |
| <span id="getter-svgready">**svgReady**</span><br><code>boolean</code> | The export gate under the same swap — see `coarseTierSvgReady`. |
| <span id="getter-drawswhentoolarge">**drawsWhenTooLarge**</span><br><code>boolean</code> | `renderDisplaySvg`'s hook: the export paints the tier in place of the too-large note, the same swap the chrome makes on screen — unless the note is about the coarse read itself. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setcoarsetier">**setCoarseTier**</span><br><code>(entries: CoarseTierEntry&lt;P&gt;[], read: CoarseTierRead) =&gt; void</code> |  |
| <span id="action-clearcoarsetier">**clearCoarseTier**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setcoarsetierloading">**setCoarseTierLoading**</span><br><code>(loading: boolean) =&gt; void</code> |  |
| <span id="action-fetchcoarsetier">**fetchCoarseTier**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(_read: CoarseTierRead, _ctx: FetchContext) =&gt; Promise&lt;CoarseTi…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(_read: CoarseTierRead, _ctx: FetchContext) =&gt; Promise&lt;CoarseTierResult&lt;P&gt;&gt;</code></pre></dialog></span> | Overridable hook (no-op base): the coarse read over `read.regions`, answering one payload per region it covered or a refusal. `ctx` is the skeleton's — its `callRpc` carries the stop token and the status slot, and `isStale` guards any write the read makes for itself before it returns. |
