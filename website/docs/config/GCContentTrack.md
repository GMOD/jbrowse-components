---
id: gccontenttrack
title: GCContentTrack
sidebar_label: Track -> GCContentTrack
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `gccontent`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gccontent/src/GCContentTrack/configSchema.ts).

## Example usage

A standalone `GCContentTrack` whose `GCContentAdapter` wraps a sequence adapter
(use this instead of the `ReferenceSequenceTrack` display when you want GC as
its own track):

```js
{
  type: 'GCContentTrack',
  trackId: 'gc',
  name: 'GC content',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GCContentAdapter',
    sequenceAdapter: {
      type: 'IndexedFastaAdapter',
      fastaLocation: { uri: 'https://example.com/genome.fa' },
      faiLocation: { uri: 'https://example.com/genome.fa.fai' },
    },
  },
}
```

GC-skew mode with a small, overlapping sliding window for a smoother signal
(`windowDelta` smaller than `windowSize` means windows overlap). The
`displayDefaults` object shorthand applies settings to whichever display uses
them — equivalent to writing a full `displays: [{ type, displayId, ... }]`
array. See
[configuring displays](/docs/config_guides/tracks#configuring-displays):

```js
{
  type: 'GCContentTrack',
  trackId: 'gc',
  name: 'GC skew',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GCContentAdapter',
    sequenceAdapter: {
      type: 'IndexedFastaAdapter',
      fastaLocation: { uri: 'https://example.com/genome.fa' },
      faiLocation: { uri: 'https://example.com/genome.fa.fai' },
    },
  },
  displayDefaults: { gcMode: 'skew', windowSize: 50, windowDelta: 10 },
}
```

_See the **Config slots** section below for all available configuration fields._

used for having a gc content track outside of the "reference sequence display"

## Related links

- **Display:** [LinearGCContentTrackDisplay](../lineargccontenttrackdisplay)
  ([state model](../../models/lineargccontenttrackdisplay))
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

#### slot: textSearching.indexingAttributes

list of which feature attributes to index for text searching

**Type:** `stringArray` · **Default:** `['Name', 'ID', 'symbol']`

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
