---
id: gtftabixadapter
title: GtfTabixAdapter
sidebar_label: Adapter -> GtfTabixAdapter
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `gtf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gtf/src/GtfTabixAdapter/configSchema.ts).

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
    type: 'GtfTabixAdapter',
    uri: 'https://example.com/genes.gtf.gz',
  },
}
```

`genes.gtf.gz` infers `GtfTabixAdapter` and `FeatureTrack` on its own, and `name` defaults to the file name. In a config declaring one assembly, `assemblyNames` comes from there too — see [the shortest track](/docs/config_guides/tracks#the-shortest-track).

```js
{
  trackId: 'my_track',
  uri: 'https://example.com/genes.gtf.gz',
  assemblyNames: ['hg38'],
}
```

_See the **Config slots** section below for all available configuration fields._

used to load bgzip-compressed, tabix-indexed GTF files

## Related links

- **Track:** [FeatureTrack](../featuretrack)
- **Display:** [LinearArcDisplay](../lineararcdisplay)
- **Display:** [LinearBasicDisplay](../linearbasicdisplay)
- **Display:** [LinearMultiRowFeatureDisplay](../linearmultirowfeaturedisplay)
- **Display:** [LinearScoreDisplay](../linearscoredisplay)

## Config slots

These slots go inside the track's `adapter`: `"adapter": { "type": "GtfTabixAdapter", ... }`. It also accepts the [shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`, `baseUri`, `csi` in place of writing a location slot out. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-gtfgzlocation">**gtfGzLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.gtf.gz', locationType: 'UriLocation' }</code> | location of the bgzip-compressed GTF, sorted by position. Must be bgzip rather than plain gzip, which tabix cannot index. |
| <span id="slot-dontredispatch">**dontRedispatch**</span><br>`stringArray` = <code>[ 'chromosome', 'region', 'contig', 'supercontig', 'scaffold' ]</code> | the GtfTabixAdapter has to "redispatch" if it fetches a region and features it finds inside that region extend outside the region we requested. you can disable this for certain feature types to avoid fetching e.g. the entire chromosome<br><br>the defaults are the whole-sequence records the common annotation sources emit: `region` (NCBI), `supercontig`/`scaffold` (Ensembl, for non-chromosomal sequences), plus `chromosome` and `contig`. They span an entire reference and have no children, so letting one expand the fetch would pull a whole chromosome to gain nothing |
| <span id="slot-aggregatefield">**aggregateField**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'gene_name'</code> | attribute naming the parent gene that transcripts are aggregated into. transcripts are grouped by gene_id where the file has one (gene names are not unique within a reference), so this is the gene label, and the grouping key only for files with no gene_id |
| <span id="slot-indexindextype">**index.indexType**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (TBI, CSI) = <code>'TBI'</code> | `TBI` is the usual `tabix` output. `CSI` is required for a reference longer than 512 Mb, which TBI cannot address. |
| <span id="slot-indexlocation">**index.location**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.gz.tbi', locationType: 'UriLocation' }</code> | location of the tabix index. Only needed when it is not named `<file>.tbi`, which is what the `uri` shorthand assumes — a `.csi` beside the file is reached with `csi: true` rather than by spelling this out. |
| <span id="slot-densityadapter">**densityAdapter**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>null</code> | optional quantitative sub-adapter (e.g. a BigWigAdapter over a features-per-bin bigWig) drawn as a density band where the region is too large to fetch features; null disables it |
