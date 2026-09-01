---
id: gff3tabixadapter
title: Gff3TabixAdapter
sidebar_label: Adapter -> Gff3TabixAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `gff3` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gff3/src/Gff3TabixAdapter/configSchema.ts).

## Example usage

The `uri` shorthand auto-resolves the `.tbi` index; add `csi: true` for a
`.csi` index instead:

```js
{
  type: 'FeatureTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'Gff3TabixAdapter',
    uri: 'https://example.com/genes.gff3.gz',
  },
}
```

`genes.gff3.gz` infers `Gff3TabixAdapter` and `FeatureTrack` on its own, and `name` defaults to the file name. In a config declaring one assembly, `assemblyNames` comes from there too — see [the shortest track](/docs/config_guides/tracks#the-shortest-track).

```js
{
  trackId: 'my_track',
  uri: 'https://example.com/genes.gff3.gz',
  assemblyNames: ['hg38'],
}
```

_See the **Config slots** section below for all available configuration fields._

used to load bgzip-compressed, tabix-indexed GFF3 files

## Related links

- **Track:** [FeatureTrack](../featuretrack)
- **Display:** [LinearArcDisplay](../lineararcdisplay)
- **Display:** [LinearBasicDisplay](../linearbasicdisplay)
- **Display:** [LinearMultiRowFeatureDisplay](../linearmultirowfeaturedisplay)
- **Display:** [LinearScoreDisplay](../linearscoredisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "Gff3TabixAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri`, `csi` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-gffgzlocation">**gffGzLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.gff.gz', locationType: 'UriLocation' }</code> | location of the bgzip-compressed GFF3, sorted by position. Must be bgzip rather than plain gzip, which tabix cannot index. |
| <span id="slot-dontredispatch">**dontRedispatch**</span><br>`stringArray` = <code>[ 'chromosome', 'region', 'contig', 'supercontig', 'scaffold' ]</code> | the Gff3TabixAdapter has to "redispatch" if it fetches a region and features it finds inside that region extend outside the region we requested. you can disable this for certain feature types to avoid fetching e.g. the entire chromosome<br><br>the defaults are the whole-sequence records the common GFF3 sources emit: `region` (NCBI), `supercontig`/`scaffold` (Ensembl, for non-chromosomal sequences), plus `chromosome` and `contig`. They span an entire reference and have no children, so letting one expand the fetch would pull a whole chromosome to gain nothing |
| <span id="slot-indexindextype">**index.indexType**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (TBI, CSI) = <code>'TBI'</code> | `TBI` is the usual `tabix` output. `CSI` is required for a reference longer than 512 Mb, which TBI cannot address. |
| <span id="slot-indexlocation">**index.location**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.gz.tbi', locationType: 'UriLocation' }</code> | location of the tabix index. Only needed when it is not named `<file>.tbi` (or `.csi`), which is what the `uri` shorthand assumes. |
