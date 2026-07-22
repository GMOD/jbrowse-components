---
id: variantfeaturewidget
title: VariantFeatureWidget
sidebar_label: Widget -> VariantFeatureWidget
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`variants` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/VariantFeatureWidget/stateModelFactory.ts).

## Overview

Feature-details widget for a VCF variant, extending the base feature widget with
variant-specific fields such as genotypes and INFO.

## Members

| Member                                                       | Kind       | Defined by                                | Description                                                                                       |
| ------------------------------------------------------------ | ---------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                       | Properties | VariantFeatureWidget                      |                                                                                                   |
| [descriptions](#property-descriptions)                       | Properties | VariantFeatureWidget                      |                                                                                                   |
| [id](#property-id)                                           | Properties | [BaseFeatureWidget](../basefeaturewidget) |                                                                                                   |
| [featureData](#property-featuredata)                         | Properties | [BaseFeatureWidget](../basefeaturewidget) |                                                                                                   |
| [unformattedFeatureData](#property-unformattedfeaturedata)   | Properties | [BaseFeatureWidget](../basefeaturewidget) |                                                                                                   |
| [view](#property-view)                                       | Properties | [BaseFeatureWidget](../basefeaturewidget) |                                                                                                   |
| [track](#property-track)                                     | Properties | [BaseFeatureWidget](../basefeaturewidget) |                                                                                                   |
| [trackId](#property-trackid)                                 | Properties | [BaseFeatureWidget](../basefeaturewidget) |                                                                                                   |
| [trackType](#property-tracktype)                             | Properties | [BaseFeatureWidget](../basefeaturewidget) |                                                                                                   |
| [maxDepth](#property-maxdepth)                               | Properties | [BaseFeatureWidget](../basefeaturewidget) |                                                                                                   |
| [sequenceFeatureDetails](#property-sequencefeaturedetails)   | Properties | [BaseFeatureWidget](../basefeaturewidget) |                                                                                                   |
| [error](#volatile-error)                                     | Volatiles  | [BaseFeatureWidget](../basefeaturewidget) |                                                                                                   |
| [sequenceHoverPosition](#volatile-sequencehoverposition)     | Volatiles  | [BaseFeatureWidget](../basefeaturewidget) | genomic base currently hovered in this widget's sequence panel, read by the LGV crosshair overlay |
| [setSequenceHoverPosition](#action-setsequencehoverposition) | Actions    | [BaseFeatureWidget](../basefeaturewidget) |                                                                                                   |
| [setFeatureData](#action-setfeaturedata)                     | Actions    | [BaseFeatureWidget](../basefeaturewidget) |                                                                                                   |
| [clearFeatureData](#action-clearfeaturedata)                 | Actions    | [BaseFeatureWidget](../basefeaturewidget) |                                                                                                   |
| [setFormattedData](#action-setformatteddata)                 | Actions    | [BaseFeatureWidget](../basefeaturewidget) |                                                                                                   |
| [setExtra](#action-setextra)                                 | Actions    | [BaseFeatureWidget](../basefeaturewidget) |                                                                                                   |
| [setError](#action-seterror)                                 | Actions    | [BaseFeatureWidget](../basefeaturewidget) |                                                                                                   |

<details>
<summary>VariantFeatureWidget - Properties</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'VariantFeatureWidget'>
// code
type: types.literal('VariantFeatureWidget')
```

#### property: descriptions

```ts
// type signature
type descriptions = IType<any, any, any>
// code
descriptions: types.frozen()
```

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from BaseFeatureWidget</summary>

[BaseFeatureWidget →](../basefeaturewidget)

**Properties**

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
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

**Volatiles**

#### volatile: error

```ts
// type signature
type error = undefined
// code
error: undefined
```

#### volatile: sequenceHoverPosition

genomic base currently hovered in this widget's sequence panel, read by the LGV
crosshair overlay

```ts
// type signature
type sequenceHoverPosition = undefined
// code
sequenceHoverPosition: undefined
```

**Actions**

#### action: setSequenceHoverPosition

```ts
type setSequenceHoverPosition = (pos: SequenceHoverPosition | undefined) => void
```

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
