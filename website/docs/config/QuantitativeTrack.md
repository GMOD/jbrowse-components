---
id: quantitativetrack
title: QuantitativeTrack
sidebar_label: Track -> QuantitativeTrack
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/QuantitativeTrack/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/QuantitativeTrack.md)

## Example usage

```js
{
  type: 'QuantitativeTrack',
  trackId: 'coverage',
  name: 'Coverage',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://example.com/coverage.bw',
  },
}
```

The same track with appearance settings in place. Rather than writing out the
full `displays` array, you can list them in a `displayDefaults` object — JBrowse
works out which display they belong to and applies them for you (here, the
`LinearWiggleDisplay`), so you don't have to know display names:

```js
{
  type: 'QuantitativeTrack',
  trackId: 'coverage',
  name: 'Coverage',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://example.com/coverage.bw',
  },
  displayDefaults: { scaleType: 'log', color: 'darkgreen' },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

a numerical signal track (coverage, conservation, etc.), typically backed by a
BigWig file and drawn as an XY plot or density

### QuantitativeTrack - Display types

A track is just a container; the actual rendering behavior and config slots live
on its display type(s):

- [LinearWiggleDisplay](../linearwiggledisplay)
  ([state model](../../models/linearwiggledisplay))

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained.

<details open>
<summary>Inherited from BaseTrack</summary>

[BaseTrack config →](../basetrack)

#### slot: name

descriptive name of the track, falls back to the trackId when unset

**Type:** `string` · **Default:** `''`

```js
{
  description:
    'descriptive name of the track, falls back to the trackId when unset',
  type: 'string',
  defaultValue: '',
}
```

#### slot: assemblyNames

name of the assembly (or assemblies) track belongs to

**Type:** `stringArray`

```js
{
  description: 'name of the assembly (or assemblies) track belongs to',
  type: 'stringArray',
  defaultValue: ['assemblyName'],
}
```

#### slot: description

a description of the track

**Type:** `string` · **Default:** `''`

```js
{
  description: 'a description of the track',
  type: 'string',
  defaultValue: '',
}
```

#### slot: category

the category and sub-categories of a track

**Type:** `stringArray`

```js
{
  description: 'the category and sub-categories of a track',
  type: 'stringArray',
  defaultValue: [],
}
```

#### slot: metadata

anything to add about this track

**Type:** `frozen`

```js
{
  type: 'frozen',
  description: 'anything to add about this track',
  defaultValue: {},
}
```

#### slot: rpcDriverName

RPC driver to use for this track. Leave empty to use the display-level or global
default.

**Type:** `string` · **Default:** `''`

```js
{
  type: 'string',
  description:
    'RPC driver to use for this track. Leave empty to use the display-level or global default.',
  defaultValue: '',
  advanced: true,
}
```

#### slot: adapter

```js
pluginManager.pluggableConfigSchemaType('adapter')
```

#### slot: textSearching.indexedAttributes

list of which feature attributes to index for text searching

**Type:** `stringArray`

```js
{
  type: 'stringArray',
  description:
    'list of which feature attributes to index for text searching',
  defaultValue: ['Name', 'ID'],
}
```

#### slot: textSearching.indexingFeatureTypesToExclude

list of feature types to exclude in text search index

**Type:** `stringArray`

```js
{
  type: 'stringArray',
  description: 'list of feature types to exclude in text search index',
  defaultValue: ['CDS', 'exon'],
}
```

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

**Type:** `frozen`

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

**Type:** `frozen`

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

```js
{
  type: 'number',
  defaultValue: 2,
  description:
    'depth of subfeatures to iterate the formatter on formatDetails.subfeatures (e.g. you may not want to format the exon/cds subfeatures, so limited to 2',
}
```

#### slot: formatDetails.maxDepth

Maximum depth to render subfeatures

**Type:** `number` · **Default:** `99999`

```js
{
  type: 'number',
  defaultValue: 99999,
  description: 'Maximum depth to render subfeatures',
}
```

#### slot: formatAbout.config

formats configuration object in about dialog

**Type:** `frozen`

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

```js
{
  type: 'boolean',
  defaultValue: false,
}
```

</details>

### QuantitativeTrack - Derives from

- [BaseTrack](../basetrack)

```js
baseConfiguration: createBaseTrackConfig(pluginManager)
```
