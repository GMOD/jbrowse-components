---
id: gwasadapter
title: GWASAdapter
sidebar_label: Adapter -> GWASAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `gwas` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gwas/src/GWASAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'GWASTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GWASAdapter',
    uri: 'https://example.com/summary_stats.txt.gz',
  },
}
```

Reading a raw p-value column instead, transformed to -log10(p) at load:

```js
{
  type: 'GWASTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GWASAdapter',
    uri: 'https://example.com/summary_stats.txt.gz',
    scoreColumn: 'pval',
    scoreTransform: 'negLog10',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

adapter for GWAS results files; a BedTabixAdapter with `scoreColumn` defaulted
to `neg_log_pvalue` so files load with a sensible Manhattan plot score out of
the box

## Related links

- **Track:** [GWASTrack](../gwastrack)
- **Display:** [LinearManhattanDisplay](../linearmanhattandisplay)
- **Base config:** [BedTabixAdapter](../bedtabixadapter)

## Config slots

These slots go inside the track's `adapter`:
`"adapter": { "type": "GWASAdapter", ... }`. It also accepts the
[shorthand](/docs/config_guides/file_types#the-uri-shorthand) keys `uri`,
`baseUri`, `csi` in place of writing a location slot out. Slot types
(`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-scorecolumn">**scoreColumn**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'neg_log_pvalue'</code> | BED column to read as the Manhattan plot score |
| <span id="slot-scoretransform">**scoreTransform**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'none'</code> | transform applied to `scoreColumn` to produce the Manhattan -log10(p) value: `none` (column is already -log10, e.g. Pan-UKBB neglog10_pval_*), `negLog10` (column is a raw p-value), `negLog10FromLn` (column is a natural-log p-value, e.g. Pan-UKBB Hail `ln P`), or a `jexl:...` expression of `score` for anything else (e.g. `jexl:-log10(score)`) — arbitrary but slower than the native modes, so opt-in only |
| <span id="slot-ldadapter">**ldAdapter**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>null</code> | optional PLINK .ld sub-adapter (PlinkLDAdapter / PlinkLDTabixAdapter) supplying pairwise r² used for LocusZoom-style coloring when the Manhattan display's `colorBy` is `ld`; null disables it |
| <span class="slot-group">Inherited from [BedTabixAdapter](../bedtabixadapter)</span> | <span class="slot-group-count">6 slots</span> |
| <span id="slot-bedgzlocation">**bedGzLocation**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.bed.gz', locationType: 'UriLocation' }</code> | location of the bgzip-compressed BED, sorted by position. Must be bgzip rather than plain gzip, which tabix cannot index. |
| <span id="slot-columnnames">**columnNames**</span><br>`stringArray` = <code>[]</code> | List of column names. A column named like a standard BED column is parsed as that column's type (chromStart numeric, blockSizes a numeric list); any other column is text |
| <span id="slot-autosql">**autoSql**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | The autoSql definition for the data fields in the file |
| <span id="slot-disablegeneheuristic">**disableGeneHeuristic**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Disable the heuristic that auto-detects BED12 features as gene/transcript structures. Useful for files that have BED12-like structure but are not genes (e.g. tandem duplications) |
| <span id="slot-indexindextype">**index.indexType**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (TBI, CSI) = <code>'TBI'</code> | `TBI` is the usual `tabix` output. `CSI` is required for a reference longer than 512 Mb, which TBI cannot address. |
| <span id="slot-indexlocation">**index.location**</span><br>[`fileLocation`](/docs/config_guides/slot_types#filelocation) = <code>{ uri: '/path/to/my.gz.tbi', locationType: 'UriLocation' }</code> | location of the tabix index. Only needed when it is not named `<file>.tbi` (or `.csi`), which is what the `uri` shorthand assumes. |
