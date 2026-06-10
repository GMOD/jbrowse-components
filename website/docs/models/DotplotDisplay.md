---
id: dotplotdisplay
title: DotplotDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/dotplot-view/src/DotplotDisplay/stateModelFactory.tsx)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/DotplotDisplay.md)

## Overview

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseDisplay](../basedisplay)

**Properties:** id, type, rpcDriverName

**Getters:** parentTrack, parentDisplay, RenderingComponent, DisplayBlurb,
adapterConfig, isMinimized, effectiveRpcDriverName, effectiveTrackConfig,
rendererType, DisplayMessageComponent, viewMenuActions

**Methods:** renderProps, renderingProps, trackMenuItems, regionCannotBeRendered

**Actions:** setStatusMessage, setError, setRpcDriverName, reload

### DotplotDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"DotplotDisplay">
// code
type: types.literal('DotplotDisplay')
```

#### property: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

#### property: colorBy

color by setting that overrides the config setting

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
colorBy: types.optional(types.string, 'default')
```

#### property: alpha

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
alpha: types.optional(types.number, 1)
```

#### property: minAlignmentLength

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
minAlignmentLength: types.optional(types.number, 0)
```

### DotplotDisplay - Volatiles

#### volatile: rpcData

RPC-computed feature data

```js
// type signature
DotplotRpcData | undefined
// code
rpcData: undefined as DotplotRpcData | undefined
```

#### volatile: geometry

GPU-instance geometry produced from featPositions, self- describing via embedded
bpPerPx. The containing DotplotView aggregates one of these per display and
uploads them to the shared backend keyed by track index.

```js
// type signature
DotplotGeometryData | undefined
// code
geometry: undefined as DotplotGeometryData | undefined
```

### DotplotDisplay - Getters

#### getter: warnings

Per-render fetch warnings, plus the load-time reversed-assembly hint.

```js
// type
{
  message: string
  effect: string
}
;[]
```

### DotplotDisplay - Methods

#### method: renderSvg

```js
// type signature
renderSvg: (opts: ExportSvgOptions & { theme?: ThemeOptions | undefined; }) => Promise<string | number | bigint | boolean | Iterable<ReactNode> | Element | null | undefined>
```

### DotplotDisplay - Actions

#### action: setLoading

```js
// type signature
setLoading: (stopToken: StopToken) => void
```

#### action: setRpcData

```js
// type signature
setRpcData: (data: DotplotRpcData) => void
```

#### action: setError

```js
// type signature
setError: (error: unknown) => void
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
setColorBy: (value: SyntenyColorBy) => void
```
