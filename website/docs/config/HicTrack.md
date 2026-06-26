---
id: hictrack
title: HicTrack
sidebar_label: Track -> HicTrack
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/HicTrack/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/HicTrack.md)

## Example usage

A minimal `HicTrack` config. See the
[Hi-C track guide](/docs/config_guides/hic_track) for all options:

```js
{
  type: 'HicTrack',
  trackId: 'hic',
  name: 'Hi-C',
  assemblyNames: ['hg38'],
  adapter: { type: 'HicAdapter', uri: 'https://example.com/contacts.hic' },
}
```

With log scale and a coarser resolution (`resolutionBias` nudges the auto-picked
binsize; negative = finer, positive = coarser). The `displayDefaults` object
shorthand applies settings to whichever display uses them — equivalent to a full
`displays: [{ type, displayId, ... }]` array. See
[configuring displays](/docs/config_guides/tracks#configuring-displays):

```js
{
  type: 'HicTrack',
  trackId: 'hic',
  name: 'Hi-C',
  assemblyNames: ['hg38'],
  adapter: { type: 'HicAdapter', uri: 'https://example.com/contacts.hic' },
  displayDefaults: { useLogScale: true, resolutionBias: 1 },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

### HicTrack - Display types

A track is just a container; the actual rendering behavior and config slots live
on its display type(s):

- [LinearHicDisplay](../linearhicdisplay)
  ([state model](../../models/linearhicdisplay))

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained.

<details open>
<summary>Inherited from BaseTrack</summary>

[BaseTrack config →](../basetrack)

#### slot: name

```js
{
  description: 'descriptive name of the track',
  type: 'string',
  defaultValue: 'Track',
}
```

#### slot: assemblyNames

```js
{
  description: 'name of the assembly (or assemblies) track belongs to',
  type: 'stringArray',
  defaultValue: ['assemblyName'],
}
```

#### slot: description

```js
{
  description: 'a description of the track',
  type: 'string',
  defaultValue: '',
}
```

#### slot: category

```js
{
  description: 'the category and sub-categories of a track',
  type: 'stringArray',
  defaultValue: [],
}
```

#### slot: metadata

```js
{
  type: 'frozen',
  description: 'anything to add about this track',
  defaultValue: {},
}
```

#### slot: rpcDriverName

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

```js
{
  type: 'stringArray',
  description:
    'list of which feature attributes to index for text searching',
  defaultValue: ['Name', 'ID'],
}
```

#### slot: textSearching.indexingFeatureTypesToExclude

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

```js
{
  type: 'frozen',
  description: 'adds extra fields to the feature details',
  defaultValue: {},
  contextVariable: ['feature'],
}
```

#### slot: formatDetails.subfeatures

```js
{
  type: 'frozen',
  description: 'adds extra fields to the subfeatures of a feature',
  defaultValue: {},
  contextVariable: ['feature'],
}
```

#### slot: formatDetails.depth

```js
{
  type: 'number',
  defaultValue: 2,
  description:
    'depth of subfeatures to iterate the formatter on formatDetails.subfeatures (e.g. you may not want to format the exon/cds subfeatures, so limited to 2',
}
```

#### slot: formatDetails.maxDepth

```js
{
  type: 'number',
  defaultValue: 99999,
  description: 'Maximum depth to render subfeatures',
}
```

#### slot: formatAbout.config

```js
{
  type: 'frozen',
  description: 'formats configuration object in about dialog',
  defaultValue: {},
  contextVariable: ['config'],
}
```

#### slot: formatAbout.hideUris

```js
{
  type: 'boolean',
  defaultValue: false,
}
```

</details>

### HicTrack - Derives from

- [BaseTrack](../basetrack)

```js
baseConfiguration: createBaseTrackConfig(pluginManager)
```
