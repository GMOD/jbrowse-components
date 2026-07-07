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

| Member                               | Kind      | Description |
| ------------------------------------ | --------- | ----------- |
| [scrollTop](#volatile-scrolltop)     | Volatiles |             |
| [height](#getter-height)             | Getters   |             |
| [setScrollTop](#action-setscrolltop) | Actions   |             |
| [setHeight](#action-setheight)       | Actions   |             |
| [resizeHeight](#action-resizeheight) | Actions   |             |

<details>
<summary>TrackHeightMixin - Volatiles</summary>

#### volatile: scrollTop

```ts
// type signature
type scrollTop = number
// code
scrollTop: 0
```

</details>

<details>
<summary>TrackHeightMixin - Getters</summary>

#### getter: height

```ts
type height = number
```

</details>

<details>
<summary>TrackHeightMixin - Actions</summary>

#### action: setScrollTop

```ts
type setScrollTop = (scrollTop: number) => void
```

#### action: setHeight

```ts
type setHeight = (displayHeight: number) => number
```

#### action: resizeHeight

```ts
type resizeHeight = (distance: number) => number
```

</details>
