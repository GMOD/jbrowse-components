---
id: chordvariantdisplay
title: ChordVariantDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/ChordVariantDisplay/models/stateModelFactory.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/ChordVariantDisplay.md)

## Docs

extends

- [BaseDisplay](../basedisplay)

### ChordVariantDisplay - Properties

#### propertie: type

```js
// type signature
ISimpleType<"ChordVariantDisplay">
// code
type: types.literal('ChordVariantDisplay')
```

#### propertie: bezierRadiusRatio

```js
// type signature
number
// code
bezierRadiusRatio: 0.1
```

#### propertie: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

### ChordVariantDisplay - Getters

#### getter: ready

```js
// type
boolean
```

#### getter: blockDefinitions

```js
// type
Slice[]
```

#### getter: selectedFeatureId

```js
// type
string | undefined
```

### ChordVariantDisplay - Methods

#### method: renderSvg

```js
// type signature
renderSvg: (_opts: ExportSvgOptions & { theme?: ThemeOptions | undefined; }) => Promise<Element | null>
```

### ChordVariantDisplay - Actions

#### action: onChordClick

```js
// type signature
onChordClick: (feature: Feature) => void
```

#### action: setFeatures

```js
// type signature
setFeatures: (features: Map<string, Feature>) => void
```

#### action: setRefNameMap

```js
// type signature
setRefNameMap: (refNameMap: Record<string, string>) => void
```
