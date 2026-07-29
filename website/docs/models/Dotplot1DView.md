---
id: dotplot1dview
title: Dotplot1DView
sidebar_label: View -> Dotplot1DView
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`dotplot-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/dotplot-view/src/DotplotView/1dview.ts).

ref https://@jbrowse/mobx-state-tree.js.org/concepts/volatiles on volatile state
used here

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-dynamicblocks">**dynamicBlocks**</span><br><code>BlockSet</code> | this uses padding=false and elision=false |
| <span id="getter-maxbpperpx">**maxBpPerPx**</span><br><code>number</code> |  |
| <span id="getter-minbpperpx">**minBpPerPx**</span><br><code>number</code> |  |
| <span id="getter-maxoffset">**maxOffset**</span><br><code>number</code> | One rule at every zoom level: scroll until only `leftPadding` px of content remain visible on the right, or `rightPadding` px on the left.<br><br>Deliberately NOT special-cased for content narrower than the view. Pinning both bounds to the centered offset there gives zoomTo — which clamps its anchor-preserving offset into [minOffset, maxOffset] — a degenerate range, so the cursor anchor is silently discarded and the plot snaps back to centered. That was the max-zoom-out "edge jump": the first zoom step displaced the locus under the cursor by the centered-vs-anchored gap, which grows with distance from center (~41px near the edge, ~0 at the center). `center()` still centers explicitly, so the initial view is unchanged. |
| <span id="getter-minoffset">**minOffset**</span><br><code>number</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-center">**center**</span><br><code>() =&gt; void</code> |  |
