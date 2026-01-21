---
id: linearsyntenydisplay
title: LinearSyntenyDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearSyntenyDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearSyntenyDisplay.md)

## Docs

extends

- [LinearComparativeDisplay](../linearcomparativedisplay)

### LinearSyntenyDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearSyntenyDisplay">
// code
type: types.literal('LinearSyntenyDisplay')
```

#### property: configuration

```js
// type signature
any
// code
configuration: ConfigurationReference(configSchema)
```

#### property: colorBy

color scheme to use for rendering synteny features

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
colorBy: types.optional(types.string, 'default')
```

#### property: alpha

alpha transparency value for synteny drawing (0-1)

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
alpha: types.optional(types.number, 0.2)
```

#### property: minAlignmentLength

minimum alignment length to display (in bp)

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
minAlignmentLength: types.optional(types.number, 0)
```

### LinearSyntenyDisplay - Getters

#### getter: adapterConfig

```js
// type
any
```

#### getter: trackIds

```js
// type
string[]
```

#### getter: numFeats

```js
// type
number
```

#### getter: ready

used for synteny svg rendering

```js
// type
boolean
```

#### getter: featMap

```js
// type
any
```

#### getter: colorSchemeConfig

cached color scheme config based on colorBy

```js
// type
{ cigarColors: { I: string; N: string; D: string; X: string; M: string; '=': string; }; }
```

#### getter: colorMapWithAlpha

cached CIGAR colors with alpha applied

```js
// type
{ I: any; N: any; D: any; X: any; M: any; '=': any; }
```

#### getter: posColorWithAlpha

cached positive strand color with alpha

```js
// type
any
```

#### getter: negColorWithAlpha

cached negative strand color with alpha

```js
// type
any
```

#### getter: queryColorWithAlphaMap

cached query colors with alpha - returns a function that caches results

```js
// type
(queryName: string) => string
```

#### getter: queryTotalLengths

cached query total lengths for minAlignmentLength filtering

```js
// type
Map<string, number>
```

### LinearSyntenyDisplay - Actions

#### action: setFeatPositions

```js
// type signature
setFeatPositions: (arg: FeatPos[]) => void
```

#### action: setMainCanvasRef

```js
// type signature
setMainCanvasRef: (ref: HTMLCanvasElement) => void
```

#### action: setClickMapCanvasRef

```js
// type signature
setClickMapCanvasRef: (ref: HTMLCanvasElement) => void
```

#### action: setCigarClickMapCanvasRef

```js
// type signature
setCigarClickMapCanvasRef: (ref: HTMLCanvasElement) => void
```

#### action: setMouseoverCanvasRef

```js
// type signature
setMouseoverCanvasRef: (ref: HTMLCanvasElement) => void
```

#### action: setMouseoverId

```js
// type signature
setMouseoverId: (arg?: string) => void
```

#### action: setCigarMouseoverId

```js
// type signature
setCigarMouseoverId: (arg: number) => void
```

#### action: setClickId

```js
// type signature
setClickId: (arg?: string) => void
```

#### action: setAlpha

```js
// type signature
setAlpha: (value: number) => void
```

#### action: setMinAlignmentLength

```js
// type signature
setMinAlignmentLength: (value: number) => void
```

#### action: setColorBy

```js
// type signature
setColorBy: (value: string) => void
```
