---
id: trackheightmixin
title: TrackHeightMixin
sidebar_label: Mixin -> TrackHeightMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/TrackHeightMixin.tsx)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/TrackHeightMixin.md)

## Overview

The display height is stored directly on the `height` config slot (drag-resize
writes it via `setSlot`), so it survives a track being unticked and reticked —
the config node outlives the ephemeral display instance. Displays with an
auto-fit mode declare `height` as a `maybeNumber` slot (default `undefined`) and
override the `height` getter to fall back to their computed content height when
unset.

<details open>
<summary>TrackHeightMixin - Volatiles</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                             | Signature |
| ---------------------------------- | --------- |
| [`scrollTop`](#volatile-scrolltop) | `number`  |

</details>

<details>
<summary>TrackHeightMixin - Volatiles (all signatures)</summary>

#### volatile: scrollTop

```ts
// type signature
type scrollTop = number
// code
scrollTop: 0
```

</details>

<details open>
<summary>TrackHeightMixin - Getters</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                     | Signature |
| -------------------------- | --------- |
| [`height`](#getter-height) | `number`  |

</details>

<details>
<summary>TrackHeightMixin - Getters (all signatures)</summary>

#### getter: height

```ts
type height = number
```

</details>

<details open>
<summary>TrackHeightMixin - Actions</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                 | Signature                           |
| -------------------------------------- | ----------------------------------- |
| [`setScrollTop`](#action-setscrolltop) | `(scrollTop: number) => void`       |
| [`setHeight`](#action-setheight)       | `(displayHeight: number) => number` |
| [`resizeHeight`](#action-resizeheight) | `(distance: number) => number`      |

</details>

<details>
<summary>TrackHeightMixin - Actions (all signatures)</summary>

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
