---
id: referencesequencetrack
title: ReferenceSequenceTrack
sidebar_label: Track -> ReferenceSequenceTrack
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `sequence`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/ReferenceSequenceTrack/configSchema.ts).

## Example usage

Usually authored as the `sequence` member of an assembly rather than a top-level
track:

```js
sequence: {
  type: 'ReferenceSequenceTrack',
  trackId: 'hg38-ref',
  adapter: {
    type: 'IndexedFastaAdapter',
    uri: 'https://example.com/hg38.fa',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

## Overview

used to display base level DNA sequence tracks

### ReferenceSequenceTrack - Identifier

Every ReferenceSequenceTrack has a unique `trackId`, a required top-level field
that identifies it (not one of the config slots below).

## Related links

- **Display:** [LinearGCContentDisplay](../lineargccontentdisplay)
  ([state model](../../models/lineargccontentdisplay))
- **Display:**
  [LinearReferenceSequenceDisplay](../linearreferencesequencedisplay)
  ([state model](../../models/linearreferencesequencedisplay))
- **Adapter:** [BgzipFastaAdapter](../bgzipfastaadapter)
- **Adapter:** [ChromSizesAdapter](../chromsizesadapter)
- **Adapter:** [IndexedFastaAdapter](../indexedfastaadapter)
- **Adapter:** [TwoBitAdapter](../twobitadapter)
- **Adapter:** [UnindexedFastaAdapter](../unindexedfastaadapter)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                              | Type      | Description                                                                 |
| ------------------------------------------------- | --------- | --------------------------------------------------------------------------- |
| [adapter](#slot-adapter)                          |           | configuration for track adapter                                             |
| [displays](#slot-displays)                        |           | configuration for the displays e.g. LinearReferenceSequenceDisplay          |
| [name](#slot-name)                                | `string`  | optional track name, otherwise uses the "Reference sequence (assemblyName)" |
| [sequenceType](#slot-sequencetype)                | `string`  | either dna or pep                                                           |
| [description](#slot-description)                  | `string`  | a description of the track                                                  |
| [metadata](#slot-metadata)                        | `frozen`  | anything to add about this track                                            |
| [formatAbout.config](#slot-formataboutconfig)     | `frozen`  | formats configuration in about dialog                                       |
| [formatAbout.hideUris](#slot-formatabouthideuris) | `boolean` |                                                                             |

<details>
<summary>ReferenceSequenceTrack - Slots</summary>

#### slot: adapter

configuration for track adapter

```js
pluginManager.pluggableConfigSchemaType('adapter')
```

#### slot: displays

configuration for the displays e.g. LinearReferenceSequenceDisplay

```js
types.array(pluginManager.pluggableConfigSchemaType('display'))
```

#### slot: name

optional track name, otherwise uses the "Reference sequence (assemblyName)"

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: sequenceType

either dna or pep

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'dna'`

#### slot: description

a description of the track

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: metadata

anything to add about this track

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:** `{}`

#### slot: formatAbout.config

formats configuration in about dialog

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:** `{}`

```js
{
  type: 'frozen',
  description: 'formats configuration in about dialog',
  defaultValue: {},
  contextVariable: ['config'],
}
```

#### slot: formatAbout.hideUris

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false`

</details>
