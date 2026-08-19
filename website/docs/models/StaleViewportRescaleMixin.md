---
id: staleviewportrescalemixin
title: StaleViewportRescaleMixin
sidebar_label: Mixin -> StaleViewportRescaleMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`linear-genome-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/StaleViewportRescaleMixin.ts).

#crossCuttingMixin Stale-pixel rescaling for a display whose worker output is in
fetch-time pixel space. Nothing — the display records
`lastDrawnOffsetPx`/`lastDrawnBpPerPx` from its render callback. Brings the
`renderTransform` that keeps stale pixels aligned during a pan-during-fetch and
the `viewportFresh` half of `dataCurrent`

Records the viewport state (`offsetPx`, `bpPerPx`) at which the canvas was last
fully drawn, and derives the two things every consumer wants from it: the
`renderTransform` that keeps stale pixels aligned with the live viewport during
pan-during-fetch / zoom-during-fetch, and the `viewportFresh` predicate that
says the two agree again.

Its consumers are the single-global-RPC-result displays (HiC, LD), whose worker
output is in fetch-time pixel space relative to the first visible block's start.
Both getters live here rather than in each display because they were
byte-identical in both, and the pair is what makes the mechanism correct: the
transform exists to exploit the gap `viewportFresh` reports, so a display that
grew a term in one and not the other would rescale pixels it was simultaneously
calling current. The formula itself is in `renderTransform.ts`.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-lastdrawnoffsetpx">**lastDrawnOffsetPx**</span><br><code>lastDrawnOffsetPx: undefined as number &#124; undefined</code> | offsetPx of the viewport when the canvas was last fully drawn |
| <span id="volatile-lastdrawnbpperpx">**lastDrawnBpPerPx**</span><br><code>lastDrawnBpPerPx: undefined as number &#124; undefined</code> | bpPerPx of the viewport when the canvas was last fully drawn |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-viewportfresh">**viewportFresh**</span><br><code>boolean</code> | True only when the held data was drawn at exactly the current viewport. The freshness half of a global display's `dataCurrent` — the display ANDs its own "data has arrived" term on top, since this mixin owns no data state. Goes false for the whole debounce+RPC window after a pan/zoom, which is what keeps an off-screen SVG export from capturing a matrix fetched for the pre-pan viewport. |
| <span id="getter-rendertransform">**renderTransform**</span><br><code>RenderTransform</code> | Forward transform `{ scale, viewOffsetX }` shared by the GPU render, the mouse hit-test, and SVG export — so the pixels drawn, the cell the cursor reports, and the exported geometry can't disagree. Reduces to identity (`scale` 1) while `viewportFresh`. |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-captureviewport">**captureViewport**</span><br><code>() =&gt; DrawnViewport</code> | The viewport as it is right now. **Calling it is the capture**, which is why it is a method and not a getter — the same reason `RegionTooLargeMixin.gateFetchState()` is one.<br><br>A fetch takes this before its first await and hands that value to `commitDrawnViewport` after, never a live re-read: `ctx.isStale()` trips only on a newer fetch or a cancel, so a pan or zoom during the RPC would otherwise stamp the moved viewport onto data packed for the old one. `renderTransform` would then read scale 1 and leave the stale pixels un-rescaled, while `viewportFresh` — and so `svgReady` — called them current.<br><br>In `.views()`, never `.actions()`: the two getters below compare against it, and MobX runs an action untracked, so as an action it would leave them blind to every pan and zoom. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-commitdrawnviewport">**commitDrawnViewport**</span><br><code>({ offsetPx, bpPerPx }: DrawnViewport) =&gt; void</code> | Record the viewport a just-committed fetch was issued at. Takes `captureViewport()`'s return value, so there is no pair of loose numbers a caller could fill from the live view instead. |
