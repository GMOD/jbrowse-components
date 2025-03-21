---
id: linearsyntenydisplay
title: LinearSyntenyDisplay
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
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
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(configSchema)
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
{ [k: string]: FeatPos; }
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
