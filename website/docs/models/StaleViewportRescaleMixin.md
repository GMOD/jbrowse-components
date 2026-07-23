---
id: staleviewportrescalemixin
title: StaleViewportRescaleMixin
sidebar_label: Mixin -> StaleViewportRescaleMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`linear-genome-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/StaleViewportRescaleMixin.ts).

## Overview

Records the viewport state (`offsetPx`, `bpPerPx`) at which the canvas was last
fully drawn. Consumers (HiC, LD — single-global-RPC-result displays) build a
`renderTransform` getter on top of these fields to keep stale pixels aligned
with the live viewport during pan-during-fetch and zoom-during-fetch.

The transform's formula is display-specific because it depends on what data-x =
0 represents in the worker output — see `plugins/hic` and
`plugins/variants/LDDisplay` for the canonical
`viewOffsetX = max(0, lastDrawnOffsetPx) * scale - view.offsetPx` pattern
(handles negative offsetPx when scrolled left of genome start).

## Members

| Member                                               | Kind      | Defined by                | Description                                                   |
| ---------------------------------------------------- | --------- | ------------------------- | ------------------------------------------------------------- |
| [lastDrawnOffsetPx](#volatile-lastdrawnoffsetpx)     | Volatiles | StaleViewportRescaleMixin | offsetPx of the viewport when the canvas was last fully drawn |
| [lastDrawnBpPerPx](#volatile-lastdrawnbpperpx)       | Volatiles | StaleViewportRescaleMixin | bpPerPx of the viewport when the canvas was last fully drawn  |
| [setLastDrawnViewport](#action-setlastdrawnviewport) | Actions   | StaleViewportRescaleMixin |                                                               |

<details>
<summary>StaleViewportRescaleMixin - Volatiles</summary>

#### volatile: lastDrawnOffsetPx

offsetPx of the viewport when the canvas was last fully drawn

```ts
// type signature
type lastDrawnOffsetPx = number | undefined
// code
lastDrawnOffsetPx: undefined as number | undefined
```

#### volatile: lastDrawnBpPerPx

bpPerPx of the viewport when the canvas was last fully drawn

```ts
// type signature
type lastDrawnBpPerPx = number | undefined
// code
lastDrawnBpPerPx: undefined as number | undefined
```

</details>

<details>
<summary>StaleViewportRescaleMixin - Actions</summary>

| Member                                                             | Type                                          |
| ------------------------------------------------------------------ | --------------------------------------------- |
| <span id="action-setlastdrawnviewport">setLastDrawnViewport</span> | `(offsetPx: number, bpPerPx: number) => void` |

</details>
