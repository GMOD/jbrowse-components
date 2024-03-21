---
id: basechorddisplay
title: BaseChordDisplay
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/circular-view/src/BaseChordDisplay/models/model.tsx](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/BaseChordDisplay/models/model.tsx)

extends

- [BaseDisplay](../basedisplay)

### BaseChordDisplay - Properties

#### property: assemblyName

```js
// type signature
IMaybe<ISimpleType<string>>
// code
assemblyName: types.maybe(types.string)
```

#### property: bezierRadiusRatio

```js
// type signature
number
// code
bezierRadiusRatio: 0.1
```

#### property: configuration

```js
// type signature
ConfigurationSchemaType<{ onChordClick: { contextVariable: string[]; defaultValue: boolean; description: string; type: string; }; }, ConfigurationSchemaOptions<undefined, "displayId">>
// code
configuration: ConfigurationReference(baseChordDisplayConfig)
```

### BaseChordDisplay - Getters

#### getter: blockDefinitions

```js
// type
any
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

#### method: isCompatibleWithRenderer

```js
// type signature
isCompatibleWithRenderer: (renderer: RendererType) => boolean
```

#### method: renderProps

```js
// type signature
renderProps: () => any
```

#### method: renderSvg

```js
// type signature
renderSvg: (opts: ExportSvgOptions & { theme: ThemeOptions; }) => Promise<Element>
```

### BaseChordDisplay - Actions

#### action: onChordClick

```js
// type signature
onChordClick: (feature: Feature) => void
```

#### action: renderError

```js
// type signature
renderError: (error: unknown) => void
```

#### action: renderStarted

```js
// type signature
renderStarted: () => void
```

#### action: renderSuccess

```js
// type signature
renderSuccess: ({ message, data, reactElement, html, renderingComponent, }: { message: string; data: any; html: string; reactElement: React.ReactElement; renderingComponent: React.ComponentType<any>; }) => void
```

#### action: setRefNameMap

```js
// type signature
setRefNameMap: (refNameMap: Record<string, string>) => void
```
