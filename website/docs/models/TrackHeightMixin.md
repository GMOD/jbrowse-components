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

<details open>
<summary>TrackHeightMixin - Properties</summary>

#### property: heightOverride

the explicitly-set display height (e.g. from a drag-resize); the `height` getter
resolves this over the config `height` slot. Named with the `Override` suffix to
match the override convention used elsewhere (`configOverrides`, `setOverride`);
the bare `height` name belongs to the resolving getter.

```ts
// type signature
type heightOverride = IMaybe<ISimpleType<number>>
// code
heightOverride: types.maybe(
  types.refinement('displayHeight', types.number, n => n >= minDisplayHeight),
)
```

</details>

<details open>
<summary>TrackHeightMixin - Volatiles</summary>

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

#### getter: height

```ts
type height = number
```

</details>

<details open>
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
