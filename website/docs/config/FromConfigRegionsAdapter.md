---
id: fromconfigregionsadapter
title: FromConfigRegionsAdapter
sidebar_label: Adapter -> FromConfigRegionsAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `config` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/config/src/FromConfigRegionsAdapter/configSchema.ts).

## Example usage

Supplies refNames+sizes with no sequence, as the adapter of an assembly's
`sequence` (a `ReferenceSequenceTrack`):

```js
{
  type: 'ReferenceSequenceTrack',
  trackId: 'my_refseq',
  adapter: {
    type: 'FromConfigRegionsAdapter',
    features: [
      { uniqueId: 'ctgA', refName: 'ctgA', start: 0, end: 50000 },
      { uniqueId: 'ctgB', refName: 'ctgB', start: 0, end: 6079 },
    ],
  },
}
```

_See the **Config slots** section below for all available configuration fields._

used for specifying refNames+sizes of an assembly

## Related links

- **Track:** [ReferenceSequenceTrack](../referencesequencetrack)
- **Display:** [LinearGCContentDisplay](../lineargccontentdisplay)
- **Display:** [LinearReferenceSequenceDisplay](../linearreferencesequencedisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "FromConfigRegionsAdapter", ... }`. This adapter has no `uri` [shorthand](/docs/config_guides/file_types#the-uri-shorthand) — give it the location slots below. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-adapterid">**adapterId**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | stable identifier used as the adapter cache key; avoids hashing the (potentially large) features array. optional — falls back to hash. |
| <span id="slot-features">**features**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>[]</code> | one entry per reference sequence, each with a `uniqueId`, `refName`, `start: 0` and `end` set to that sequence's length. This is what defines the assembly's reference names and sizes; no bases are supplied, so base-level views are empty. |
