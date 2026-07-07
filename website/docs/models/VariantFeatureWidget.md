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

| Member                                 | Kind       | Description |
| -------------------------------------- | ---------- | ----------- |
| [type](#property-type)                 | Properties |             |
| [descriptions](#property-descriptions) | Properties |             |

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseFeatureWidget](../basefeaturewidget)

**Properties:** [id](../basefeaturewidget#property-id),
[type](../basefeaturewidget#property-type),
[featureData](../basefeaturewidget#property-featuredata),
[unformattedFeatureData](../basefeaturewidget#property-unformattedfeaturedata),
[view](../basefeaturewidget#property-view),
[track](../basefeaturewidget#property-track),
[trackId](../basefeaturewidget#property-trackid),
[trackType](../basefeaturewidget#property-tracktype),
[maxDepth](../basefeaturewidget#property-maxdepth),
[sequenceFeatureDetails](../basefeaturewidget#property-sequencefeaturedetails),
[descriptions](../basefeaturewidget#property-descriptions)

**Volatiles:** [error](../basefeaturewidget#volatile-error)

**Actions:** [setFeatureData](../basefeaturewidget#action-setfeaturedata),
[clearFeatureData](../basefeaturewidget#action-clearfeaturedata),
[setFormattedData](../basefeaturewidget#action-setformatteddata),
[setExtra](../basefeaturewidget#action-setextra),
[setError](../basefeaturewidget#action-seterror)

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
