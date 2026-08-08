---
id: multilinearwiggledisplay
title: MultiLinearWiggleDisplay
sidebar_label: Display -> MultiLinearWiggleDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`wiggle` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/MultiLinearWiggleDisplay/model.ts).

## Example usage

The two row-ordering triggers are display _properties_, not config slots, so
they go on the display node in a session — `defaultSession` here, and the same
shape a `session=spec-` link carries. Written on the track config's own
`displays` entry they would be dropped as unknown slots.

`runClustering` is a transient declarative launch spec, the same idea as
`LinearGenomeView`'s `init`: it runs the real "Cluster columns" RPC once
automatically (no dialog) as soon as subtrack data is available, then clears
itself so a saved session never re-triggers it. `sortRowsBy` is the other one,
and the declarative form of the right-click "Sort rows by score here" — where
clustering orders rows by the whole region in view, this ranks them by the score
each carries at one base, so a cohort can open already ranked at a candidate
locus with the surrounding context still on screen. Use one or the other;
whichever applies last owns the row order.

```js
defaultSession: {
  name: 'Copy number at CCL3L1',
  views: [
    {
      type: 'LinearGenomeView',
      init: {
        assembly: 'hg38',
        loc: 'chr17:36,080,000-36,270,000',
        tracks: [
          {
            trackId: 'pur_copynumber_1000g',
            type: 'MultiLinearWiggleDisplay',
            sortRowsBy: { refName: 'chr17', pos: 36180000 },
          },
        ],
      },
    },
  ],
}
```

How many rows a color key may have and still be one. Past this it is a list of
every source, which is the thing a key exists instead of; a multi-row track that
long is better read off its own sidebar even at a swatch.

Wiggle display overlaying/stacking multiple quantitative subtracks in one area,
with optional clustering and a tree sidebar.

