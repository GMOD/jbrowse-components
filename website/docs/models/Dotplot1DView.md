---
id: dotplot1dview
title: Dotplot1DView
sidebar_label: General -> Dotplot1DView
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the `dotplot-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/dotplot-view/src/DotplotView/1dview.ts).

one axis of a dotplot. categorized General rather than View because it is not
a pluggable view type, which the name-suffix heuristic would otherwise assume
ref https://mobx-state-tree.js.org/concepts/volatiles on volatile state used here

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-dynamicblocks">**dynamicBlocks**</span><br><code>BlockSet</code> | this uses padding=false and elision=false |
| <span id="getter-visibleregions">**visibleRegions**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ refName: string; start: number; end: number; assemblyName: st…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ refName: string; start: number; end: number; assemblyName: string; reversed: boolean &#124; undefined; displayedRegionIndex: number; }[]</code></pre></dialog></span> | The on-screen content blocks under the field names `LinearGenomeView.visibleRegions` uses, so this axis and a synteny row hand the shared comparative fetch window (`syntenyFetchRegions`) the same thing and the two displays' `fetchRegions` are one call each. Carries only what that window reads; the screen-px pair an LGV also exposes has no reader here, and deriving it would make this recompute with `offsetPx`. |
| <span id="getter-fitbpperpx">**fitBpPerPx**</span><br><code>number</code> | The zoom that fits this axis' whole genome, with a tenth of the axis to spare. Its own getter, separate from `maxBpPerPx`, because on a locked plot the two differ — see `DotplotHView`. |
| <span id="getter-maxbpperpx">**maxBpPerPx**</span><br><code>number</code> |  |
| <span id="getter-minbpperpx">**minBpPerPx**</span><br><code>number</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-center">**center**</span><br><code>() =&gt; void</code> |  |
