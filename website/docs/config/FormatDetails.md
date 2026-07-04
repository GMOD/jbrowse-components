---
id: formatdetails
title: FormatDetails
sidebar_label: Root -> FormatDetails
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Built into JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/FormatDetails.ts).

## Overview

generally exists on the tracks in the config.json or as a 'session' config as
configuration.formatDetails

<details open>
<summary>FormatDetails - Slots</summary>

#### slot: configuration.formatDetails.feature

adds extra fields to the feature details

**Type:** `frozen` · **Default:** `{}`

```js
{
  type: 'frozen',
  description: 'adds extra fields to the feature details',
  defaultValue: {},
  contextVariable: ['feature'],
}
```

#### slot: configuration.formatDetails.subfeatures

adds extra fields to the subfeatures of a feature

**Type:** `frozen` · **Default:** `{}`

```js
{
  type: 'frozen',
  description: 'adds extra fields to the subfeatures of a feature',
  defaultValue: {},
  contextVariable: ['feature'],
}
```

#### slot: configuration.formatDetails.depth

depth to iterate the formatDetails->subfeatures callback on subfeatures (used
for example to only apply the callback to the first layer of subfeatures)

**Type:** `number` · **Default:** `2`

#### slot: configuration.formatDetails.maxDepth

hide subfeatures greater than a certain depth

**Type:** `number` · **Default:** `10000`

</details>
