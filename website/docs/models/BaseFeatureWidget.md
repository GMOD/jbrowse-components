---
id: basefeaturewidget
title: BaseFeatureWidget
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[packages/core/BaseFeatureWidget/stateModelFactory.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/BaseFeatureWidget/stateModelFactory.ts)

displays data about features, allowing configuration callbacks to modify the
contents of what is displayed

see: formatDetails-\>feature,formatDetails-\>subfeatures

### BaseFeatureWidget - Properties

#### property: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: type

```js
// type signature
ISimpleType<"BaseFeatureWidget">
// code
type: types.literal('BaseFeatureWidget')
```

#### property: featureData

```js
// type signature
IType<any, any, any>
// code
featureData: types.frozen()
```

#### property: formattedFields

```js
// type signature
IType<any, any, any>
// code
formattedFields: types.frozen()
```

#### property: unformattedFeatureData

```js
// type signature
IType<any, any, any>
// code
unformattedFeatureData: types.frozen()
```

#### property: view

```js
// type signature
IMaybe<IReferenceType<IAnyType>>
// code
view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      )
```

#### property: track

```js
// type signature
IMaybe<IReferenceType<IAnyType>>
// code
track: types.safeReference(
        pluginManager.pluggableMstType('track', 'stateModel'),
      )
```

#### property: trackId

```js
// type signature
IMaybe<ISimpleType<string>>
// code
trackId: types.maybe(types.string)
```

#### property: trackType

```js
// type signature
IMaybe<ISimpleType<string>>
// code
trackType: types.maybe(types.string)
```

#### property: maxDepth

```js
// type signature
IMaybe<ISimpleType<number>>
// code
maxDepth: types.maybe(types.number)
```

#### property: sequenceFeatureDetails

```js
// type signature
IOptionalIType<IModelType<{}, { showCoordinatesSetting: string; intronBp: number; upDownBp: number; upperCaseCDS: boolean; charactersPerRow: number; feature: SimpleFeatureSerialized | undefined; mode: string; } & { ...; } & { ...; } & { ...; }, _NotCustomized, _NotCustomized>, [...]>
// code
sequenceFeatureDetails: types.optional(SequenceFeatureDetailsF(), {})
```

### BaseFeatureWidget - Actions

#### action: setFeatureData

```js
// type signature
setFeatureData: (featureData: Record<string, unknown>) => void
```

#### action: clearFeatureData

```js
// type signature
clearFeatureData: () => void
```

#### action: setFormattedData

```js
// type signature
setFormattedData: (feat: Record<string, unknown>) => void
```

#### action: setExtra

```js
// type signature
setExtra: (type?: string, trackId?: string, maxDepth?: number) => void
```

#### action: setError

```js
// type signature
setError: (e: unknown) => void
```
