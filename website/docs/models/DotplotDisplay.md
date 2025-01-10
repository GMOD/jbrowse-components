---
id: dotplotdisplay
title: DotplotDisplay
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
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
AnyConfigurationSchemaType
// code
configuration: ConfigurationReference(configSchema)
```

### DotplotDisplay - Getters

#### getter: rendererTypeName

```js
// type
any
```

### DotplotDisplay - Methods

#### method: renderProps

```js
// type signature
renderProps: () => any
```

#### method: renderSvg

```js
// type signature
renderSvg: (opts: ExportSvgOptions & { theme?: ThemeOptions; }) => Promise<Element>
```

### DotplotDisplay - Actions

#### action: setLoading

```js
// type signature
setLoading: (stopToken?: string) => void
```

#### action: setMessage

```js
// type signature
setMessage: (messageText: string) => void
```

#### action: setRendered

```js
// type signature
setRendered: (args?: { data: any; reactElement: ReactElement<unknown, string | JSXElementConstructor<any>>; renderingComponent: Component<{}, {}, any>; }) => void
```

#### action: setError

```js
// type signature
setError: (error: unknown) => void
```
