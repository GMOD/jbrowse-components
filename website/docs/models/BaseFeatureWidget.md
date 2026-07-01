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
<summary>BaseFeatureWidget - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                       | Signature                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`id`](#property-id)                                         | `IOptionalIType<ISimpleType<string>, [undefined]>`                                                                                                                                                                                                                                                                                 |
| [`type`](#property-type)                                     | `ISimpleType<"BaseFeatureWidget">`                                                                                                                                                                                                                                                                                                 |
| [`featureData`](#property-featuredata)                       | `IOptionalIType<IType<MaybeSerializedFeat, MaybeSerializedFeat, MaybeSerializedFeat>, [undefined]>`                                                                                                                                                                                                                                |
| [`unformattedFeatureData`](#property-unformattedfeaturedata) | `IOptionalIType<IType<MaybeSerializedFeat, MaybeSerializedFeat, MaybeSerializedFeat>, [undefined]>`                                                                                                                                                                                                                                |
| [`view`](#property-view)                                     | `IMaybe<IReferenceType<IAnyType>>`                                                                                                                                                                                                                                                                                                 |
| [`track`](#property-track)                                   | `IMaybe<IReferenceType<IAnyType>>`                                                                                                                                                                                                                                                                                                 |
| [`trackId`](#property-trackid)                               | `IMaybe<ISimpleType<string>>`                                                                                                                                                                                                                                                                                                      |
| [`trackType`](#property-tracktype)                           | `IMaybe<ISimpleType<string>>`                                                                                                                                                                                                                                                                                                      |
| [`maxDepth`](#property-maxdepth)                             | `IMaybe<ISimpleType<number>>`                                                                                                                                                                                                                                                                                                      |
| [`sequenceFeatureDetails`](#property-sequencefeaturedetails) | `IOptionalIType<IModelType<{}, { showCoordinatesSetting: ShowCoordinatesMode; intronBp: number; upDownBp: number; upperCaseCDS: boolean; charactersPerRow: number; } & { setUpDownBp(f: number): void; setIntronBp(f: number): void; setUpperCaseCDS(f: boolean): void; setShowCoordinates(f: ShowCoordinatesMode): void; } & ...` |
| [`descriptions`](#property-descriptions)                     | `IOptionalIType<IType<Record<string, unknown> \| undefined, Record<string, unknown> \| undefined, Record<string, unknown> \| undefined>, [undefined]>`                                                                                                                                                                             |

</details>

<details>
<summary>BaseFeatureWidget - Properties (all signatures)</summary>

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: type

```ts
// type signature
type type = ISimpleType<'BaseFeatureWidget'>
// code
type: types.literal('BaseFeatureWidget')
```

#### property: featureData

```ts
// type signature
type featureData = IOptionalIType<
  IType<MaybeSerializedFeat, MaybeSerializedFeat, MaybeSerializedFeat>,
  [undefined]
>
// code
featureData: types.optional(types.frozen<MaybeSerializedFeat>(), undefined)
```

#### property: unformattedFeatureData

```ts
// type signature
type unformattedFeatureData = IOptionalIType<
  IType<MaybeSerializedFeat, MaybeSerializedFeat, MaybeSerializedFeat>,
  [undefined]
>
// code
unformattedFeatureData: types.optional(
  types.frozen<MaybeSerializedFeat>(),
  undefined,
)
```

#### property: view

```ts
// type signature
type view = IMaybe<IReferenceType<IAnyType>>
// code
view: types.safeReference(pluginManager.pluggableMstType('view', 'stateModel'))
```

#### property: track

```ts
// type signature
type track = IMaybe<IReferenceType<IAnyType>>
// code
track: types.safeReference(
  pluginManager.pluggableMstType('track', 'stateModel'),
)
```

#### property: trackId

```ts
// type signature
type trackId = IMaybe<ISimpleType<string>>
// code
trackId: types.maybe(types.string)
```

#### property: trackType

```ts
// type signature
type trackType = IMaybe<ISimpleType<string>>
// code
trackType: types.maybe(types.string)
```

#### property: maxDepth

```ts
// type signature
type maxDepth = IMaybe<ISimpleType<number>>
// code
maxDepth: types.maybe(types.number)
```

#### property: sequenceFeatureDetails

```ts
// type signature
type sequenceFeatureDetails = IOptionalIType<IModelType<{}, { showCoordinatesSetting: ShowCoordinatesMode; intronBp: number; upDownBp: number; upperCaseCDS: boolean; charactersPerRow: number; } & { setUpDownBp(f: number): void; setIntronBp(f: number): void; setUpperCaseCDS(f: boolean): void; setShowCoordinates(f: ShowCoordinatesMode): void; } & ...
// code
sequenceFeatureDetails: types.optional(SequenceFeatureDetailsF(), {})
```

#### property: descriptions

```ts
// type signature
type descriptions = IOptionalIType<
  IType<
    Record<string, unknown> | undefined,
    Record<string, unknown> | undefined,
    Record<string, unknown> | undefined
  >,
  [undefined]
>
// code
descriptions: types.optional(
  types.frozen<Record<string, unknown> | undefined>(),
  undefined,
)
```

</details>

<details open>
<summary>BaseFeatureWidget - Volatiles</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                     | Signature   |
| -------------------------- | ----------- |
| [`error`](#volatile-error) | `undefined` |

</details>

<details>
<summary>BaseFeatureWidget - Volatiles (all signatures)</summary>

#### volatile: error

```ts
// type signature
type error = undefined
// code
error: undefined
```

</details>

<details open>
<summary>BaseFeatureWidget - Actions</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                         | Signature                                                                                             |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [`setFeatureData`](#action-setfeaturedata)     | `(featureData: SimpleFeatureSerialized) => void`                                                      |
| [`clearFeatureData`](#action-clearfeaturedata) | `() => void`                                                                                          |
| [`setFormattedData`](#action-setformatteddata) | `(feat: SimpleFeatureSerialized) => void`                                                             |
| [`setExtra`](#action-setextra)                 | `(type?: string \| undefined, trackId?: string \| undefined, maxDepth?: number \| undefined) => void` |
| [`setError`](#action-seterror)                 | `(e: unknown) => void`                                                                                |

</details>

<details>
<summary>BaseFeatureWidget - Actions (all signatures)</summary>

#### action: setFeatureData

```ts
type setFeatureData = (featureData: SimpleFeatureSerialized) => void
```

#### action: clearFeatureData

```ts
type clearFeatureData = () => void
```

#### action: setFormattedData

```ts
type setFormattedData = (feat: SimpleFeatureSerialized) => void
```

#### action: setExtra

```ts
type setExtra = (
  type?: string | undefined,
  trackId?: string | undefined,
  maxDepth?: number | undefined,
) => void
```

#### action: setError

```ts
type setError = (e: unknown) => void
```

</details>
