---
id: gtftabixadapter
title: GtfTabixAdapter
sidebar_label: Adapter -> GtfTabixAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `gtf` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gtf/src/GtfTabixAdapter/configSchema.ts).

## Example usage

The `uri` shorthand auto-resolves the `.tbi` index:

```js
{
  type: 'FeatureTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GtfTabixAdapter',
    uri: 'https://example.com/genes.gtf.gz',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

used to load bgzip-compressed, tabix-indexed GTF files

## Related links

- **Track:** [FeatureTrack](../featuretrack)
- **Display:** [LinearScoreDisplay](../linearscoredisplay)
- **Display:** [LinearArcDisplay](../lineararcdisplay)
- **Display:** [LinearBasicDisplay](../linearbasicdisplay)
- **Display:** [LinearMultiRowFeatureDisplay](../linearmultirowfeaturedisplay)

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "GtfTabixAdapter", ... }`. Slot types (`fileLocation`,
`frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-gtfgzlocation">**gtfGzLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.gtf.gz', locationType: 'UriLocation' }</code> |  |
| <span id="slot-indexindextype">**index.indexType**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (TBI, CSI) = <code>'TBI'</code> |  |
| <span id="slot-indexlocation">**index.location**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.gtf.gz.tbi', locationType: 'UriLocation' }</code> |  |
| <span id="slot-dontredispatch">**dontRedispatch**</span><br>`stringArray` = <code>[ 'chromosome', 'region', 'contig', 'supercontig', 'scaffold' ]</code> | the GtfTabixAdapter has to "redispatch" if it fetches a region and features it finds inside that region extend outside the region we requested. you can disable this for certain feature types to avoid fetching e.g. the entire chromosome<br><br>the defaults are the whole-sequence records the common annotation sources emit: `region` (NCBI), `supercontig`/`scaffold` (Ensembl, for non-chromosomal sequences), plus `chromosome` and `contig`. They span an entire reference and have no children, so letting one expand the fetch would pull a whole chromosome to gain nothing |
| <span id="slot-aggregatefield">**aggregateField**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'gene_name'</code> | field used to aggregate multiple transcripts into a single parent gene feature |
