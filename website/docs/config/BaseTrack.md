---
id: basetrack
title: BaseTrack
sidebar_label: Track -> BaseTrack
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Built into JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/baseTrackConfig.ts).

## Overview

Configuration shared by all track types. Concrete tracks (FeatureTrack,
AlignmentsTrack, VariantTrack, ...) extend this, so every track accepts these
fields in addition to its own.

### BaseTrack - Identifier

Every BaseTrack has a unique `trackId`, a required top-level field that
identifies it (not one of the config slots below).

## Related links

- **Extended by:** [AlignmentsTrack](../alignmentstrack)
- **Extended by:** [FeatureTrack](../featuretrack)
- **Extended by:** [GCContentTrack](../gccontenttrack)
- **Extended by:** [GWASTrack](../gwastrack)
- **Extended by:** [HicTrack](../hictrack)
- **Extended by:** [LDTrack](../ldtrack)
- **Extended by:** [MafTrack](../maftrack)
- **Extended by:** [MultiQuantitativeTrack](../multiquantitativetrack)
- **Extended by:** [QuantitativeTrack](../quantitativetrack)
- **Extended by:** [SyntenyTrack](../syntenytrack)
- **Extended by:** [VariantTrack](../varianttrack)

## Config slots

`BaseTrack` is a shared base schema, not a type you name in a config. Set these
slots on one of the configs under **Extended by** above, each of which lists
them as inherited and shows the shape in its own example. Slot types
(`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-name">**name**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | descriptive name of the track, falls back to the trackId when unset |
| <span id="slot-assemblynames">**assemblyNames**</span><br>`stringArray` = <code>['assemblyName']</code> | name of the assembly (or assemblies) track belongs to |
| <span id="slot-description">**description**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | a description of the track |
| <span id="slot-category">**category**</span><br>`stringArray` = <code>[]</code> | the category and sub-categories of a track |
| <span id="slot-metadata">**metadata**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | anything to add about this track |
| <span id="slot-adapter">**adapter**</span><br><code>pluginManager.pluggableConfigSchemaType('adapter')</code> | where this track's data comes from. Its `type` names the adapter for the file format (`BamAdapter`, `Gff3TabixAdapter`, ...) and the rest of the object is that adapter's own slots — see the adapter pages for each. Most adapters also accept a `uri` shorthand in place of writing their location slots out. |
| <span id="slot-textsearchingindexingattributes">**textSearching.indexingAttributes**</span><br>`stringArray` = <code>['Name', 'ID', 'symbol']</code> | list of which feature attributes to index for text searching |
| <span id="slot-textsearchingindexingfeaturetypestoexclude">**textSearching.indexingFeatureTypesToExclude**</span><br>`stringArray` = <code>['CDS', 'exon']</code> | list of feature types to exclude in text search index |
| <span id="slot-textsearchingindexingfeaturetypestoinclude">**textSearching.indexingFeatureTypesToInclude**</span><br>`stringArray` = <code>[]</code> | The only feature types to index, dropping every other type the file carries. Empty (the default) means no allow list, i.e. index everything `indexingFeatureTypesToExclude` does not name.<br><br>Use this instead of the exclude list when the file draws from a vocabulary you do not control. An NCBI RefSeq GFF3 uses 115 feature types, 80 of them leaf records with nothing to search for — a `match` is labelled with a bare UUID, a `cDNA_match` with an MD5, every `biological_region` with the literal string "biological region" — so a deny list leaks whichever type is added next, while the allow list (gene, pseudogene, and the transcript types) does not grow. Both may be set: this one admits, the exclude list then narrows.<br><br>GFF3 only; the GTF and VCF indexers do not filter by type. |
| <span id="slot-textsearchingtextsearchadapter">**textSearching.textSearchAdapter**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>pluginManager.pluggableConfigSchemaType( 'text search adapter',…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>pluginManager.pluggableConfigSchemaType(&#10;&#160;&#160;'text search adapter',&#10;)</code></pre></dialog></span> | a per-track name search index, normally a `TrixTextSearchAdapter` over what `jbrowse text-index --tracks` built. Without one, this track's features are only findable through an assembly-wide search adapter. |
| <span id="slot-displays">**displays**</span><br><code>types.array(pluginManager.pluggableConfigSchemaType('display'))</code> | An **array** of full display configs, e.g. `displays: [{ type: 'LinearBasicDisplay', color: 'green' }]`. Each entry names a display `type`; use this when you need exact control — your own `displayId`, different settings for two displays, or choosing which display is the default.<br><br>For the common case, prefer the `displayDefaults` shorthand instead — an object of appearance settings (e.g. `displayDefaults: { color: 'green' }`) that JBrowse routes to whichever display uses each setting, so you don't have to name the display or write the array.<br><br>See the [track config guide](/docs/config_guides/tracks/#configuring-displays). |
| <span id="slot-formatdetails">**formatDetails**</span><br><code>FormatDetailsConfigSchemaFactory()</code> | jexl callbacks that add, rewrite or hide fields in this track's feature-details panel. Four slots, listed at [FormatDetails](/docs/config/formatdetails), and the same schema exists session-wide as `configuration.formatDetails`. |
| <span id="slot-formatabout">**formatAbout**</span><br><code>FormatAboutConfigSchemaFactory()</code> | jexl callbacks that add, rewrite or hide fields in this track's About dialog. Two slots, listed at [FormatAbout](/docs/config/formatabout), and the same schema exists session-wide as `configuration.formatAbout`. |
