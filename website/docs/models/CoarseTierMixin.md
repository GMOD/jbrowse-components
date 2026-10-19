---
id: coarsetiermixin
title: CoarseTierMixin
description: "The zoomed-out tier a display draws in place of its detail past a threshold the display sets: MAF's summary bars."
sidebar_label: Mixin -> CoarseTierMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/CoarseTierMixin.ts).

The zoomed-out tier a display draws in place of its detail past a threshold
the display sets: MAF's summary bars. This mixin adds the swap decision, the
per-region payloads and the read that fills them, through the shared fetch
skeleton on a separate rotation, so the detail fetch's cancel never reaches
it.
While the tier is up the byte gate measures the coarse read, so its refusal
is the banner and the detail fetch stands down.

The payloads live beside the foundation's per-region store, never in it,
and the read records a span for the coarse tier alone: the two tiers fetch
different widths of the same `displayedRegionIndex`, so one `loadedRegions`
entry stamped by both would narrow the coarse span to the detail's on every
zoom in and re-read the coarse adapter about an octave back out. The detail store keeps its
entries under the tier — a display masks them where it draws, and zooming
back in draws what it held.

A display states its tier through the hooks below: the adapter slot the
source sits on, the threshold, what the read depends on beyond the span, and
the read itself. Composed after `MultiRegionDisplayMixin`, so its
`displayPhase` and `svgReady` are the ones `types.compose` keeps.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-coarsetier">**coarseTier**</span><br><code>ObservableMap&lt;number, P&gt;</code> | The coarse payload by `displayedRegionIndex`, over the regions the last read was issued for. Cleared on chromosome navigation. |
| <span id="volatile-coarsetierread">**coarseTierRead**</span><br><code>CoarseTierRead &#124; undefined</code> | What the held payloads were read over — the buffered regions and the read key — so a pan or a zoom inside them re-reads nothing. Undefined until a read lands. |
| <span id="volatile-coarsetierloading">**coarseTierLoading**</span><br><code>boolean</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-coarseadapterslot">**coarseAdapterSlot**</span><br><code>string &#124; undefined</code> | Overridable hook (default none): the slot on the track's adapter the coarse source sits in — `summaryAdapter` on MAF. With no slot there is no source and the tier never stands in. |
| <span id="getter-coarsetierpastthreshold">**coarseTierPastThreshold**</span><br><code>boolean</code> | Overridable hook (default false): the display's own line past which the tier stands in — a bp/px slot, a span floor. |
| <span id="getter-coarsereadkey">**coarseReadKey**</span><br><code>unknown</code> | Overridable hook (default `''`): what the read depends on beyond its span and its adapter — a zoom bucket, the settings axis. A value compared structurally, so a held read whose key differs re-reads. |
| <span id="getter-coarsesourceconfig">**coarseSourceConfig**</span><br><code>unknown</code> | The coarse source's config, read off the live track config so a re-pointed adapter follows. |
| <span id="getter-hascoarsesource">**hasCoarseSource**</span><br><code>boolean</code> |  |
| <span id="getter-coarsetieractive">**coarseTierActive**</span><br><code>boolean</code> | Whether the coarse tier stands in for the detail right now. |
| <span id="getter-coarsetierstandsin">**coarseTierStandsIn**</span><br><code>boolean</code> | Whether the tier is standing in for the detail on screen right now: the tier's verdict over a measured view. |
| <span id="getter-bytegateadapterpath">**byteGateAdapterPath**</span><br><code>ByteGateAdapterPath</code> | `RegionTooLargeMixin`'s hook: measure the adapter of the fetch that is about to run, so the estimate and the budget describe one file. |
| <span id="getter-coarsetierissuekey">**coarseTierIssueKey**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ adapter: (Record&lt;string, unknown&gt; &amp; { type: string; }) &#124; unde…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ adapter: (Record&lt;string, unknown&gt; &amp; { type: string; }) &#124; undefined; read: unknown; }</code></pre></dialog></span> | The whole key a read is held under: the coarse adapter and the display's own term. |
| <span id="getter-fetchsuspended">**fetchSuspended**</span><br><code>boolean</code> | `MultiRegionDisplayMixin`'s hook: the coarse read is the measurement pass while the tier stands in, so the detail fetch has nothing to do. |
| <span id="getter-displayphase">**displayPhase**</span><br><code>DisplayPhase</code> | The foundation's phase with the too-large banner swapped for the tier — see `coarseTierDisplayPhase`. |
| <span id="getter-svgready">**svgReady**</span><br><code>boolean</code> | The export gate under the same swap — see `coarseTierSvgReady`. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setcoarsetier">**setCoarseTier**</span><br><code>(entries: CoarseTierEntry&lt;P&gt;[], read: CoarseTierRead) =&gt; void</code> |  |
| <span id="action-clearcoarsetier">**clearCoarseTier**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setcoarsetierloading">**setCoarseTierLoading**</span><br><code>(loading: boolean) =&gt; void</code> |  |
| <span id="action-fetchcoarsetier">**fetchCoarseTier**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(_read: CoarseTierRead, _ctx: FetchContext) =&gt; Promise&lt;CoarseTi…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(_read: CoarseTierRead, _ctx: FetchContext) =&gt; Promise&lt;CoarseTierResult&lt;P&gt;&gt;</code></pre></dialog></span> | Overridable hook (no-op base): the coarse read over `read.regions`, returning one payload per region it covered, or a refusal. `ctx` is the skeleton's — its `callRpc` passes the signal and the status slot, and `isStale` guards any write the read makes for itself before it returns. |
