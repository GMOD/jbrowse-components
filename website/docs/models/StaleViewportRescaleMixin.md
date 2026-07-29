---
id: staleviewportrescalemixin
title: StaleViewportRescaleMixin
sidebar_label: Mixin -> StaleViewportRescaleMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`linear-genome-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/StaleViewportRescaleMixin.ts).

Records the viewport state (`offsetPx`, `bpPerPx`) at which the canvas was last
fully drawn. Consumers (HiC, LD — single-global-RPC-result displays) build a
`renderTransform` getter on top of these fields to keep stale pixels aligned
with the live viewport during pan-during-fetch and zoom-during-fetch.

The transform's formula is display-specific because it depends on what data-x =
0 represents in the worker output — see `plugins/hic` and
`plugins/variants/LDDisplay` for the canonical
`viewOffsetX = max(0, lastDrawnOffsetPx) * scale - view.offsetPx` pattern
(handles negative offsetPx when scrolled left of genome start).

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-lastdrawnoffsetpx">**lastDrawnOffsetPx**</span><br><code>lastDrawnOffsetPx: undefined as number &#124; undefined</code> | offsetPx of the viewport when the canvas was last fully drawn |
| <span id="volatile-lastdrawnbpperpx">**lastDrawnBpPerPx**</span><br><code>lastDrawnBpPerPx: undefined as number &#124; undefined</code> | bpPerPx of the viewport when the canvas was last fully drawn |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setlastdrawnviewport">**setLastDrawnViewport**</span><br><code>(offsetPx: number, bpPerPx: number) =&gt; void</code> |  |
