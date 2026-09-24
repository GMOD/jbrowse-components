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
| <span id="getter-refnamelabels">**refNameLabels**</span><br><code>Map&lt;string, string&gt;</code> | refName -> the string the axis prints for it. Off displayedRegions rather than the visible blocks, so panning and zooming can't change a label, and handed to `labelMarginPx` so the margin is sized against the very strings drawn. |
| <span id="getter-labelmarginpx">**labelMarginPx**</span><br><code>number</code> | The margin this axis' labels need beside the plot. Derived from regions and zoom only — never from the plot size — so it can't feed back through the plot size into a render loop. |
| <span id="getter-ticks">**ticks**</span><br><code>Tick[]</code> |  |
| <span id="getter-visibletickpositions">**visibleTickPositions**</span><br><code>VisibleTick[]</code> | The ticks that land on the drawn axis, thinned to what can be read and flagged for labelling. Clipped before thinning: spacing is a question about what is on screen, and offscreen ticks (staticBlocks run a screen past each edge) would otherwise claim slots from visible ones. |
| <span id="getter-blocklabelkeystohide">**blockLabelKeysToHide**</span><br><code>Set&lt;string&gt;</code> | Block-label keys whose labels would overlap, and are hidden |
| <span id="getter-regionsignature">**regionSignature**</span><br><code>string</code> | Signature of the displayed-region order and orientation, which a diagonalize reorder/flip changes and a zoom or pan does not. Its own primitive-valued computed so every display's fetch key reads it without rebuilding a string per region on each wheel step. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-center">**center**</span><br><code>() =&gt; void</code> |  |
