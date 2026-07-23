---
id: dotplot1dview
title: Dotplot1DView
sidebar_label: View -> Dotplot1DView
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`dotplot-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/dotplot-view/src/DotplotView/1dview.ts).

## Overview

ref https://@jbrowse/mobx-state-tree.js.org/concepts/volatiles on volatile state
used here

## Members

| Member                                 | Kind    | Defined by    | Description                                                                                                                                |
| -------------------------------------- | ------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| [dynamicBlocks](#getter-dynamicblocks) | Getters | Dotplot1DView | this uses padding=false and elision=false                                                                                                  |
| [maxBpPerPx](#getter-maxbpperpx)       | Getters | Dotplot1DView |                                                                                                                                            |
| [minBpPerPx](#getter-minbpperpx)       | Getters | Dotplot1DView |                                                                                                                                            |
| [maxOffset](#getter-maxoffset)         | Getters | Dotplot1DView | One rule at every zoom level: scroll until only `leftPadding` px of content remain visible on the right, or `rightPadding` px on the left. |
| [minOffset](#getter-minoffset)         | Getters | Dotplot1DView |                                                                                                                                            |
| [center](#action-center)               | Actions | Dotplot1DView |                                                                                                                                            |

<details>
<summary>Dotplot1DView - Getters</summary>

#### getter: dynamicBlocks

this uses padding=false and elision=false

```ts
type dynamicBlocks = BlockSet
```

#### getter: maxOffset

One rule at every zoom level: scroll until only `leftPadding` px of content
remain visible on the right, or `rightPadding` px on the left.

Deliberately NOT special-cased for content narrower than the view. Pinning both
bounds to the centered offset there gives zoomTo — which clamps its
anchor-preserving offset into [minOffset, maxOffset] — a degenerate range, so
the cursor anchor is silently discarded and the plot snaps back to centered.
That was the max-zoom-out "edge jump": the first zoom step displaced the locus
under the cursor by the centered-vs-anchored gap, which grows with distance from
center (~41px near the edge, ~0 at the center). `center()` still centers
explicitly, so the initial view is unchanged.

```ts
type maxOffset = number
```

</details>

<details>
<summary>Dotplot1DView - Getters (other undocumented members)</summary>

| Member                                         | Type     |
| ---------------------------------------------- | -------- |
| <span id="getter-maxbpperpx">maxBpPerPx</span> | `number` |
| <span id="getter-minbpperpx">minBpPerPx</span> | `number` |
| <span id="getter-minoffset">minOffset</span>   | `number` |

</details>

<details>
<summary>Dotplot1DView - Actions</summary>

| Member                                 | Type         |
| -------------------------------------- | ------------ |
| <span id="action-center">center</span> | `() => void` |

</details>
