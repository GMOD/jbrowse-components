---
id: trackheightmixin
title: TrackHeightMixin
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

## Source file

[plugins/linear-genome-view/src/BaseLinearDisplay/models/TrackHeightMixin.tsx](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/TrackHeightMixin.tsx)

## Docs

### TrackHeightMixin - Properties

#### property: heightPreConfig

```js
// type signature
IMaybe<ISimpleType<number>>
// code
heightPreConfig: types.maybe(
        types.refinement(
          'displayHeight',
          types.number,
          n => n >= minDisplayHeight,
        ),
      )
```

### TrackHeightMixin - Actions

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
