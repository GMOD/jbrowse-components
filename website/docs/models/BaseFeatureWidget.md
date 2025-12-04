---
id: basefeaturewidget
title: BaseFeatureWidget
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/BaseFeatureWidget/stateModelFactory.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/BaseFeatureWidget.md)

## Docs

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
IType<SimpleFeatureSerialized, SimpleFeatureSerialized, SimpleFeatureSerialized>
// code
featureData: types.frozen<MaybeSerializedFeat>()
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
IType<SimpleFeatureSerialized, SimpleFeatureSerialized, SimpleFeatureSerialized>
// code
unformattedFeatureData: types.frozen<MaybeSerializedFeat>()
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
IOptionalIType<IModelType<{}, { showCoordinatesSetting: string; intronBp: number; upDownBp: number; upperCaseCDS: boolean; charactersPerRow: number; feature: SimpleFeatureSerialized; mode: SequenceDisplayMode; } & { ...; } & { ...; } & { ...; }, _NotCustomized, _NotCustomized>, [...]>
// code
sequenceFeatureDetails: types.optional(SequenceFeatureDetailsF(), {})
```

#### property: descriptions

```js
// type signature
IType<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>
// code
descriptions: types.frozen<Record<string, unknown> | undefined>()
```

### BaseFeatureWidget - Actions

#### action: setFeatureData

```js
// type signature
setFeatureData: (featureData: SimpleFeatureSerialized) => void
```

#### action: clearFeatureData

```js
// type signature
clearFeatureData: () => void
```

#### action: setFormattedData

```js
// type signature
setFormattedData: (feat: SimpleFeatureSerialized) => void
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
