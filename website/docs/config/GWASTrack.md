---
id: gwastrack
title: GWASTrack
sidebar_label: Track -> GWASTrack
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `gwas` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gwas/src/GWASTrack/configSchema.ts).

## Example usage

`GWASAdapter` is a `BedTabixAdapter` that defaults `scoreColumn` to
`neg_log_pvalue`. If your BED holds a raw p-value (not -log10 p), point
`scoreColumn` at that column _and_ set `scoreTransform: 'negLog10'` so it's
converted into the Manhattan -log10 p value (use `negLog10FromLn` for a
natural-log p-value, or a `jexl:...` expression of `score` such as
`jexl:-log10(score)` for anything else):

```js
{
  type: 'GWASTrack',
  trackId: 'gwas',
  name: 'GWAS results',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GWASAdapter',
    uri: 'https://example.com/gwas.bed.gz',
    scoreColumn: 'p_value',
    scoreTransform: 'negLog10',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

used for GWAS (Genome-Wide Association Study) tracks with Manhattan plot display

## Related links

- **Display:** [LinearManhattanDisplay](../linearmanhattandisplay)
  ([state model](../../models/linearmanhattandisplay))
- **Adapter:** [GWASAdapter](../gwasadapter)
- **Base config:** [BaseTrack](../basetrack)

## Config slots

These slots are top-level fields of the track config, alongside `trackId` and
`name`. Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description | From |
| --- | --- | --- |
| <span id="slot-name">**name**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | descriptive name of the track, falls back to the trackId when unset | [BaseTrack](../basetrack) |
| <span id="slot-assemblynames">**assemblyNames**</span><br>`stringArray` = <code>['assemblyName']</code> | name of the assembly (or assemblies) track belongs to | [BaseTrack](../basetrack) |
| <span id="slot-description">**description**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | a description of the track | [BaseTrack](../basetrack) |
| <span id="slot-category">**category**</span><br>`stringArray` = <code>[]</code> | the category and sub-categories of a track | [BaseTrack](../basetrack) |
| <span id="slot-metadata">**metadata**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | anything to add about this track | [BaseTrack](../basetrack) |
| <span id="slot-rpcdrivername">**rpcDriverName**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | RPC driver to use for this track. Leave empty to use the display-level or global default.<br>_advanced_ | [BaseTrack](../basetrack) |
| <span id="slot-adapter">**adapter**</span><br><code>pluginManager.pluggableConfigSchemaType('adapter')</code> |  | [BaseTrack](../basetrack) |
| <span id="slot-textsearchingindexingattributes">**textSearching.indexingAttributes**</span><br>`stringArray` = <code>['Name', 'ID', 'symbol']</code> | list of which feature attributes to index for text searching | [BaseTrack](../basetrack) |
| <span id="slot-textsearchingindexingfeaturetypestoexclude">**textSearching.indexingFeatureTypesToExclude**</span><br>`stringArray` = <code>['CDS', 'exon']</code> | list of feature types to exclude in text search index | [BaseTrack](../basetrack) |
| <span id="slot-textsearchingtextsearchadapter">**textSearching.textSearchAdapter**</span><br><details><summary><code>pluginManager.pluggableConfigSchemaType( 'text search adapter',…</code></summary><pre><code>pluginManager.pluggableConfigSchemaType(&#10;&#160;&#160;'text search adapter',&#10;)</code></pre></details> |  | [BaseTrack](../basetrack) |
| <span id="slot-displays">**displays**</span><br><code>types.array(pluginManager.pluggableConfigSchemaType('display'))</code> | An **array** of full display configs, e.g. `displays: [{ type: 'LinearBasicDisplay', color: 'green' }]`. Each entry names a display `type`; use this when you need exact control — your own `displayId`, different settings for two displays, or choosing which display is the default.<br><br>For the common case, prefer the `displayDefaults` shorthand instead — an object of appearance settings (e.g. `displayDefaults: { color: 'green' }`) that JBrowse routes to whichever display uses each setting, so you don't have to name the display or write the array.<br><br>See the [track config guide](/docs/config_guides/tracks/#configuring-displays). | [BaseTrack](../basetrack) |
| <span id="slot-formatdetailsfeature">**formatDetails.feature**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | adds extra fields to the feature details<br>_callback args:_ `feature` | [BaseTrack](../basetrack) |
| <span id="slot-formatdetailssubfeatures">**formatDetails.subfeatures**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | adds extra fields to the subfeatures of a feature<br>_callback args:_ `feature` | [BaseTrack](../basetrack) |
| <span id="slot-formatdetailsdepth">**formatDetails.depth**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>2</code> | depth of subfeatures to iterate the formatter on formatDetails.subfeatures (e.g. you may not want to format the exon/cds subfeatures, so limited to 2 | [BaseTrack](../basetrack) |
| <span id="slot-formatdetailsmaxdepth">**formatDetails.maxDepth**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>99999</code> | Maximum depth to render subfeatures | [BaseTrack](../basetrack) |
| <span id="slot-formataboutconfig">**formatAbout.config**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | formats configuration object in about dialog<br>_callback args:_ `config` | [BaseTrack](../basetrack) |
| <span id="slot-formatabouthideuris">**formatAbout.hideUris**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> |  | [BaseTrack](../basetrack) |
