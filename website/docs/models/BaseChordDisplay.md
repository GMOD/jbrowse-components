---
id: basechorddisplay
title: BaseChordDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/BaseChordDisplay/model.tsx)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/BaseChordDisplay.md)

## Docs

extends

- [BaseDisplay](../basedisplay)

### BaseChordDisplay - Properties

#### property: bezierRadiusRatio

```js
// type signature
number
// code
bezierRadiusRatio: 0.1
```

#### property: assemblyName

```js
// type signature
IMaybe<ISimpleType<string>>
// code
assemblyName: types.maybe(types.string)
```

#### property: configuration

```js
// type signature
ConfigurationSchemaType<{ onChordClick: { type: string; description: string; defaultValue: boolean; contextVariable: string[]; }; }, ConfigurationSchemaOptions<undefined, "displayId">>
// code
configuration: ConfigurationReference(baseChordDisplayConfig)
```

### BaseChordDisplay - Getters

#### getter: blockDefinitions

```js
// type
any[]
```

#### getter: rendererType

the pluggable element type object for this display's renderer

```js
// type
RendererType
```

#### getter: selectedFeatureId

returns a string feature ID if the globally-selected object is probably a
feature

```js
// type
string
```

### BaseChordDisplay - Methods

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

### BaseChordDisplay - Actions

#### action: onChordClick

```js
// type signature
onChordClick: (feature: Feature) => void
```

#### action: renderStarted

```js
// type signature
renderStarted: () => void
```

#### action: renderSuccess

```js
// type signature
renderSuccess: ({ message, data, reactElement, html, renderingComponent, }: { message?: string; data?: any; html?: string; reactElement?: ReactElement<unknown, string | JSXElementConstructor<any>>; renderingComponent?: React.ComponentType<any>; }) => void
```

#### action: renderError

```js
// type signature
renderError: (error: unknown) => void
```

#### action: setRefNameMap

```js
// type signature
setRefNameMap: (refNameMap: Record<string, string>) => void
```
