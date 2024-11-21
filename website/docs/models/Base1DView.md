---
id: base1dview
title: Base1DView
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[packages/core/util/Base1DViewModel.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/util/Base1DViewModel.ts)

used in non-lgv view representations of a 1d view e.g. the two axes of the
dotplot use this

### Base1DView - Properties

#### property: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: displayedRegions

```js
// type signature
IOptionalIType<IType<Region[], Region[], Region[]>, [undefined]>
// code
displayedRegions: types.optional(types.frozen<IRegion[]>(), [])
```

#### property: bpPerPx

```js
// type signature
number
// code
bpPerPx: 0
```

#### property: offsetPx

```js
// type signature
number
// code
offsetPx: 0
```

#### property: interRegionPaddingWidth

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
interRegionPaddingWidth: types.optional(types.number, 0)
```

#### property: minimumBlockWidth

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
minimumBlockWidth: types.optional(types.number, 0)
```

### Base1DView - Getters

#### getter: width

```js
// type
number
```

#### getter: assemblyNames

```js
// type
any[]
```

#### getter: displayedRegionsTotalPx

```js
// type
number
```

#### getter: maxOffset

```js
// type
number
```

#### getter: minOffset

```js
// type
number
```

#### getter: totalBp

```js
// type
number
```

#### getter: dynamicBlocks

```js
// type
BlockSet
```

#### getter: staticBlocks

```js
// type
BlockSet
```

#### getter: currBp

```js
// type
number
```

### Base1DView - Methods

#### method: pxToBp

```js
// type signature
pxToBp: (px: number) => { coord: number; index: number; refName: string; oob: boolean; assemblyName: string; offset: number; start: number; end: number; reversed?: boolean; }
```

#### method: bpToPx

```js
// type signature
bpToPx: ({ refName, coord, regionNumber, }: { refName: string; coord: number; regionNumber?: number; }) => number
```

### Base1DView - Actions

#### action: setDisplayedRegions

```js
// type signature
setDisplayedRegions: (regions: Region[]) => void
```

#### action: setBpPerPx

```js
// type signature
setBpPerPx: (val: number) => void
```

#### action: setVolatileWidth

```js
// type signature
setVolatileWidth: (width: number) => void
```

#### action: setFeatures

```js
// type signature
setFeatures: (features: Feature[]) => void
```

#### action: showAllRegions

this makes a zoomed out view that shows all displayedRegions that makes the
overview bar square with the scale bar

```js
// type signature
showAllRegions: () => void
```

#### action: zoomOut

```js
// type signature
zoomOut: () => void
```

#### action: zoomIn

```js
// type signature
zoomIn: () => void
```

#### action: zoomTo

```js
// type signature
zoomTo: (bpPerPx: number, offset?: number) => number
```

#### action: scrollTo

```js
// type signature
scrollTo: (offsetPx: number) => number
```

#### action: centerAt

```js
// type signature
centerAt: (coord: number, refName: string, regionNumber: number) => void
```

#### action: scroll

note: the scroll is clamped to keep the view on the main screen

```js
// type signature
scroll: (distance: number) => number
```

#### action: moveTo

offset is the base-pair-offset in the displayed region, index is the index of
the displayed region in the linear genome view

```js
// type signature
moveTo: (start?: BpOffset, end?: BpOffset) => void
```
