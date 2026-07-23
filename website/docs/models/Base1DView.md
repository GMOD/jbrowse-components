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

## Members

| Member                                                     | Kind       | Defined by | Description                                                                                                                  |
| ---------------------------------------------------------- | ---------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [id](#property-id)                                         | Properties | Base1DView |                                                                                                                              |
| [displayedRegions](#property-displayedregions)             | Properties | Base1DView |                                                                                                                              |
| [bpPerPx](#property-bpperpx)                               | Properties | Base1DView |                                                                                                                              |
| [offsetPx](#property-offsetpx)                             | Properties | Base1DView |                                                                                                                              |
| [minimumBlockWidth](#property-minimumblockwidth)           | Properties | Base1DView |                                                                                                                              |
| [volatileWidth](#volatile-volatilewidth)                   | Volatiles  | Base1DView |                                                                                                                              |
| [width](#getter-width)                                     | Getters    | Base1DView |                                                                                                                              |
| [minBpPerPx](#getter-minbpperpx)                           | Getters    | Base1DView | zoom-in floor; overridden by extensions (e.g. the dotplot axes)                                                              |
| [maxBpPerPx](#getter-maxbpperpx)                           | Getters    | Base1DView | zoom-out ceiling; overridden by extensions (e.g. the dotplot axes)                                                           |
| [assemblyNames](#getter-assemblynames)                     | Getters    | Base1DView |                                                                                                                              |
| [displayedRegionsTotalPx](#getter-displayedregionstotalpx) | Getters    | Base1DView |                                                                                                                              |
| [maxOffset](#getter-maxoffset)                             | Getters    | Base1DView |                                                                                                                              |
| [minOffset](#getter-minoffset)                             | Getters    | Base1DView |                                                                                                                              |
| [totalBp](#getter-totalbp)                                 | Getters    | Base1DView |                                                                                                                              |
| [dynamicBlocks](#getter-dynamicblocks)                     | Getters    | Base1DView |                                                                                                                              |
| [staticBlocks](#getter-staticblocks)                       | Getters    | Base1DView |                                                                                                                              |
| [currBp](#getter-currbp)                                   | Getters    | Base1DView |                                                                                                                              |
| [pxToBp](#method-pxtobp)                                   | Methods    | Base1DView |                                                                                                                              |
| [bpToPx](#method-bptopx)                                   | Methods    | Base1DView |                                                                                                                              |
| [setDisplayedRegions](#action-setdisplayedregions)         | Actions    | Base1DView |                                                                                                                              |
| [setBpPerPx](#action-setbpperpx)                           | Actions    | Base1DView |                                                                                                                              |
| [setVolatileWidth](#action-setvolatilewidth)               | Actions    | Base1DView |                                                                                                                              |
| [showAllRegions](#action-showallregions)                   | Actions    | Base1DView | this makes a zoomed out view that shows all displayedRegions that makes the overview bar square with the scale bar           |
| [zoomOut](#action-zoomout)                                 | Actions    | Base1DView |                                                                                                                              |
| [zoomIn](#action-zoomin)                                   | Actions    | Base1DView |                                                                                                                              |
| [zoomTo](#action-zoomto)                                   | Actions    | Base1DView |                                                                                                                              |
| [scrollTo](#action-scrollto)                               | Actions    | Base1DView |                                                                                                                              |
| [centerAt](#action-centerat)                               | Actions    | Base1DView |                                                                                                                              |
| [scroll](#action-scroll)                                   | Actions    | Base1DView | note: the scroll is clamped to keep the view on the main screen                                                              |
| [moveTo](#action-moveto)                                   | Actions    | Base1DView | offset is the base-pair-offset in the displayed region, index is the index of the displayed region in the linear genome view |

<details>
<summary>Base1DView - Properties</summary>

| Member                                                         | Type                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------ |
| <span id="property-id">id</span>                               | `IOptionalIType<ISimpleType<string>, [undefined]>`                 |
| <span id="property-displayedregions">displayedRegions</span>   | `IOptionalIType<IType<Region[], Region[], Region[]>, [undefined]>` |
| <span id="property-bpperpx">bpPerPx</span>                     | `number`                                                           |
| <span id="property-offsetpx">offsetPx</span>                   | `number`                                                           |
| <span id="property-minimumblockwidth">minimumBlockWidth</span> | `IOptionalIType<ISimpleType<number>, [undefined]>`                 |

</details>

<details>
<summary>Base1DView - Volatiles</summary>

| Member                                                 | Type     |
| ------------------------------------------------------ | -------- |
| <span id="volatile-volatilewidth">volatileWidth</span> | `number` |

</details>

<details>
<summary>Base1DView - Getters</summary>

#### getter: minBpPerPx

zoom-in floor; overridden by extensions (e.g. the dotplot axes)

```ts
type minBpPerPx = number
```

#### getter: maxBpPerPx

zoom-out ceiling; overridden by extensions (e.g. the dotplot axes)

```ts
type maxBpPerPx = number
```

</details>

<details>
<summary>Base1DView - Getters (other undocumented members)</summary>

| Member                                                                   | Type       |
| ------------------------------------------------------------------------ | ---------- |
| <span id="getter-width">width</span>                                     | `number`   |
| <span id="getter-assemblynames">assemblyNames</span>                     | `string[]` |
| <span id="getter-displayedregionstotalpx">displayedRegionsTotalPx</span> | `number`   |
| <span id="getter-maxoffset">maxOffset</span>                             | `number`   |
| <span id="getter-minoffset">minOffset</span>                             | `number`   |
| <span id="getter-totalbp">totalBp</span>                                 | `number`   |
| <span id="getter-dynamicblocks">dynamicBlocks</span>                     | `BlockSet` |
| <span id="getter-staticblocks">staticBlocks</span>                       | `BlockSet` |
| <span id="getter-currbp">currBp</span>                                   | `number`   |

</details>

<details>
<summary>Base1DView - Methods</summary>

| Member                                 | Type                                                                                                             |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| <span id="method-pxtobp">pxToBp</span> | `(px: number) => PxToBpResult`                                                                                   |
| <span id="method-bptopx">bpToPx</span> | `(args: { refName: string; coord: number; displayedRegionIndex?: number \| undefined; }) => number \| undefined` |

</details>

<details>
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

| Member                                                           | Type                                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| <span id="action-setdisplayedregions">setDisplayedRegions</span> | `(regions: Region[]) => void`                                                         |
| <span id="action-setbpperpx">setBpPerPx</span>                   | `(val: number) => void`                                                               |
| <span id="action-setvolatilewidth">setVolatileWidth</span>       | `(width: number) => void`                                                             |
| <span id="action-zoomout">zoomOut</span>                         | `() => void`                                                                          |
| <span id="action-zoomin">zoomIn</span>                           | `() => void`                                                                          |
| <span id="action-zoomto">zoomTo</span>                           | `(bpPerPx: number, offset?: any) => number`                                           |
| <span id="action-scrollto">scrollTo</span>                       | `(offsetPx: number) => number`                                                        |
| <span id="action-centerat">centerAt</span>                       | `(coord: number, refName: string \| undefined, displayedRegionIndex: number) => void` |

</details>
