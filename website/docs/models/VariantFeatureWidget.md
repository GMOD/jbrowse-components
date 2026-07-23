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

| Member                                               | Type                                  |
| ---------------------------------------------------- | ------------------------------------- |
| <span id="property-type">type</span>                 | `ISimpleType<"VariantFeatureWidget">` |
| <span id="property-descriptions">descriptions</span> | `IType<any, any, any>`                |

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from BaseFeatureWidget</summary>

[BaseFeatureWidget →](../basefeaturewidget)

**Properties**

| Member                                                                   | Type                                                                                                |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| <span id="property-id">id</span>                                         | `IOptionalIType<ISimpleType<string>, [undefined]>`                                                  |
| <span id="property-featuredata">featureData</span>                       | `IOptionalIType<IType<MaybeSerializedFeat, MaybeSerializedFeat, MaybeSerializedFeat>, [undefined]>` |
| <span id="property-unformattedfeaturedata">unformattedFeatureData</span> | `IOptionalIType<IType<MaybeSerializedFeat, MaybeSerializedFeat, MaybeSerializedFeat>, [undefined]>` |
| <span id="property-view">view</span>                                     | `IMaybe<IReferenceType<IAnyType>>`                                                                  |
| <span id="property-track">track</span>                                   | `IMaybe<IReferenceType<IAnyType>>`                                                                  |
| <span id="property-trackid">trackId</span>                               | `IMaybe<ISimpleType<string>>`                                                                       |
| <span id="property-tracktype">trackType</span>                           | `IMaybe<ISimpleType<string>>`                                                                       |
| <span id="property-maxdepth">maxDepth</span>                             | `IMaybe<ISimpleType<number>>`                                                                       |
| <span id="property-sequencefeaturedetails">sequenceFeatureDetails</span> | `IOptionalIType<IModelType<…>, [undefined]>`                                                        |

**Volatiles**

#### volatile: sequenceHoverPosition

genomic base currently hovered in this widget's sequence panel, read by the LGV
crosshair overlay

```ts
// type signature
type sequenceHoverPosition = undefined
// code
sequenceHoverPosition: undefined
```

| Member                                 | Type        |
| -------------------------------------- | ----------- |
| <span id="volatile-error">error</span> | `undefined` |

**Actions**

| Member                                                                     | Type                                                                                                  |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| <span id="action-setsequencehoverposition">setSequenceHoverPosition</span> | `(pos: SequenceHoverPosition \| undefined) => void`                                                   |
| <span id="action-setfeaturedata">setFeatureData</span>                     | `(featureData: SimpleFeatureSerialized) => void`                                                      |
| <span id="action-clearfeaturedata">clearFeatureData</span>                 | `() => void`                                                                                          |
| <span id="action-setformatteddata">setFormattedData</span>                 | `(feat: SimpleFeatureSerialized) => void`                                                             |
| <span id="action-setextra">setExtra</span>                                 | `(type?: string \| undefined, trackId?: string \| undefined, maxDepth?: number \| undefined) => void` |
| <span id="action-seterror">setError</span>                                 | `(e: unknown) => void`                                                                                |

</details>
