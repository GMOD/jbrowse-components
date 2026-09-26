---
id: gccontenttrack
title: GCContentTrack
sidebar_label: Track -> GCContentTrack
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `gccontent` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gccontent/src/GCContentTrack/configSchema.ts).

## Example usage

```js
{
  type: 'GCContentTrack',
  trackId: 'gc',
  name: 'GC content',
  assemblyNames: ['hg38'],
  adapter: { type: 'GCContentAdapter' },
}
```

GC skew over a small, overlapping sliding window for a smoother signal
(`windowDelta` under `windowSize` overlaps the windows):

```js
{
  type: 'GCContentTrack',
  trackId: 'gc_skew',
  name: 'GC skew',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GCContentAdapter',
    gcMode: 'skew',
    windowSize: 50,
    windowDelta: 10,
  },
}
```

_See the **Config slots** section below for all available configuration fields._

GC content, or GC skew, of the assembly's sequence, computed as the view
moves by a `GCContentAdapter` and drawn by the wiggle display. The adapter
holds the window, the step and the mode; the track menu's GC parameters and
GC skew write them there. The reference sequence track's menu has "Add GC
content track", which makes one.

## Related links

- **Display:** [LinearWiggleDisplay](../linearwiggledisplay) ([state model](../../models/linearwiggledisplay))
- **Adapter:** [GCContentAdapter](../gccontentadapter)
- **Base config:** [BaseTrack](../basetrack)

## Config slots

These slots are top-level fields of the track config, alongside `trackId` and `name`. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-displays">**displays**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>types.array( types.union( ...pluginManager .getDisplayElements(…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>types.array(&#10;&#160;&#160;types.union(&#10;&#160;&#160;&#160;&#160;...pluginManager&#10;&#160;&#160;&#160;&#160;&#160;&#160;.getDisplayElements()&#10;&#160;&#160;&#160;&#160;&#160;&#160;.map(d =&gt;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;d.configSchema === linearWiggleDisplayConfigSchema&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;? gcWiggleConfigSchema&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;: d.configSchema,&#10;&#160;&#160;&#160;&#160;&#160;&#160;),&#10;&#160;&#160;),&#10;)</code></pre></dialog></span> | As on [every track](../basetrack#slot-displays), except that a `LinearWiggleDisplay` entry defaults to `summaryScoreMode: 'avg'`. |
| <span class="slot-group">Inherited from [BaseTrack](../basetrack)</span> | <span class="slot-group-count">12 slots</span> |
| <span id="slot-name">**name**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | descriptive name of the track, falls back to the trackId when unset |
| <span id="slot-assemblynames">**assemblyNames**</span><br>`stringArray` = <code>['assemblyName']</code> | name of the assembly (or assemblies) track belongs to |
| <span id="slot-description">**description**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | a description of the track |
| <span id="slot-category">**category**</span><br>`stringArray` = <code>[]</code> | the category and sub-categories of a track |
| <span id="slot-metadata">**metadata**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | anything to add about this track |
| <span id="slot-adapter">**adapter**</span><br><code>pluginManager.pluggableConfigSchemaType('adapter')</code> | where this track's data comes from. Its `type` names the adapter for the file format (`BamAdapter`, `Gff3TabixAdapter`, ...) and the rest of the object is that adapter's own slots — see the adapter pages for each. Most adapters also accept a `uri` shorthand in place of writing their location slots out. |
| <span id="slot-textsearchingindexingattributes">**textSearching.indexingAttributes**</span><br>`stringArray` = <code>['Name', 'ID', 'symbol']</code> | list of which feature attributes to index for text searching |
| <span id="slot-textsearchingindexingfeaturetypestoexclude">**textSearching.indexingFeatureTypesToExclude**</span><br>`stringArray` = <code>['CDS', 'exon']</code> | list of feature types to exclude in text search index |
| <span id="slot-textsearchingindexingfeaturetypestoinclude">**textSearching.indexingFeatureTypesToInclude**</span><br>`stringArray` = <code>[]</code> | The only feature types to index, dropping every other type the file carries. Empty (the default) means no allow list, i.e. index everything `indexingFeatureTypesToExclude` does not name.<br><br>Use this instead of the exclude list when the file draws from a vocabulary you do not control. An NCBI RefSeq GFF3 uses 115 feature types, 80 of them leaf records with nothing to search for — a `match` is labelled with a bare UUID, a `cDNA_match` with an MD5, every `biological_region` with the literal string "biological region" — so a deny list leaks whichever type is added next, while the allow list (gene, pseudogene, and the transcript types) does not grow. Both may be set: this one admits, the exclude list then narrows.<br><br>GFF3 only; the GTF and VCF indexers do not filter by type. |
| <span id="slot-textsearchingtextsearchadapter">**textSearching.textSearchAdapter**</span><br><code>optionalTextSearchAdapter</code> | a per-track name search index, normally a `TrixTextSearchAdapter` over what `jbrowse text-index --tracks` built; `'genes.ix'` is enough, searching this track's assemblies. Without one, this track's features are only findable through an assembly-wide search adapter. |
| <span id="slot-formatdetails">**formatDetails**</span><br>[FormatDetails](../formatdetails) | jexl callbacks that add, rewrite or hide fields in this track's feature-details panel. The same schema exists session-wide as `configuration.formatDetails`. |
| <span id="slot-formatabout">**formatAbout**</span><br>[FormatAbout](../formatabout) | jexl callbacks that add, rewrite or hide fields in this track's About dialog. The same schema exists session-wide as `configuration.formatAbout`. |
