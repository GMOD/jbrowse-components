---
id: linearreadarcsdisplaysettingsmixin
title: LinearReadArcsDisplaySettingsMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/shared/LinearReadArcsDisplaySettingsMixin.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearReadArcsDisplaySettingsMixin.md)

## Docs

Mixin for LinearReadArcsDisplay-specific settings Contains arc rendering options
like line width, jitter, and connection toggles

### LinearReadArcsDisplaySettingsMixin - Properties

#### property: lineWidth

Width of the arc lines (thin, bold, extra bold)

```js
// type signature
IMaybe<ISimpleType<number>>
// code
lineWidth: types.maybe(types.number)
```

#### property: jitter

Jitter amount for x-position to better visualize overlapping arcs

```js
// type signature
IMaybe<ISimpleType<number>>
// code
jitter: types.maybe(types.number)
```

#### property: drawInter

Whether to draw inter-region vertical lines

```js
// type signature
true
// code
drawInter: true
```

#### property: drawLongRange

Whether to draw long-range connections

```js
// type signature
true
// code
drawLongRange: true
```

### LinearReadArcsDisplaySettingsMixin - Getters

#### getter: lineWidthSetting

```js
// type
any
```

#### getter: jitterVal

```js
// type
number
```

### LinearReadArcsDisplaySettingsMixin - Actions

#### action: setDrawInter

Toggle drawing of inter-region vertical lines

```js
// type signature
setDrawInter: (f: boolean) => void
```

#### action: setDrawLongRange

Toggle drawing of long-range connections

```js
// type signature
setDrawLongRange: (f: boolean) => void
```

#### action: setLineWidth

Set the line width (thin=1, bold=2, extrabold=5, etc)

```js
// type signature
setLineWidth: (n: number) => void
```

#### action: setJitter

Set jitter amount for x-position Helpful to jitter the x direction so you see
better evidence when e.g. 100 long reads map to same x position

```js
// type signature
setJitter: (n: number) => void
```
