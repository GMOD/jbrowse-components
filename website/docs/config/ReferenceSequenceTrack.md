---
id: referencesequencetrack
title: ReferenceSequenceTrack
sidebar_label: Track -> ReferenceSequenceTrack
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `sequence` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/ReferenceSequenceTrack/configSchema.ts).

## Example usage

Usually authored as the `sequence` member of an assembly rather than a
top-level track:
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

Every ReferenceSequenceTrack has a unique `trackId`, a required top-level field that identifies it (not one of the config slots below).

## Related links

- **Display:** [LinearGCContentDisplay](../lineargccontentdisplay) ([state model](../../models/lineargccontentdisplay))
- **Display:** [LinearReferenceSequenceDisplay](../linearreferencesequencedisplay) ([state model](../../models/linearreferencesequencedisplay))
- **Adapter:** [BgzipFastaAdapter](../bgzipfastaadapter)
- **Adapter:** [ChromSizesAdapter](../chromsizesadapter)
- **Adapter:** [FromConfigRegionsAdapter](../fromconfigregionsadapter)
- **Adapter:** [FromConfigSequenceAdapter](../fromconfigsequenceadapter)
- **Adapter:** [IndexedFastaAdapter](../indexedfastaadapter)
- **Adapter:** [TwoBitAdapter](../twobitadapter)
- **Adapter:** [UnindexedFastaAdapter](../unindexedfastaadapter)

## Config slots

These slots are top-level fields of the track config, alongside `trackId` and `name`. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-adapter">**adapter**</span><br><code>pluginManager.pluggableConfigSchemaType('adapter')</code> | configuration for track adapter |
| <span id="slot-displays">**displays**</span><br><code>types.array(pluginManager.pluggableConfigSchemaType('display'))</code> | configuration for the displays e.g. LinearReferenceSequenceDisplay |
| <span id="slot-name">**name**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | optional track name, otherwise uses the "Reference sequence (assemblyName)" |
| <span id="slot-sequencetype">**sequenceType**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'dna'</code> | either dna or pep |
| <span id="slot-description">**description**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | a description of the track |
| <span id="slot-metadata">**metadata**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | anything to add about this track |
| <span id="slot-formatabout">**formatAbout**</span><br><code>FormatAboutConfigSchemaFactory()</code> | jexl callbacks that add, rewrite or hide fields in this track's About dialog. Two slots, listed at [FormatAbout](/docs/config/formatabout). |
