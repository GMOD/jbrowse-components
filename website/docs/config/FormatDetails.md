---
id: formatdetails
title: FormatDetails
sidebar_label: Root -> FormatDetails
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/formatDetailsConfigSchema.ts).

## Example usage

On a track. The callback returns an object merged over the feature: a new key
adds a row, an existing key rewrites it, and `undefined` hides it. A bare URL
is turned into a link for you, so no `<a>` markup is needed:

```js
{
  type: 'FeatureTrack',
  trackId: 'genes',
  name: 'Genes',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'Gff3TabixAdapter',
    uri: 'https://example.com/genes.gff.gz',
  },
  formatDetails: {
    feature: "jexl:{ncbi:'https://www.ncbi.nlm.nih.gov/gene/?term='+feature.name, phase:undefined}",
  },
}
```

_See the **Config slots** section below for all available configuration fields._

jexl callbacks that add, rewrite or hide fields in the feature-details panel.
The same schema hangs off every track and off the session as
`configuration.formatDetails`, which applies to every track at once. Where
both are set, the callbacks merge with the track's object over the session's,
so a track can override individual keys the global callback added, and the
numeric slots take the track's value when the track sets one.

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-formatdetailsfeature">**formatDetails.feature**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | callback returning an object of fields to merge onto the clicked feature. A plain object works too, for fields that are the same on every feature<br>_callback args:_ `feature` |
| <span id="slot-formatdetailssubfeatures">**formatDetails.subfeatures**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | the same, applied to each subfeature down to `depth`<br>_callback args:_ `feature` |
| <span id="slot-formatdetailsdepth">**formatDetails.depth**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | how many levels of subfeature the `subfeatures` callback runs on, defaulting to 2, which stops at a gene's transcripts rather than descending into their exons and CDSs. A track's value wins over the session's |
| <span id="slot-formatdetailsmaxdepth">**formatDetails.maxDepth**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | how many levels of subfeature card the panel renders at all, which is a separate question from how deep `subfeatures` formats. Unset means no limit. A track's value wins over the session's |
