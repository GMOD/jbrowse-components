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

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                             | Type          | Description                                                                                                                           |
| -------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| [height](#slot-height)           | `number`      | default height for the track                                                                                                          |
| [mouseover](#slot-mouseover)     | `string`      | text to display when the cursor hovers over a feature                                                                                 |
| [jexlFilters](#slot-jexlfilters) | `stringArray` | config jexlFilters are deferred evaluated so they are prepended with jexl at runtime rather than being stored with jexl in the config |

<details>
<summary>Advanced slots (3)</summary>

| Slot                                                     | Type      | Description                                                                                                                                                            |
| -------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [maxFeatureScreenDensity](#slot-maxfeaturescreendensity) | `number`  | maximum features per pixel before showing a "too many features" message, used if byte size estimates are not available                                                 |
| [fetchSizeLimit](#slot-fetchsizelimit)                   | `number`  | maximum data to attempt to download for a given track, used if adapter doesn't specify one                                                                             |
| [forceLoad](#slot-forceload)                             | `boolean` | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. |

</details>

<details>
<summary>BaseLinearDisplay - Slots</summary>

#### slot: maxFeatureScreenDensity

maximum features per pixel before showing a "too many features" message, used if
byte size estimates are not available

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `1` ·
_advanced_

#### slot: fetchSizeLimit

maximum data to attempt to download for a given track, used if adapter doesn't
specify one

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`1_000_000` · _advanced_

#### slot: forceLoad

Declarative equivalent of the "Force load" button on the "too much data" banner:
when true the display always renders, however large the region or dense the
features. Off by default (the gate guards against huge downloads). Set it on a
view no one can interact with — an embedded / notebook view, or a screenshot —
where the region is known and you want it drawn without a click.

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false` · _advanced_

#### slot: height

default height for the track

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `100`

#### slot: mouseover

text to display when the cursor hovers over a feature

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'jexl:get(feature,'_mouseOver')||get(feature,'name')||get(feature,'function')||get(feature,'id')'`

```js
{
  type: 'string',
  description: 'text to display when the cursor hovers over a feature',



  defaultValue: `jexl:get(feature,'_mouseOver')||get(feature,'name')||get(feature,'function')||get(feature,'id')`,
  contextVariable: ['feature'],
}
```

#### slot: jexlFilters

config jexlFilters are deferred evaluated so they are prepended with jexl at
runtime rather than being stored with jexl in the config

**Type:** `stringArray` · **Default:** `[`get(feature,'gbkey')!='Src'`]`

</details>
