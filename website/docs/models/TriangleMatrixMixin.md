---
id: trianglematrixmixin
title: TriangleMatrixMixin
sidebar_label: Mixin -> TriangleMatrixMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/TriangleMatrixMixin.ts).

#crossCuttingMixin A matrix drawn as a triangle over the view's axis (Hi-C, LD): the fetched payload (`rpcData`), the canvas box (`canvasWidth`, `matrixHeight` under the `matrixTop` hook), the rotate-and-squash transform and its inverse (`cellToScreen`, `screenToCell`), the frame the marks read (`triangleFrame`), the one-cell region map and canvas-wide block the mark backend draws (`matrixRegions`, `matrixBlocks`), and the `squashToHeight` slot. Composes after `TrackHeightMixin`, `GlobalFetchMixin` and `LegendMixin`

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-rpcdata">**rpcData**</span><br><code>rpcData: null as D &#124; null</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-squashtoheight">**squashToHeight**</span><br><code>boolean</code> |  |
| <span id="getter-matrixtop">**matrixTop**</span><br><code>number</code> | Overridable hook (default 0): px reserved above the matrix. |
| <span id="getter-canvaswidth">**canvasWidth**</span><br><code>number</code> | The canvas spans the scrolled content, boundary padding included. |
| <span id="getter-viewtransform">**viewTransform**</span><br><code>{ viewScale: number; viewOffsetX: number; }</code> |  |
| <span id="getter-matrixregions">**matrixRegions**</span><br><code>ReadonlyMap&lt;number, D&gt;</code> | The one payload under key 0, absent until the fetch lands. An empty matrix keeps the key: the cleared canvas is its picture. |
| <span id="getter-matrixheight">**matrixHeight**</span><br><code>number</code> |  |
| <span id="getter-matrixblocks">**matrixBlocks**</span><br><code>RenderBlock[]</code> |  |
| <span id="getter-yscalar">**yScalar**</span><br><code>number</code> | The squash takes the content's base, without the boundary padding a scroll past either end adds. |
| <span id="getter-triangletransform">**triangleTransform**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ yScalar: number; yOffsetPx: number; viewScale: number; viewOf…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ yScalar: number; yOffsetPx: number; viewScale: number; viewOffsetX: number; }</code></pre></dialog></span> |  |
| <span id="getter-triangleframe">**triangleFrame**</span><br><code>TriangleFrame</code> |  |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-svglegendwidth">**svgLegendWidth**</span><br><code>() =&gt; number</code> | The export parks the key beside the matrix, which fills its band. |
| <span id="method-celltoscreen">**cellToScreen**</span><br><code>(x: number, y: number) =&gt; { x: number; y: number; }</code> | Pre-rotation cell coordinates to display px. |
| <span id="method-screentocell">**screenToCell**</span><br><code>(x: number, y: number) =&gt; { x: number; y: number; }</code> | The exact inverse of `cellToScreen`. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setrpcdata">**setRpcData**</span><br><code>(data: D) =&gt; void</code> |  |
| <span id="action-setsquashtoheight">**setSquashToHeight**</span><br><code>(value: boolean) =&gt; void</code> |  |
