---
id: varianttrack
title: VariantTrack
sidebar_label: Track -> VariantTrack
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `variants`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/VariantTrack/configSchema.ts).

## Example usage

```js
{
  type: 'VariantTrack',
  trackId: 'my-variants',
  name: 'My variants',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://example.com/variants.vcf.gz',
  },
}
```

The same track with appearance settings in place. Rather than writing out the
full `displays` array, you can list them in a `displayDefaults` object — JBrowse
works out which display they belong to and applies them for you (here it puts
`color` on the `LinearVariantDisplay`), so you don't have to know display names.
A `jexl:` value works here for per-feature coloring:

```js
{
  type: 'VariantTrack',
  trackId: 'my-variants',
  name: 'My variants',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://example.com/variants.vcf.gz',
  },
  displayDefaults: { color: 'darkblue' },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

Mostly similar to feature track, but has `ChordDisplayType` registered to it,
and custom feature details in `LinearVariantDisplay`

### VariantTrack - Display types

A track is just a container; the actual rendering behavior and config slots live
on its display type(s):

- [LinearPairedArcDisplay](../linearpairedarcdisplay)
  ([state model](../../models/linearpairedarcdisplay))
- [ChordVariantDisplay](../chordvariantdisplay)
  ([state model](../../models/chordvariantdisplay))
- [LinearMultiSampleVariantDisplay](../linearmultisamplevariantdisplay)
  ([state model](../../models/linearmultisamplevariantdisplay))
- [LinearMultiSampleVariantMatrixDisplay](../linearmultisamplevariantmatrixdisplay)
  ([state model](../../models/linearmultisamplevariantmatrixdisplay))
- [LinearVariantDisplay](../linearvariantdisplay)
  ([state model](../../models/linearvariantdisplay))

### VariantTrack - Compatible adapters

Data adapters that can supply this track:

- [BedpeAdapter](../bedpeadapter)
- [StarFusionAdapter](../starfusionadapter)
- [SplitVcfTabixAdapter](../splitvcftabixadapter)
- [VcfAdapter](../vcfadapter)
- [VcfTabixAdapter](../vcftabixadapter)

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained. A slot redeclared by a more specific config is
shown once, at its most specific definition.

<details open>
<summary>Inherited from BaseTrack</summary>

[BaseTrack config →](../basetrack)

#### slot: name

descriptive name of the track, falls back to the trackId when unset

**Type:** `string` · **Default:** `''`

#### slot: assemblyNames

name of the assembly (or assemblies) track belongs to

**Type:** `stringArray` · **Default:** `['assemblyName']`

#### slot: description

a description of the track

**Type:** `string` · **Default:** `''`

#### slot: category

the category and sub-categories of a track

**Type:** `stringArray` · **Default:** `[]`

#### slot: metadata

anything to add about this track

**Type:** `frozen` · **Default:** `{}`

#### slot: rpcDriverName

RPC driver to use for this track. Leave empty to use the display-level or global
default.

**Type:** `string` · **Default:** `''` · _advanced_

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

**Type:** `frozen` · **Default:** `{}`

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

**Type:** `frozen` · **Default:** `{}`

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

**Type:** `number` · **Default:** `2`

#### slot: formatDetails.maxDepth

Maximum depth to render subfeatures

**Type:** `number` · **Default:** `99999`

#### slot: formatAbout.config

formats configuration object in about dialog

**Type:** `frozen` · **Default:** `{}`

```js
{
  type: 'frozen',
  description: 'formats configuration object in about dialog',
  defaultValue: {},
  contextVariable: ['config'],
}
```

#### slot: formatAbout.hideUris

**Type:** `boolean` · **Default:** `false`

</details>

### VariantTrack - Derives from

- [BaseTrack](../basetrack)
