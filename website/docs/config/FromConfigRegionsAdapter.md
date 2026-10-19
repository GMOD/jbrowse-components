---
id: fromconfigregionsadapter
title: FromConfigRegionsAdapter
description: "Supplies an assembly's reference names and sizes inline in the config, with no sequence."
sidebar_label: Adapter -> FromConfigRegionsAdapter
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `config` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/config/src/FromConfigRegionsAdapter/configSchema.ts).

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

Supplies an assembly's reference names and sizes inline in the config, with
no sequence.

## Related links

- **Track:** [ReferenceSequenceTrack](../referencesequencetrack)
- **Display:** [LinearReferenceSequenceDisplay](../linearreferencesequencedisplay)

## Config slots

Adapter slots go inside the track's `adapter`: `"adapter": { "type": "FromConfigRegionsAdapter", ... }`. `FromConfigRegionsAdapter` has no `uri` [shorthand](/docs/config_guides/file_types#the-uri-shorthand) — give it the location slots below. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-adapterid">**adapterId**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | stable identifier used as the adapter cache key; avoids hashing the (potentially large) features array. optional — falls back to hash. |
| <span id="slot-features">**features**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>[]</code> | one entry per reference sequence, each with a `uniqueId`, `refName`, `start: 0` and `end` set to that sequence's length. This is what defines the assembly's reference names and sizes; no bases are supplied, so base-level views are empty. |

## Retired keys

An older config may still write these. Each loads without an error, and `jbrowse validate` reports it as stale.

<!-- prettier-ignore -->
| Key | On load |
| --- | --- |
| `featureClass` | ignored |
