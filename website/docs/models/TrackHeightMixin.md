---
id: trackheightmixin
title: TrackHeightMixin
sidebar_label: Mixin -> TrackHeightMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`linear-genome-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/TrackHeightMixin.tsx).

## Overview

The display height is stored directly on the `height` config slot (drag-resize
writes it via `setSlot`), so it survives a track being unticked and reticked —
the config node outlives the ephemeral display instance. Displays with an
auto-fit mode declare `height` as a `maybeNumber` slot (default `undefined`) and
override the `height` getter to fall back to their computed content height when
unset.

## Members

| Member                               | Kind      | Defined by       | Description |
| ------------------------------------ | --------- | ---------------- | ----------- |
| [scrollTop](#volatile-scrolltop)     | Volatiles | TrackHeightMixin |             |
| [height](#getter-height)             | Getters   | TrackHeightMixin |             |
| [setScrollTop](#action-setscrolltop) | Actions   | TrackHeightMixin |             |
| [setHeight](#action-setheight)       | Actions   | TrackHeightMixin |             |
| [resizeHeight](#action-resizeheight) | Actions   | TrackHeightMixin |             |

<details>
<summary>TrackHeightMixin - Volatiles</summary>

| Member                                         | Type     |
| ---------------------------------------------- | -------- |
| <span id="volatile-scrolltop">scrollTop</span> | `number` |

</details>

<details>
<summary>TrackHeightMixin - Getters</summary>

| Member                                 | Type     |
| -------------------------------------- | -------- |
| <span id="getter-height">height</span> | `number` |

</details>

<details>
<summary>TrackHeightMixin - Actions</summary>

| Member                                             | Type                                |
| -------------------------------------------------- | ----------------------------------- |
| <span id="action-setscrolltop">setScrollTop</span> | `(scrollTop: number) => void`       |
| <span id="action-setheight">setHeight</span>       | `(displayHeight: number) => number` |
| <span id="action-resizeheight">resizeHeight</span> | `(distance: number) => number`      |

</details>
