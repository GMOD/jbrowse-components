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

_See the **Slots** section below for all available configuration fields._

## Overview

used to display base level DNA sequence tracks

### ReferenceSequenceTrack - Display types

A track is just a container; the actual rendering behavior and config slots live
on its display type(s):

- [LinearGCContentDisplay](../lineargccontentdisplay)
  ([state model](../../models/lineargccontentdisplay))
- [LinearReferenceSequenceDisplay](../linearreferencesequencedisplay)
  ([state model](../../models/linearreferencesequencedisplay))

### ReferenceSequenceTrack - Compatible adapters

Data adapters that can supply this track:

- [BgzipFastaAdapter](../bgzipfastaadapter)
- [ChromSizesAdapter](../chromsizesadapter)
- [IndexedFastaAdapter](../indexedfastaadapter)
- [TwoBitAdapter](../twobitadapter)
- [UnindexedFastaAdapter](../unindexedfastaadapter)

### ReferenceSequenceTrack - Identifier

Every ReferenceSequenceTrack has a unique `trackId`, a required top-level field
that identifies it (not one of the config slots below).

<details open>
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

**Type:** `string` · **Default:** `''`

#### slot: sequenceType

either dna or pep

**Type:** `string` · **Default:** `'dna'`

#### slot: description

a description of the track

**Type:** `string` · **Default:** `''`

#### slot: metadata

anything to add about this track

**Type:** `frozen` · **Default:** `{}`

#### slot: formatAbout.config

formats configuration in about dialog

**Type:** `frozen` · **Default:** `{}`

```js
{
  type: 'frozen',
  description: 'formats configuration in about dialog',
  defaultValue: {},
  contextVariable: ['config'],
}
```

#### slot: formatAbout.hideUris

**Type:** `boolean` · **Default:** `false`

</details>
