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
natural-log p-value):

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
- **Base config:** [BaseTrack](../basetrack)

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained. A slot redeclared by a more specific config is
shown once, at its most specific definition.

<details>
<summary>Inherited from BaseTrack</summary>

[BaseTrack config →](../basetrack)

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
