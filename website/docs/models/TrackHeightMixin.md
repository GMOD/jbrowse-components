---
id: trackheightmixin
title: TrackHeightMixin
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
