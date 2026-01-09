---
id: linearreaddisplaybasemixin
title: LinearReadDisplayBaseMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/shared/LinearReadDisplayBaseMixin.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearReadDisplayBaseMixin.md)

## Docs

Base mixin for all LinearRead displays (Cloud, Stack, Arcs) Contains common
volatile state, views, and actions shared across all three display types.
Composes with NonBlockCanvasDisplayMixin for the shared non-block canvas display
state.

extends

- [NonBlockCanvasDisplayMixin](../nonblockcanvasdisplaymixin)

### LinearReadDisplayBaseMixin - Properties

#### property: filterBySetting

Filter settings override (if set, overrides configuration)

```js
// type signature
IType<FilterBy, FilterBy, FilterBy>
// code
filterBySetting: types.frozen<FilterBy | undefined>()
```

#### property: colorBySetting

Color scheme settings override (if set, overrides configuration)

```js
// type signature
IType<ColorBy, ColorBy, ColorBy>
// code
colorBySetting: types.frozen<ColorBy | undefined>()
```

### LinearReadDisplayBaseMixin - Actions

#### action: setLastDrawnBpPerPx

Update the last drawn bp per pixel value

```js
// type signature
setLastDrawnBpPerPx: (n: number) => void
```

#### action: setColorScheme

Set the color scheme override

```js
// type signature
setColorScheme: (colorBy: { type: string; }) => void
```

#### action: setChainData

Set the chain data to render

```js
// type signature
setChainData: (args: ChainData) => void
```

#### action: setFilterBy

Set the filter override

```js
// type signature
setFilterBy: (filter: FilterBy) => void
```
