---
id: sequencesearchadapter
title: SequenceSearchAdapter
sidebar_label: Adapter -> SequenceSearchAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `sequence`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/SequenceSearchAdapter/configSchema.ts).

Note: don't set `sequenceAdapter` — JBrowse supplies it from the assembly the
track is displayed against. Setting it by hand pins the scan to one sequence
source and silently desyncs the track if the assembly's sequence changes.

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "SequenceSearchAdapter", ... }`. Slot types
(`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-search">**search**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Search string or regex to search for |
| <span id="slot-sequenceadapter">**sequenceAdapter**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>null</code> | discouraged: leave unset. JBrowse supplies the assembly's sequence adapter automatically; this override exists only for the rare case of scanning a sequence other than the one the track is displayed against. |
| <span id="slot-searchforward">**searchForward**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> |  |
| <span id="slot-searchreverse">**searchReverse**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> |  |
| <span id="slot-caseinsensitive">**caseInsensitive**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> |  |
