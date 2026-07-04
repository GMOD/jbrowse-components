---
id: baselineardisplay
title: BaseLinearDisplay
sidebar_label: Display -> BaseLinearDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`linear-genome-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/configSchema.ts).

## Overview

Shared base config for linear displays — its slots (`height`,
`maxFeatureScreenDensity`, `fetchSizeLimit`, `mouseover`, `jexlFilters`) are
common to all of them. The GPU stack's `LinearCanvasBaseDisplay` config extends
it, and third-party plugins extend it too.

### BaseLinearDisplay - Identifier

Every BaseLinearDisplay has a unique `displayId`, a required top-level field
that identifies it (not one of the config slots below).

<details open>
<summary>BaseLinearDisplay - Slots</summary>

#### slot: maxFeatureScreenDensity

maximum features per pixel before showing a "too many features" message, used if
byte size estimates are not available

**Type:** `number` · **Default:** `1` · _advanced_

#### slot: fetchSizeLimit

maximum data to attempt to download for a given track, used if adapter doesn't
specify one

**Type:** `number` · **Default:** `1_000_000` · _advanced_

#### slot: height

default height for the track

**Type:** `number` · **Default:** `100`

#### slot: mouseover

text to display when the cursor hovers over a feature

**Type:** `string` · **Default:**
`'jexl:mouseoverExtraInformation||get(feature,'_mouseOver')||get(feature,'name')||get(feature,'id')'`

```js
{
  type: 'string',
  description: 'text to display when the cursor hovers over a feature',
  defaultValue: `jexl:mouseoverExtraInformation||get(feature,'_mouseOver')||get(feature,'name')||get(feature,'id')`,
  contextVariable: ['feature', 'mouseoverExtraInformation'],
}
```

#### slot: jexlFilters

config jexlFilters are deferred evaluated so they are prepended with jexl at
runtime rather than being stored with jexl in the config

**Type:** `stringArray` · **Default:** `[]`

</details>
