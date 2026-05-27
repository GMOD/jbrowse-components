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

## Docs

### DotplotDisplay - Properties

#### propertie: type

```js
// type signature
ISimpleType<"DotplotDisplay">
// code
type: types.literal('DotplotDisplay')
```

#### propertie: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

#### propertie: colorBy

color by setting that overrides the config setting

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
colorBy: types.optional(types.string, 'default')
```

#### propertie: alpha

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
alpha: types.optional(types.number, 1)
```

#### propertie: minAlignmentLength

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
minAlignmentLength: types.optional(types.number, 0)
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
