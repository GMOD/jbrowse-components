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
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-configurationformatdetailsfeature">**configuration.formatDetails.feature**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | adds extra fields to the feature details<br>_callback args:_ `feature` |
| <span id="slot-configurationformatdetailssubfeatures">**configuration.formatDetails.subfeatures**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | adds extra fields to the subfeatures of a feature<br>_callback args:_ `feature` |
| <span id="slot-configurationformatdetailsdepth">**configuration.formatDetails.depth**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>2</code> | depth to iterate the formatDetails->subfeatures callback on subfeatures (used for example to only apply the callback to the first layer of subfeatures) |
| <span id="slot-configurationformatdetailsmaxdepth">**configuration.formatDetails.maxDepth**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>10000</code> | hide subfeatures greater than a certain depth |
