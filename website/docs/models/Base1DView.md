---
id: base1dview
title: Base1DView
sidebar_label: General -> Base1DView
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/Base1DViewModel.ts).

used in non-lgv view representations of a 1d view e.g. the two axes of the
dotplot use this. categorized General rather than View because it is not a
pluggable view type, which the name-suffix heuristic would otherwise assume

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  |
| <span id="property-displayedregions">**displayedRegions**</span><br><code>displayedRegions: types.optional(types.frozen&lt;IRegion[]&gt;(), [])</code> |  |
| <span id="property-bpperpx">**bpPerPx**</span><br><code>bpPerPx: 0</code> |  |
| <span id="property-offsetpx">**offsetPx**</span><br><code>offsetPx: 0</code> |  |
| <span id="property-minimumblockwidth">**minimumBlockWidth**</span><br><code>minimumBlockWidth: types.stripDefault(types.number, 0)</code> |  |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-volatilewidth">**volatileWidth**</span><br><code>volatileWidth: 0</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-width">**width**</span><br><code>number</code> |  |
| <span id="getter-minbpperpx">**minBpPerPx**</span><br><code>number</code> | zoom-in floor; overridden by extensions (e.g. the dotplot axes) |
| <span id="getter-maxbpperpx">**maxBpPerPx**</span><br><code>number</code> | zoom-out ceiling; overridden by extensions (e.g. the dotplot axes) |
| <span id="getter-assemblynames">**assemblyNames**</span><br><code>string[]</code> |  |
| <span id="getter-displayedregionstotalpx">**displayedRegionsTotalPx**</span><br><code>number</code> |  |
| <span id="getter-maxoffset">**maxOffset**</span><br><code>number</code> |  |
| <span id="getter-minoffset">**minOffset**</span><br><code>number</code> |  |
| <span id="getter-totalbp">**totalBp**</span><br><code>number</code> |  |
| <span id="getter-dynamicblocks">**dynamicBlocks**</span><br><code>BlockSet</code> |  |
| <span id="getter-staticblocks">**staticBlocks**</span><br><code>BlockSet</code> |  |
| <span id="getter-currbp">**currBp**</span><br><code>number</code> |  |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-pxtobp">**pxToBp**</span><br><code>(px: number) =&gt; PxToBpResult</code> |  |
| <span id="method-bptopx">**bpToPx**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(args: { refName: string; coord: number; displayedRegionIndex?:…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(args: { refName: string; coord: number; displayedRegionIndex?: number &#124; undefined; }) =&gt; number &#124; undefined</code></pre></dialog></span> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setdisplayedregions">**setDisplayedRegions**</span><br><code>(regions: Region[]) =&gt; void</code> |  |
| <span id="action-setbpperpx">**setBpPerPx**</span><br><code>(val: number) =&gt; void</code> |  |
| <span id="action-setvolatilewidth">**setVolatileWidth**</span><br><code>(width: number) =&gt; void</code> |  |
| <span id="action-showallregions">**showAllRegions**</span><br><code>() =&gt; void</code> | this makes a zoomed out view that shows all displayedRegions that makes the overview bar square with the scale bar |
| <span id="action-zoomout">**zoomOut**</span><br><code>() =&gt; void</code> |  |
| <span id="action-zoomin">**zoomIn**</span><br><code>() =&gt; void</code> |  |
| <span id="action-zoomto">**zoomTo**</span><br><code>(bpPerPx: number, offset?: any) =&gt; number</code> |  |
| <span id="action-scrollto">**scrollTo**</span><br><code>(offsetPx: number) =&gt; number</code> |  |
| <span id="action-centerat">**centerAt**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(coord: number, refName: string &#124; undefined, displayedRegionInd…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(coord: number, refName: string &#124; undefined, displayedRegionIndex: number) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-scroll">**scroll**</span><br><code>(distance: number) =&gt; number</code> | note: the scroll is clamped to keep the view on the main screen |
| <span id="action-moveto">**moveTo**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(start?: BpOffset &#124; undefined, end?: BpOffset &#124; undefined) =&gt; v…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(start?: BpOffset &#124; undefined, end?: BpOffset &#124; undefined) =&gt; void</code></pre></dialog></span> | offset is the base-pair-offset in the displayed region, index is the index of the displayed region in the linear genome view |
