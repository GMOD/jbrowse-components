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

- **Extended by:** [FeatureTrack](../featuretrack)
- **Extended by:** [AlignmentsTrack](../alignmentstrack)
- **Extended by:** [GCContentTrack](../gccontenttrack)
- **Extended by:** [MultiQuantitativeTrack](../multiquantitativetrack)
- **Extended by:** [QuantitativeTrack](../quantitativetrack)
- **Extended by:** [GWASTrack](../gwastrack)
- **Extended by:** [HicTrack](../hictrack)
- **Extended by:** [MafTrack](../maftrack)
- **Extended by:** [LDTrack](../ldtrack)
- **Extended by:** [VariantTrack](../varianttrack)
- **Extended by:** [SyntenyTrack](../syntenytrack)

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
| <span id="slot-rpcdrivername">**rpcDriverName**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | RPC driver to use for this track. Leave empty to use the display-level or global default.<br>_advanced_ |
| <span id="slot-adapter">**adapter**</span><br><code>pluginManager.pluggableConfigSchemaType('adapter')</code> |  |
| <span id="slot-textsearchingindexingattributes">**textSearching.indexingAttributes**</span><br>`stringArray` = <code>['Name', 'ID', 'symbol']</code> | list of which feature attributes to index for text searching |
| <span id="slot-textsearchingindexingfeaturetypestoexclude">**textSearching.indexingFeatureTypesToExclude**</span><br>`stringArray` = <code>['CDS', 'exon']</code> | list of feature types to exclude in text search index |
| <span id="slot-textsearchingtextsearchadapter">**textSearching.textSearchAdapter**</span><br><details><summary><code>pluginManager.pluggableConfigSchemaType( 'text search adapter',…</code></summary><pre><code>pluginManager.pluggableConfigSchemaType(&#10;&#160;&#160;'text search adapter',&#10;)</code></pre></details> |  |
| <span id="slot-displays">**displays**</span><br><code>types.array(pluginManager.pluggableConfigSchemaType('display'))</code> | An **array** of full display configs, e.g. `displays: [{ type: 'LinearBasicDisplay', color: 'green' }]`. Each entry names a display `type`; use this when you need exact control — your own `displayId`, different settings for two displays, or choosing which display is the default.<br><br>For the common case, prefer the `displayDefaults` shorthand instead — an object of appearance settings (e.g. `displayDefaults: { color: 'green' }`) that JBrowse routes to whichever display uses each setting, so you don't have to name the display or write the array.<br><br>See the [track config guide](/docs/config_guides/tracks/#configuring-displays). |
| <span id="slot-formatdetailsfeature">**formatDetails.feature**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | adds extra fields to the feature details<br>_callback args:_ `feature` |
| <span id="slot-formatdetailssubfeatures">**formatDetails.subfeatures**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | adds extra fields to the subfeatures of a feature<br>_callback args:_ `feature` |
| <span id="slot-formatdetailsdepth">**formatDetails.depth**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>2</code> | depth of subfeatures to iterate the formatter on formatDetails.subfeatures (e.g. you may not want to format the exon/cds subfeatures, so limited to 2 |
| <span id="slot-formatdetailsmaxdepth">**formatDetails.maxDepth**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>99999</code> | Maximum depth to render subfeatures |
| <span id="slot-formataboutconfig">**formatAbout.config**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>{}</code> | formats configuration object in about dialog<br>_callback args:_ `config` |
| <span id="slot-formatabouthideuris">**formatAbout.hideUris**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> |  |
