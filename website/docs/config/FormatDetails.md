---
id: formatdetails
title: FormatDetails
description: "Holds jexl callbacks that add, rewrite or hide fields in the feature-details panel."
sidebar_label: Root -> FormatDetails
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/configuration/formatDetailsConfigSchema.ts).

Holds jexl callbacks that add, rewrite or hide fields in the feature-details
panel. Every track has this schema, and so does the root config as
`configuration.formatDetails`, which applies to every track at once. Where
both are set, the callbacks merge with the track's object over the session's,
so a track can override individual keys the global callback added, and the
numeric slots take the track's value when the track sets one.

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

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-formatdetailsfeature">**formatDetails.feature**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | callback returning an object of fields to merge onto the clicked feature. `track` is the track's config, so one session-wide callback can link out per assembly or name the track. A plain object works too, for fields that are the same on every feature<br>_callback args:_ `feature`, `track` |
| <span id="slot-formatdetailssubfeatures">**formatDetails.subfeatures**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | the same, applied to each subfeature down to `depth`. `parent` is the feature it sits in and `depth` how far down, 1 for a gene's transcript and 2 for the transcript's exon<br>_callback args:_ `feature`, `parent`, `depth`, `track` |
| <span id="slot-formatdetailsdepth">**formatDetails.depth**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The number of subfeature levels the `subfeatures` callback runs on, defaulting to 2, which reaches a gene's transcripts and their exons and CDSs; 1 stops at the transcripts. A track's value wins over the session's<br>_advanced_ |
| <span id="slot-formatdetailsmaxdepth">**formatDetails.maxDepth**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | The number of subfeature card levels the panel renders at all, independent of how deep `subfeatures` formats. Unset means no limit. A track's value wins over the session's<br>_advanced_ |
