---
id: staleviewportrescalemixin
title: StaleViewportRescaleMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/StaleViewportRescaleMixin.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/StaleViewportRescaleMixin.md)

## Docs

Records the viewport state (`offsetPx`, `bpPerPx`) at which the canvas was last
fully drawn. Consumers (HiC, LD — single-global-RPC-result displays) build a
`renderTransform` getter on top of these fields to keep stale pixels aligned
with the live viewport during pan-during-fetch and zoom-during-fetch.

The transform's formula is display-specific because it depends on what data-x =
0 represents in the worker output — see `plugins/hic` and
`plugins/variants/LDDisplay` for the canonical
`viewOffsetX = max(0, lastDrawnOffsetPx) * scale - view.offsetPx` pattern
(handles negative offsetPx when scrolled left of genome start).

### StaleViewportRescaleMixin - Volatiles

#### volatile: lastDrawnOffsetPx

offsetPx of the viewport when the canvas was last fully drawn

```js
// type signature
number | undefined
// code
lastDrawnOffsetPx: undefined as number | undefined
```

#### volatile: lastDrawnBpPerPx

bpPerPx of the viewport when the canvas was last fully drawn

```js
// type signature
number | undefined
// code
lastDrawnBpPerPx: undefined as number | undefined
```

### StaleViewportRescaleMixin - Actions

#### action: setLastDrawnViewport

```js
// type signature
setLastDrawnViewport: (offsetPx: number, bpPerPx: number) => void
```
