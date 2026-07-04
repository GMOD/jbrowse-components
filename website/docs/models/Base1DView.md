---
id: base1dview
title: Base1DView
sidebar_label: View -> Base1DView
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/util/Base1DViewModel.ts).

## Overview

used in non-lgv view representations of a 1d view e.g. the two axes of the
dotplot use this

<details>
<summary>Base1DView - Properties</summary>

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: displayedRegions

```ts
// type signature
type displayedRegions = IOptionalIType<
  IType<Region[], Region[], Region[]>,
  [undefined]
>
// code
displayedRegions: types.optional(types.frozen<IRegion[]>(), [])
```

#### property: bpPerPx

```ts
// type signature
type bpPerPx = number
// code
bpPerPx: 0
```

#### property: offsetPx

```ts
// type signature
type offsetPx = number
// code
offsetPx: 0
```

#### property: minimumBlockWidth

```ts
// type signature
type minimumBlockWidth = IOptionalIType<ISimpleType<number>, [undefined]>
// code
minimumBlockWidth: types.stripDefault(types.number, 0)
```

</details>

<details>
<summary>Base1DView - Volatiles</summary>

#### volatile: features

```ts
// type signature
type features = Feature[] | undefined
// code
features: undefined as undefined | Feature[]
```

#### volatile: volatileWidth

```ts
// type signature
type volatileWidth = number
// code
volatileWidth: 0
```

</details>

<details>
<summary>Base1DView - Getters</summary>

#### getter: width

```ts
type width = number
```

#### getter: assemblyNames

```ts
type assemblyNames = string[]
```

#### getter: displayedRegionsTotalPx

```ts
type displayedRegionsTotalPx = number
```

#### getter: maxOffset

```ts
type maxOffset = number
```

#### getter: minOffset

```ts
type minOffset = number
```

#### getter: totalBp

```ts
type totalBp = number
```

#### getter: dynamicBlocks

```ts
type dynamicBlocks = BlockSet
```

#### getter: staticBlocks

```ts
type staticBlocks = BlockSet
```

#### getter: currBp

```ts
type currBp = number
```

</details>

<details>
<summary>Base1DView - Methods</summary>

#### method: pxToBp

```ts
type pxToBp = (px: number) => PxToBpResult
```

#### method: bpToPx

```ts
type bpToPx = ({
  refName,
  coord,
  displayedRegionIndex,
}: {
  refName: string
  coord: number
  displayedRegionIndex?: number | undefined
}) => number | undefined
```

</details>

<details open>
<summary>Base1DView - Actions</summary>

#### action: showAllRegions

this makes a zoomed out view that shows all displayedRegions that makes the
overview bar square with the scale bar

```ts
type showAllRegions = () => void
```

#### action: scroll

note: the scroll is clamped to keep the view on the main screen

```ts
type scroll = (distance: number) => number
```

#### action: moveTo

offset is the base-pair-offset in the displayed region, index is the index of
the displayed region in the linear genome view

```ts
type moveTo = (start?: BpOffset | undefined, end?: BpOffset | undefined) => void
```

</details>

<details>
<summary>Base1DView - Actions (other undocumented members)</summary>

#### action: setDisplayedRegions

```ts
type setDisplayedRegions = (regions: Region[]) => void
```

#### action: setBpPerPx

```ts
type setBpPerPx = (val: number) => void
```

#### action: setVolatileWidth

```ts
type setVolatileWidth = (width: number) => void
```

#### action: setFeatures

```ts
type setFeatures = (features: Feature[]) => void
```

#### action: zoomOut

```ts
type zoomOut = () => void
```

#### action: zoomIn

```ts
type zoomIn = () => void
```

#### action: zoomTo

```ts
type zoomTo = (bpPerPx: number, offset?: any) => number
```

#### action: scrollTo

```ts
type scrollTo = (offsetPx: number) => number
```

#### action: centerAt

```ts
type centerAt = (
  coord: number,
  refName: string | undefined,
  displayedRegionIndex: number,
) => void
```

</details>
