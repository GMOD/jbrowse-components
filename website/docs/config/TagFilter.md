---
id: tagfilter
title: TagFilter
sidebar_label: Display -> TagFilter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/tagFilterConfigSchema.ts).

One tag a read has to carry to pass, with the value it has to hold where
one is named.

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-tag">**tag**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | the SAM tag, HP or RG |
| <span id="slot-value">**value**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | the value the tag has to hold; unset passes any read carrying the tag |