The configuration slots for this model are documented on its
[config schema page](../../config/multilinearwiggledisplay).

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal('MultiLinearWiggleDisplay')</code> |  |
| <span id="property-configuration">**configuration**</span><br><code>configuration: ConfigurationReference(configSchema)</code> |  |
| <span id="property-sortrowsby">**sortRowsBy**</span><br><code>sortRowsBy: types.maybe(types.frozen&lt;RowSortSpec&gt;())</code> | Transient declarative launch spec, the same idea as `runClustering`: set `{refName, pos}` to rank the rows once by the score each subtrack carries at that base — the session-expressible form of the right-click "Sort rows by score here". `setupRowSortAutorun` applies it once the region containing it has loaded and then clears it, so the row order persists but a saved session never re-sorts.<br><br>This is what lets a figure show a cohort ranked at a candidate CNV: clustering orders rows by the whole region in view, `layout` states an order outright, and only this one says "rank them here". |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-sourcesvolatile">**sourcesVolatile**</span><br><code>sourcesVolatile: [] as SourceInfo[]</code> |  |
| <span id="volatile-contextmenuinfo">**contextMenuInfo**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>contextMenuInfo: undefined as &#124; (ContextMenuAnchor &amp; MultiWiggl…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>contextMenuInfo: undefined as&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#124; (ContextMenuAnchor &amp; MultiWiggleContextHit)&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#124; undefined</code></pre></dialog></span> | Where the right-click menu opens (viewport coords) plus the genomic column it was opened over, as one value — the menu's open-ness and the position its items act on can't disagree. Undefined = closed. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-isdensitymode">**isDensityMode**</span><br><code>boolean</code> |  |
| <span id="getter-isoverlay">**isOverlay**</span><br><code>boolean</code> |  |
| <span id="getter-sourceswithoutlayout">**sourcesWithoutLayout**</span><br><code>SourceInfo[]</code> |  |
| <span id="getter-editablesources">**editableSources**</span><br><code>SourceInfo[]</code> |  |
| <span id="getter-sources">**sources**</span><br><code>SourceInfo[]</code> |  |
| <span id="getter-numsources">**numSources**</span><br><code>number</code> |  |
| <span id="getter-autoscalesourcenames">**autoscaleSourceNames**</span><br><code>Set&lt;string&gt;</code> |  |
| <span id="getter-effectiverowheight">**effectiveRowHeight**</span><br><code>number</code> | Resolved per-row height. This display is always fit-to-display-height — there is no pinned-height setting and so no `rowHeight` sentinel to resolve — but it carries the same name every row display exposes its resolved height under (see agent-docs/reference/ROW_HEIGHT_AND_FIT), which is also what tree-sidebar's `TreeDrawingModel` reads. |
| <span id="getter-numrows">**numRows**</span><br><code>number</code> | Rows actually drawn: overlay collapses every source onto one shared plot. Read by the render state and by everything that repeats itself per row (scalebars, cross hatches), so they can't disagree about how many rows exist. |
| <span id="getter-rowheighttoosmallforscalebar">**rowHeightTooSmallForScalebar**</span><br><code>boolean</code> |  |
| <span id="getter-scoreramp">**scoreRamp**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ posColor: string; negColor: string; pivot: number; gradientId…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ posColor: string; negColor: string; pivot: number; gradientId: string; } &#124; undefined</code></pre></dialog></span> | The color ramp the density legend draws, or undefined when there is no single ramp to describe. Only density spends color on the score, and only when every row shares the one ramp: a source with its own color is drawn on its own pos side (see buildSourceRenderData), so a single bar would describe none of them. |
| <span id="getter-ticks">**ticks**</span><br><code>YScaleTicks &#124; undefined</code> |  |
| <span id="getter-renderstate">**renderState**</span><br><code>WiggleGPURenderState</code> |  |
| <span id="getter-showtree">**showTree**</span><br><code>boolean</code> |  |
| <span id="getter-showbranchlength">**showBranchLength**</span><br><code>boolean</code> |  |
| <span id="getter-showrowseparators">**showRowSeparators**</span><br><code>boolean</code> |  |
| <span id="getter-showlegend">**showLegend**</span><br><code>boolean</code> |  |
| <span id="getter-overlaylegendapplies">**overlayLegendApplies**</span><br><code>boolean</code> | Whether the source color key applies at all. Gates the menu checkbox, which has to stay visible while the legend is toggled off.<br><br>One source needs no key. Beyond that the question is whether anything ELSE on the frame names the colors:<br><br>- overlay collapses every source onto one plot, so nothing does, and a key is the only identification there has ever been; - a multi-row track normally names its rows in the sidebar, so a key would restate it — but only while the rows are tall enough to carry text. Below `MIN_TEXT_ROW_HEIGHT` `SvgRowLabels` drops to an unlabelled color swatch, and a per-cell density track at 0.14 px a row is then a stripe of nine colors with nothing saying what any of them is. That is the case this getter was widened for ("we need to make it so density can show legend also ideally because the left side labels are too small to see"), and the threshold is imported rather than restated so the two cannot drift.<br><br>The entry COUNT is the other half, and it is asked of the collapsed list rather than of `numSources`: `buildLegendEntries` folds sources into one row per group where a group's colors agree, so 4,390 cells in nine cell types are nine entries — and a track whose groups disagree, or which has none, would be 4,390, which is not a key. A list longer than a reader can scan is worse than the swatch stripe it would explain. |
| <span id="getter-prefersoffset">**prefersOffset**</span><br><code>boolean</code> | Offset the track label above the visualization so the stacked per-source rows aren't hidden behind an overlapping label. |
| <span id="getter-hasoverlaylegend">**hasOverlayLegend**</span><br><code>boolean</code> | Whether the overlay color key actually draws. The on-screen overlay and the SVG export both read this, so a dismissed legend can't linger in the export. |
| <span id="getter-hierarchy">**hierarchy**</span><br><code>ClusterHierarchyNode &#124; undefined</code> | The positioned dendrogram, or undefined in an overlay mode: overlay collapses every source onto one row, so a tree spreading its leaves over the full height would align to nothing. This is the single gate — the on-screen sidebar, the SVG export, `spatialIndex` (subtree hover), and `treeSidebarRightEdge` (the tooltip/crosshair dead zone the sidebar reserves) all read it, so none of them can keep drawing or reserving space on their own. A subtree filter set in a row mode still applies and is still clearable from the track menu and MultiWiggleHint. |
| <span id="getter-spatialindex">**spatialIndex**</span><br><code>{ index: Flatbush; nodes: ClusterHierarchyNode[]; } &#124; undefined</code> |  |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-rpcprops">**rpcProps**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>() =&gt; { bicolorPivot: number; resolution: number; summaryScoreM…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>() =&gt; { bicolorPivot: number; resolution: number; summaryScoreMode: string; }</code></pre></dialog></span> |  |
| <span id="method-gpuprops">**gpuProps**</span><br><code>() =&gt; {…}</code> |  |
| <span id="method-trackmenuitems">**trackMenuItems**</span><br><code>() =&gt; MenuItem[]</code> |  |
| <span id="method-contextmenuitems">**contextMenuItems**</span><br><code>() =&gt; MenuItem[]</code> | Right-click menu, built from the column the click landed on. The position is captured here rather than read inside the onClick, because `closeContextMenu` runs first when an item is clicked. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-cleardisplayspecificdata">**clearDisplaySpecificData**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setrpcdata">**setRpcData**</span><br><code>(displayedRegionIndex: number, data: WiggleDataResult) =&gt; void</code> |  |
| <span id="action-startrenderingbackend">**startRenderingBackend**</span><br><code>(backend: WiggleRenderingBackend) =&gt; void</code> |  |
| <span id="action-setshowtree">**setShowTree**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-setshowbranchlength">**setShowBranchLength**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-setshowrowseparators">**setShowRowSeparators**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-setshowlegend">**setShowLegend**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-sortrowsbyscoreat">**sortRowsByScoreAt**</span><br><code>(refName: string, pos: number) =&gt; void</code> | Rank the rows by each source's score at one genomic base. Reads the region data already in hand — no refetch, no RPC — and writes the order through `layout`, the same channel clustering and the arrangement dialog write, so "Reset row order" undoes all three.<br><br>Named by coordinate rather than by loaded-region index because both entry points are: the right-click hit resolves to one, and a session's `sortRowsBy` carries one across a reload. The region is looked up here, and a position no loaded region covers is left alone rather than sorted against nothing (which would rank every row equally and read as the sort having silently done nothing). |
| <span id="action-setsortrowsby">**setSortRowsBy**</span><br><code>(arg?: RowSortSpec &#124; undefined) =&gt; void</code> | Trigger (or clear) a one-shot declarative row sort; consumed and reset by `setupRowSortAutorun`. The right-click menu calls `sortRowsByScoreAt` directly (instant, the data is already loaded); this prop is the session-level entry point. |
| <span id="action-opencontextmenu">**openContextMenu**</span><br><code>(info: ContextMenuAnchor &amp; MultiWiggleContextHit) =&gt; void</code> |  |
| <span id="action-closecontextmenu">**closeContextMenu**</span><br><code>() =&gt; void</code> |  |
| <span id="action-fetchneeded">**fetchNeeded**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(needed: { region: Region; displayedRegionIndex: number; }[]) =…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(needed: { region: Region; displayedRegionIndex: number; }[]) =&gt; Promise&lt;void&gt;</code></pre></dialog></span> |  |
| <span id="action-rendersvg">**renderSvg**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(opts?: ExportSvgDisplayOptions &#124; undefined) =&gt; Promise&lt;ReactEl…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(opts?: ExportSvgDisplayOptions &#124; undefined) =&gt; Promise&lt;ReactElement&lt;unknown, string &#124; JSXElementConstructor&lt;any&gt;&gt; &#124; Iterable&lt;...&gt; &#124; AwaitedReactNode&gt;</code></pre></dialog></span> |  |
