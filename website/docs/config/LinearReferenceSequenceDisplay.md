---
id: linearreferencesequencedisplay
title: LinearReferenceSequenceDisplay
sidebar_label: Display -> LinearReferenceSequenceDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `sequence`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/LinearReferenceSequenceDisplay/configSchema.ts).

## Example usage

A complete `ReferenceSequenceTrack` config to paste into `tracks` (an assembly's
`sequence` track takes the same shape). `showForward`, `showReverse`, and
`showTranslation` toggle the strand/translation rows:

```js
{
  type: 'ReferenceSequenceTrack',
  trackId: 'refseq',
  name: 'Reference sequence',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'IndexedFastaAdapter',
    uri: 'https://example.com/genome.fa',
  },
  displays: [
    {
      type: 'LinearReferenceSequenceDisplay',
      displayId: 'refseq-LinearReferenceSequenceDisplay',
      showTranslation: false,
    },
  ],
}
```

_See the **Config slots** section below for all available configuration fields._

## Related links

- **Adapter:** [FromConfigRegionsAdapter](../fromconfigregionsadapter)
- **Adapter:** [FromConfigSequenceAdapter](../fromconfigsequenceadapter)
- **Adapter:** [BgzipFastaAdapter](../bgzipfastaadapter)
- **Adapter:** [ChromSizesAdapter](../chromsizesadapter)
- **Adapter:** [IndexedFastaAdapter](../indexedfastaadapter)
- **Adapter:** [TwoBitAdapter](../twobitadapter)
- **Adapter:** [UnindexedFastaAdapter](../unindexedfastaadapter)
- **State model:** [runtime API](../../models/linearreferencesequencedisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                     | Type          | Description                                                                                                |
| ---------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------- |
| [height](#slot-height)                   | `maybeNumber` | explicit display height (e.g. from a drag-resize); unset means auto-fit to the zoom-aware computed height. |
| [showForward](#slot-showforward)         | `boolean`     | show the forward-strand sequence row                                                                       |
| [showReverse](#slot-showreverse)         | `boolean`     | show the reverse-complement sequence row (DNA only)                                                        |
| [showTranslation](#slot-showtranslation) | `boolean`     | show the translation frame rows (DNA only)                                                                 |

<details>
<summary>LinearReferenceSequenceDisplay - Slots</summary>

#### slot: height

explicit display height (e.g. from a drag-resize); unset means auto-fit to the
zoom-aware computed height. See the model's `height` getter.

**Type:** `maybeNumber` · **Default:** `undefined`

#### slot: showForward

show the forward-strand sequence row

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: showReverse

show the reverse-complement sequence row (DNA only)

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

#### slot: showTranslation

show the translation frame rows (DNA only)

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`true`

</details>
