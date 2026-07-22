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

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                     | Type      | Description                          |
| ---------------------------------------- | --------- | ------------------------------------ |
| [search](#slot-search)                   | `string`  | Search string or regex to search for |
| [sequenceAdapter](#slot-sequenceadapter) | `frozen`  | discouraged: leave unset.            |
| [searchForward](#slot-searchforward)     | `boolean` |                                      |
| [searchReverse](#slot-searchreverse)     | `boolean` |                                      |
| [caseInsensitive](#slot-caseinsensitive) | `boolean` |                                      |

<details>
<summary>SequenceSearchAdapter - Slots</summary>

#### slot: search

Search string or regex to search for

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: sequenceAdapter

discouraged: leave unset. JBrowse supplies the assembly's sequence adapter
automatically; this override exists only for the rare case of scanning a
sequence other than the one the track is displayed against.

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:**
`null`

#### slot: searchForward

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: searchReverse

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: caseInsensitive

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

</details>
