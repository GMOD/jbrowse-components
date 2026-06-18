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

### TrackHeightMixin - Properties

#### property: heightOverride

the explicitly-set display height (e.g. from a drag-resize); the `height` getter
resolves this over the config `height` slot. Named with the `Override` suffix to
match the override convention used elsewhere (`configOverrides`, `setOverride`);
the bare `height` name belongs to the resolving getter.

```js
// type signature
IMaybe<ISimpleType<number>>
// code
heightOverride: types.maybe(
        types.refinement(
          'displayHeight',
          types.number,
          n => n >= minDisplayHeight,
        ),
      )
```

### TrackHeightMixin - Volatiles

#### volatile: scrollTop

```js
// type signature
number
// code
scrollTop: 0
```

### TrackHeightMixin - Getters

#### getter: height

```js
// type
number
```

### TrackHeightMixin - Actions

#### action: setScrollTop

```js
// type signature
setScrollTop: (scrollTop: number) => void
```

#### action: setHeight

```js
// type signature
setHeight: (displayHeight: number) => number
```

#### action: resizeHeight

```js
// type signature
resizeHeight: (distance: number) => number
```
