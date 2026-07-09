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

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                                                                            | Type          | Description                                                                                                                                           |
| ----------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [name](#slot-name)                                                                              | `string`      | descriptive name of the track, falls back to the trackId when unset                                                                                   |
| [assemblyNames](#slot-assemblynames)                                                            | `stringArray` | name of the assembly (or assemblies) track belongs to                                                                                                 |
| [description](#slot-description)                                                                | `string`      | a description of the track                                                                                                                            |
| [category](#slot-category)                                                                      | `stringArray` | the category and sub-categories of a track                                                                                                            |
| [metadata](#slot-metadata)                                                                      | `frozen`      | anything to add about this track                                                                                                                      |
| [adapter](#slot-adapter)                                                                        |               |                                                                                                                                                       |
| [textSearching.indexedAttributes](#slot-textsearchingindexedattributes)                         | `stringArray` | list of which feature attributes to index for text searching                                                                                          |
| [textSearching.indexingFeatureTypesToExclude](#slot-textsearchingindexingfeaturetypestoexclude) | `stringArray` | list of feature types to exclude in text search index                                                                                                 |
| [textSearching.textSearchAdapter](#slot-textsearchingtextsearchadapter)                         |               |                                                                                                                                                       |
| [displays](#slot-displays)                                                                      |               | An **array** of full display configs, e.g. `displays: [{ type: 'LinearBasicDisplay', color: 'green' }]`.                                              |
| [formatDetails.feature](#slot-formatdetailsfeature)                                             | `frozen`      | adds extra fields to the feature details                                                                                                              |
| [formatDetails.subfeatures](#slot-formatdetailssubfeatures)                                     | `frozen`      | adds extra fields to the subfeatures of a feature                                                                                                     |
| [formatDetails.depth](#slot-formatdetailsdepth)                                                 | `number`      | depth of subfeatures to iterate the formatter on formatDetails.subfeatures (e.g. you may not want to format the exon/cds subfeatures, so limited to 2 |
| [formatDetails.maxDepth](#slot-formatdetailsmaxdepth)                                           | `number`      | Maximum depth to render subfeatures                                                                                                                   |
| [formatAbout.config](#slot-formataboutconfig)                                                   | `frozen`      | formats configuration object in about dialog                                                                                                          |
| [formatAbout.hideUris](#slot-formatabouthideuris)                                               | `boolean`     |                                                                                                                                                       |

<details>
<summary>Advanced slots (1)</summary>

| Slot                                 | Type     | Description                       |
| ------------------------------------ | -------- | --------------------------------- |
| [rpcDriverName](#slot-rpcdrivername) | `string` | RPC driver to use for this track. |

</details>

<details>
<summary>BaseTrack - Slots</summary>

#### slot: name

descriptive name of the track, falls back to the trackId when unset

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: assemblyNames

name of the assembly (or assemblies) track belongs to

**Type:** `stringArray` · **Default:** `['assemblyName']`

#### slot: description

a description of the track

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: category

the category and sub-categories of a track

**Type:** `stringArray` · **Default:** `[]`

#### slot: metadata

anything to add about this track

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:** `{}`

#### slot: rpcDriverName

RPC driver to use for this track. Leave empty to use the display-level or global
default.

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`
· _advanced_

#### slot: adapter

```js
pluginManager.pluggableConfigSchemaType('adapter')
```

#### slot: textSearching.indexedAttributes

list of which feature attributes to index for text searching

**Type:** `stringArray` · **Default:** `['Name', 'ID']`

#### slot: textSearching.indexingFeatureTypesToExclude

list of feature types to exclude in text search index

**Type:** `stringArray` · **Default:** `['CDS', 'exon']`

#### slot: textSearching.textSearchAdapter

```js
pluginManager.pluggableConfigSchemaType('text search adapter')
```

#### slot: displays

An **array** of full display configs, e.g.
`displays: [{ type: 'LinearBasicDisplay', color: 'green' }]`. Each entry names a
display `type`; use this when you need exact control — your own `displayId`,
different settings for two displays, or choosing which display is the default.

For the common case, prefer the `displayDefaults` shorthand instead — an object
of appearance settings (e.g. `displayDefaults: { color: 'green' }`) that JBrowse
routes to whichever display uses each setting, so you don't have to name the
display or write the array.

See the [track config guide](/docs/config_guides/tracks/#configuring-displays).

```js
types.array(pluginManager.pluggableConfigSchemaType('display'))
```

#### slot: formatDetails.feature

adds extra fields to the feature details

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:** `{}`

```js
{
  type: 'frozen',
  description: 'adds extra fields to the feature details',
  defaultValue: {},
  contextVariable: ['feature'],
}
```

#### slot: formatDetails.subfeatures

adds extra fields to the subfeatures of a feature

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:** `{}`

```js
{
  type: 'frozen',
  description: 'adds extra fields to the subfeatures of a feature',
  defaultValue: {},
  contextVariable: ['feature'],
}
```

#### slot: formatDetails.depth

depth of subfeatures to iterate the formatter on formatDetails.subfeatures (e.g.
you may not want to format the exon/cds subfeatures, so limited to 2

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:** `2`

#### slot: formatDetails.maxDepth

Maximum depth to render subfeatures

**Type:** [`number`](/docs/config_guides/slot_types#number) · **Default:**
`99999`

#### slot: formatAbout.config

formats configuration object in about dialog

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:** `{}`

```js
{
  type: 'frozen',
  description: 'formats configuration object in about dialog',
  defaultValue: {},
  contextVariable: ['config'],
}
```

#### slot: formatAbout.hideUris

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false`

</details>
