---
id: variantfeaturewidget
title: VariantFeatureWidget
sidebar_label: Widget -> VariantFeatureWidget
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/VariantFeatureWidget/stateModelFactory.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/VariantFeatureWidget.md)

## Overview

Feature-details widget for a VCF variant, extending the base feature widget with
variant-specific fields such as genotypes and INFO.

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

<details open>
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
