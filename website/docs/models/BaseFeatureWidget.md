---
id: basefeaturewidget
title: BaseFeatureWidget
sidebar_label: Widget -> BaseFeatureWidget
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/BaseFeatureWidget/stateModelFactory.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/BaseFeatureWidget.md)

## Overview

displays data about features, allowing configuration callbacks to modify the
contents of what is displayed

see: formatDetails-\>feature,formatDetails-\>subfeatures

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">BaseFeatureWidget - Properties</summary>

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
IOptionalIType<IType<MaybeSerializedFeat, MaybeSerializedFeat, MaybeSerializedFeat>, [undefined]>
// code
featureData: types.optional(
        types.frozen<MaybeSerializedFeat>(),
        undefined,
      )
```

#### property: formattedFields

```js
// type signature
IOptionalIType<IType<any, any, any>, [undefined]>
// code
formattedFields: types.optional(types.frozen(), undefined)
```

#### property: unformattedFeatureData

```js
// type signature
IOptionalIType<IType<MaybeSerializedFeat, MaybeSerializedFeat, MaybeSerializedFeat>, [undefined]>
// code
unformattedFeatureData: types.optional(
        types.frozen<MaybeSerializedFeat>(),
        undefined,
      )
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
IOptionalIType<IModelType<{}, { showCoordinatesSetting: ShowCoordinatesMode; intronBp: number; upDownBp: number; upperCaseCDS: boolean; charactersPerRow: number; } & { setUpDownBp(f: number): void; setIntronBp(f: number): void; setUpperCaseCDS(f: boolean): void; setShowCoordinates(f: ShowCoordinatesMode): void; } & ...
// code
sequenceFeatureDetails: types.optional(SequenceFeatureDetailsF(), {})
```

#### property: descriptions

```js
// type signature
IOptionalIType<IType<Record<string, unknown> | undefined, Record<string, unknown> | undefined, Record<string, unknown> | undefined>, [undefined]>
// code
descriptions: types.optional(
        types.frozen<Record<string, unknown> | undefined>(),
        undefined,
      )
```

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">BaseFeatureWidget - Volatiles</summary>

#### volatile: error

```js
// type signature
undefined
// code
error: undefined
```

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">BaseFeatureWidget - Actions</summary>

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
setExtra: (type?: string | undefined, trackId?: string | undefined, maxDepth?: number | undefined) => void
```

#### action: setError

```js
// type signature
setError: (e: unknown) => void
```

</details>
