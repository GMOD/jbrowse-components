---
id: basefeaturewidget
title: BaseFeatureWidget
sidebar_label: Widget -> BaseFeatureWidget
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/BaseFeatureWidget/stateModelFactory.ts).

## Overview

displays data about features, allowing configuration callbacks to modify the
contents of what is displayed

see: formatDetails-\>feature,formatDetails-\>subfeatures

## Members

| Member                                                     | Kind       | Description |
| ---------------------------------------------------------- | ---------- | ----------- |
| [id](#property-id)                                         | Properties |             |
| [type](#property-type)                                     | Properties |             |
| [featureData](#property-featuredata)                       | Properties |             |
| [unformattedFeatureData](#property-unformattedfeaturedata) | Properties |             |
| [view](#property-view)                                     | Properties |             |
| [track](#property-track)                                   | Properties |             |
| [trackId](#property-trackid)                               | Properties |             |
| [trackType](#property-tracktype)                           | Properties |             |
| [maxDepth](#property-maxdepth)                             | Properties |             |
| [sequenceFeatureDetails](#property-sequencefeaturedetails) | Properties |             |
| [descriptions](#property-descriptions)                     | Properties |             |
| [error](#volatile-error)                                   | Volatiles  |             |
| [setFeatureData](#action-setfeaturedata)                   | Actions    |             |
| [clearFeatureData](#action-clearfeaturedata)               | Actions    |             |
| [setFormattedData](#action-setformatteddata)               | Actions    |             |
| [setExtra](#action-setextra)                               | Actions    |             |
| [setError](#action-seterror)                               | Actions    |             |

<details>
<summary>BaseFeatureWidget - Properties</summary>

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

<details>
<summary>BaseFeatureWidget - Volatiles</summary>

#### volatile: error

```ts
// type signature
type error = undefined
// code
error: undefined
```

</details>

<details>
<summary>BaseFeatureWidget - Actions</summary>

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
