---
id: formatdetails
title: FormatDetails
sidebar_label: Root -> FormatDetails
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Built into JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/FormatDetails.ts).

generally exists on the tracks in the config.json or as a 'session' config as
configuration.formatDetails

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                                                                   | Type     | Description                                                                                                                                             |
| -------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [configuration.formatDetails.feature](#slot-configurationformatdetailsfeature)         | `frozen` | adds extra fields to the feature details                                                                                                                |
| [configuration.formatDetails.subfeatures](#slot-configurationformatdetailssubfeatures) | `frozen` | adds extra fields to the subfeatures of a feature                                                                                                       |
| [configuration.formatDetails.depth](#slot-configurationformatdetailsdepth)             | `number` | depth to iterate the formatDetails->subfeatures callback on subfeatures (used for example to only apply the callback to the first layer of subfeatures) |
| [configuration.formatDetails.maxDepth](#slot-configurationformatdetailsmaxdepth)       | `number` | hide subfeatures greater than a certain depth                                                                                                           |

<details>
<summary>FormatDetails - Slots</summary>

#### slot: configuration.formatDetails.feature

adds extra fields to the feature details

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:** `{}`
· **Callback args:** `feature`

#### slot: configuration.formatDetails.subfeatures

adds extra fields to the subfeatures of a feature

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:** `{}`
· **Callback args:** `feature`

#### slot: configuration.formatDetails.depth

depth to iterate the formatDetails->subfeatures callback on subfeatures (used
for example to only apply the callback to the first layer of subfeatures)

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `2`

#### slot: configuration.formatDetails.maxDepth

hide subfeatures greater than a certain depth

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`10000`

</details>
