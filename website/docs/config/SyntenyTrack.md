---
id: syntenytrack
title: SyntenyTrack
sidebar_label: Track -> SyntenyTrack
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`linear-comparative-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/SyntenyTrack/configSchema.ts).

## Example usage

A `SyntenyTrack` config to paste into `tracks`. The adapter needs the query
(first) and target (second) assembly names, matched by the track's
`assemblyNames`. See the
[synteny track guide](/docs/config_guides/synteny_track) for all options:

```js
{
  type: 'SyntenyTrack',
  trackId: 'hg38_vs_mm10',
  name: 'hg38 vs mm10',
  assemblyNames: ['hg38', 'mm10'],
  adapter: {
    type: 'PAFAdapter',
    uri: 'https://example.com/hg38_vs_mm10.paf',
    queryAssembly: 'hg38',
    targetAssembly: 'mm10',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

## Related links

- **Display:** [DotplotDisplay](../dotplotdisplay)
  ([state model](../../models/dotplotdisplay))
- **Display:** [LGVSyntenyDisplay](../lgvsyntenydisplay)
  ([state model](../../models/lgvsyntenydisplay))
- **Display:** [LinearSyntenyDisplay](../linearsyntenydisplay)
  ([state model](../../models/linearsyntenydisplay))
- **Adapter:** [AllVsAllIndexedPAFAdapter](../allvsallindexedpafadapter)
- **Adapter:** [AllVsAllPAFAdapter](../allvsallpafadapter)
- **Adapter:** [BlastTabularAdapter](../blasttabularadapter)
- **Adapter:** [ChainAdapter](../chainadapter)
- **Adapter:** [DeltaAdapter](../deltaadapter)
- **Adapter:** [MashMapAdapter](../mashmapadapter)
- **Adapter:** [MCScanAnchorsAdapter](../mcscananchorsadapter)
- **Adapter:** [MCScanBlocksAdapter](../mcscanblocksadapter)
- **Adapter:** [MCScanSimpleAnchorsAdapter](../mcscansimpleanchorsadapter)
- **Adapter:** [PAFAdapter](../pafadapter)
- **Adapter:** [PairwiseIndexedPAFAdapter](../pairwiseindexedpafadapter)
- **Base config:** [BaseTrack](../basetrack)

## Config slots

These slots are top-level fields of the track config, alongside `trackId` and
`name`. Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span class="slot-group">Inherited from [BaseTrack](../basetrack)</span> | <span class="slot-group-count">12 slots</span> |
| <span id="slot-name">**name**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | descriptive name of the track, falls back to the trackId when unset |
| <span id="slot-assemblynames">**assemblyNames**</span><br>`stringArray` = <code>['assemblyName']</code> | name of the assembly (or assemblies) track belongs to |
| <span id="slot-description">**description**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | a description of the track |
| <span id="slot-category">**category**</span><br>`stringArray` = <code>[]</code> | the category and sub-categories of a track |
| <span id="slot-metadata">**metadata**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | anything to add about this track |
| <span id="slot-adapter">**adapter**</span><br><code>pluginManager.pluggableConfigSchemaType('adapter')</code> | where this track's data comes from. Its `type` names the adapter for the file format (`BamAdapter`, `Gff3TabixAdapter`, ...) and the rest of the object is that adapter's own slots — see the adapter pages for each. Most adapters also accept a `uri` shorthand in place of writing their location slots out. |
| <span id="slot-textsearchingindexingattributes">**textSearching.indexingAttributes**</span><br>`stringArray` = <code>['Name', 'ID', 'symbol']</code> | list of which feature attributes to index for text searching |
| <span id="slot-textsearchingindexingfeaturetypestoexclude">**textSearching.indexingFeatureTypesToExclude**</span><br>`stringArray` = <code>['CDS', 'exon']</code> | list of feature types to exclude in text search index |
| <span id="slot-textsearchingtextsearchadapter">**textSearching.textSearchAdapter**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>pluginManager.pluggableConfigSchemaType( 'text search adapter',…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>pluginManager.pluggableConfigSchemaType(&#10;&#160;&#160;'text search adapter',&#10;)</code></pre></dialog></span> | a per-track name search index, normally a `TrixTextSearchAdapter` over what `jbrowse text-index --tracks` built. Without one, this track's features are only findable through an assembly-wide search adapter. |
| <span id="slot-displays">**displays**</span><br><code>types.array(pluginManager.pluggableConfigSchemaType('display'))</code> | An **array** of full display configs, e.g. `displays: [{ type: 'LinearBasicDisplay', color: 'green' }]`. Each entry names a display `type`; use this when you need exact control — your own `displayId`, different settings for two displays, or choosing which display is the default.<br><br>For the common case, prefer the `displayDefaults` shorthand instead — an object of appearance settings (e.g. `displayDefaults: { color: 'green' }`) that JBrowse routes to whichever display uses each setting, so you don't have to name the display or write the array.<br><br>See the [track config guide](/docs/config_guides/tracks/#configuring-displays). |
| <span id="slot-formatdetails">**formatDetails**</span><br><code>FormatDetailsConfigSchemaFactory()</code> | jexl callbacks that add, rewrite or hide fields in this track's feature-details panel. Four slots, listed at [FormatDetails](/docs/config/formatdetails), and the same schema exists session-wide as `configuration.formatDetails`. |
| <span id="slot-formatabout">**formatAbout**</span><br><code>FormatAboutConfigSchemaFactory()</code> | jexl callbacks that add, rewrite or hide fields in this track's About dialog. Two slots, listed at [FormatAbout](/docs/config/formatabout), and the same schema exists session-wide as `configuration.formatAbout`. |
