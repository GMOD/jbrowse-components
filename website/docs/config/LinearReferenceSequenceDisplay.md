---
id: linearreferencesequencedisplay
title: LinearReferenceSequenceDisplay
sidebar_label: Display -> LinearReferenceSequenceDisplay
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `sequence` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/LinearReferenceSequenceDisplay/configSchema.ts).

## Example usage

The display goes in the `displays` array of the assembly's `sequence` track,
which is where a `ReferenceSequenceTrack` is authored — it names no assembly
of its own. `showForward`, `showReverse`, and `showTranslation` toggle the
strand and translation rows:

```js
sequence: {
  type: 'ReferenceSequenceTrack',
  trackId: 'refseq',
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

- **Adapter:** [BgzipFastaAdapter](../bgzipfastaadapter)
- **Adapter:** [ChromSizesAdapter](../chromsizesadapter)
- **Adapter:** [FromConfigRegionsAdapter](../fromconfigregionsadapter)
- **Adapter:** [FromConfigSequenceAdapter](../fromconfigsequenceadapter)
- **Adapter:** [IndexedFastaAdapter](../indexedfastaadapter)
- **Adapter:** [TwoBitAdapter](../twobitadapter)
- **Adapter:** [UnindexedFastaAdapter](../unindexedfastaadapter)
- **State model:** [runtime API](../../models/linearreferencesequencedisplay)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "LinearReferenceSequenceDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-height">**height**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | explicit display height (e.g. from a drag-resize); unset means auto-fit to the zoom-aware computed height. See the model's `height` getter. |
| <span id="slot-showforward">**showForward**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | show the forward-strand sequence row |
| <span id="slot-showreverse">**showReverse**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | show the reverse-complement sequence row (DNA only) |
| <span id="slot-showtranslation">**showTranslation**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | show the translation frame rows (DNA only) |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1_000_000</code> | maximum data to attempt to download for a given track, used if adapter doesn't specify one<br>_advanced_ |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |
