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

| Member                                                       | Kind       | Defined by        | Description                                                                                       |
| ------------------------------------------------------------ | ---------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| [id](#property-id)                                           | Properties | BaseFeatureWidget |                                                                                                   |
| [type](#property-type)                                       | Properties | BaseFeatureWidget |                                                                                                   |
| [featureData](#property-featuredata)                         | Properties | BaseFeatureWidget |                                                                                                   |
| [unformattedFeatureData](#property-unformattedfeaturedata)   | Properties | BaseFeatureWidget |                                                                                                   |
| [view](#property-view)                                       | Properties | BaseFeatureWidget |                                                                                                   |
| [track](#property-track)                                     | Properties | BaseFeatureWidget |                                                                                                   |
| [trackId](#property-trackid)                                 | Properties | BaseFeatureWidget |                                                                                                   |
| [trackType](#property-tracktype)                             | Properties | BaseFeatureWidget |                                                                                                   |
| [maxDepth](#property-maxdepth)                               | Properties | BaseFeatureWidget |                                                                                                   |
| [sequenceFeatureDetails](#property-sequencefeaturedetails)   | Properties | BaseFeatureWidget |                                                                                                   |
| [descriptions](#property-descriptions)                       | Properties | BaseFeatureWidget |                                                                                                   |
| [error](#volatile-error)                                     | Volatiles  | BaseFeatureWidget |                                                                                                   |
| [sequenceHoverPosition](#volatile-sequencehoverposition)     | Volatiles  | BaseFeatureWidget | genomic base currently hovered in this widget's sequence panel, read by the LGV crosshair overlay |
| [setSequenceHoverPosition](#action-setsequencehoverposition) | Actions    | BaseFeatureWidget |                                                                                                   |
| [setFeatureData](#action-setfeaturedata)                     | Actions    | BaseFeatureWidget |                                                                                                   |
| [clearFeatureData](#action-clearfeaturedata)                 | Actions    | BaseFeatureWidget |                                                                                                   |
| [setFormattedData](#action-setformatteddata)                 | Actions    | BaseFeatureWidget |                                                                                                   |
| [setExtra](#action-setextra)                                 | Actions    | BaseFeatureWidget |                                                                                                   |
| [setError](#action-seterror)                                 | Actions    | BaseFeatureWidget |                                                                                                   |

<details>
<summary>BaseFeatureWidget - Properties</summary>

| Member                                                                   | Type                                                                                                                                                   |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| <span id="property-id">id</span>                                         | `IOptionalIType<ISimpleType<string>, [undefined]>`                                                                                                     |
| <span id="property-type">type</span>                                     | `ISimpleType<"BaseFeatureWidget">`                                                                                                                     |
| <span id="property-featuredata">featureData</span>                       | `IOptionalIType<IType<MaybeSerializedFeat, MaybeSerializedFeat, MaybeSerializedFeat>, [undefined]>`                                                    |
| <span id="property-unformattedfeaturedata">unformattedFeatureData</span> | `IOptionalIType<IType<MaybeSerializedFeat, MaybeSerializedFeat, MaybeSerializedFeat>, [undefined]>`                                                    |
| <span id="property-view">view</span>                                     | `IMaybe<IReferenceType<IAnyType>>`                                                                                                                     |
| <span id="property-track">track</span>                                   | `IMaybe<IReferenceType<IAnyType>>`                                                                                                                     |
| <span id="property-trackid">trackId</span>                               | `IMaybe<ISimpleType<string>>`                                                                                                                          |
| <span id="property-tracktype">trackType</span>                           | `IMaybe<ISimpleType<string>>`                                                                                                                          |
| <span id="property-maxdepth">maxDepth</span>                             | `IMaybe<ISimpleType<number>>`                                                                                                                          |
| <span id="property-sequencefeaturedetails">sequenceFeatureDetails</span> | `IOptionalIType<IModelType<…>, [undefined]>`                                                                                                           |
| <span id="property-descriptions">descriptions</span>                     | `IOptionalIType<IType<Record<string, unknown> \| undefined, Record<string, unknown> \| undefined, Record<string, unknown> \| undefined>, [undefined]>` |

</details>

<details>
<summary>BaseFeatureWidget - Volatiles</summary>

#### volatile: sequenceHoverPosition

genomic base currently hovered in this widget's sequence panel, read by the LGV
crosshair overlay

```ts
// type signature
type sequenceHoverPosition = undefined
// code
sequenceHoverPosition: undefined
```

</details>

<details>
<summary>BaseFeatureWidget - Volatiles (other undocumented members)</summary>

| Member                                 | Type        |
| -------------------------------------- | ----------- |
| <span id="volatile-error">error</span> | `undefined` |

</details>

<details>
<summary>BaseFeatureWidget - Actions</summary>

| Member                                                                     | Type                                                                                                  |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| <span id="action-setsequencehoverposition">setSequenceHoverPosition</span> | `(pos: SequenceHoverPosition \| undefined) => void`                                                   |
| <span id="action-setfeaturedata">setFeatureData</span>                     | `(featureData: SimpleFeatureSerialized) => void`                                                      |
| <span id="action-clearfeaturedata">clearFeatureData</span>                 | `() => void`                                                                                          |
| <span id="action-setformatteddata">setFormattedData</span>                 | `(feat: SimpleFeatureSerialized) => void`                                                             |
| <span id="action-setextra">setExtra</span>                                 | `(type?: string \| undefined, trackId?: string \| undefined, maxDepth?: number \| undefined) => void` |
| <span id="action-seterror">setError</span>                                 | `(e: unknown) => void`                                                                                |

</details>
