---
id: varianttrack
title: VariantTrack
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/VariantTrack/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/VariantTrack.md)

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
full `displays` array, you can list them in a `displays` object — JBrowse works
out which display they belong to and applies them for you (here it puts `color`
on the `LinearVariantDisplay`), so you don't have to know display names. A
`jexl:` value works here for per-feature coloring:

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
  displays: { color: 'darkblue' },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

Mostly similar to feature track, but has `ChordDisplayType` registered to it,
and custom feature details in `LinearVariantDisplay`

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained.

### Inherited from [BaseTrack](../basetrack)

#### slot: name

```js
name: {
        description: 'descriptive name of the track',
        type: 'string',
        defaultValue: 'Track',
      }
```

#### slot: assemblyNames

```js
assemblyNames: {
        description: 'name of the assembly (or assemblies) track belongs to',
        type: 'stringArray',
        defaultValue: ['assemblyName'],
      }
```

#### slot: description

```js
description: {
        description: 'a description of the track',
        type: 'string',
        defaultValue: '',
      }
```

#### slot: category

```js
category: {
        description: 'the category and sub-categories of a track',
        type: 'stringArray',
        defaultValue: [],
      }
```

#### slot: metadata

```js
metadata: {
        type: 'frozen',
        description: 'anything to add about this track',
        defaultValue: {},
      }
```

#### slot: rpcDriverName

```js
rpcDriverName: {
        type: 'string',
        description:
          'RPC driver to use for this track. Leave empty to use the display-level or global default.',
        defaultValue: '',
        advanced: true,
      }
```

#### slot: adapter

```js
adapter: pluginManager.pluggableConfigSchemaType('adapter')
```

#### slot: textSearching.indexedAttributes

```js
indexingAttributes: {
          type: 'stringArray',
          description:
            'list of which feature attributes to index for text searching',
          defaultValue: ['Name', 'ID'],
        }
```

#### slot: textSearching.indexingFeatureTypesToExclude

```js
indexingFeatureTypesToExclude: {
          type: 'stringArray',
          description: 'list of feature types to exclude in text search index',
          defaultValue: ['CDS', 'exon'],
        }
```

#### slot: textSearching.textSearchAdapter

```js
textSearchAdapter: pluginManager.pluggableConfigSchemaType(
  'text search adapter',
)
```

#### slot: displays

The track's displays. You can give this two ways:

- an **object** of appearance settings, e.g. `displays: { color: 'green' }`.
  JBrowse applies each setting to the display that uses it, so you don't need to
  know the display's name or write the array. If a track can be shown more than
  one way, each setting lands where it fits (for example `color` on a variant
  track's linear view, `strokeColor` on its circular view). A setting that
  nothing on the track uses is ignored, with a console warning so typos show up.
- an **array** of full display configs, e.g.
  `displays: [{ type: 'LinearBasicDisplay', color: 'green' }]`, when you need
  exact control — your own `displayId`, different settings for two displays, or
  choosing which display is the default.

See the [track config guide](/docs/config_guides/tracks/#configuring-displays).

```js
displays: types.array(pluginManager.pluggableConfigSchemaType('display'))
```

#### slot: formatDetails.feature

```js
feature: {
          type: 'frozen',
          description: 'adds extra fields to the feature details',
          defaultValue: {},
          contextVariable: ['feature'],
        }
```

#### slot: formatDetails.subfeatures

```js
subfeatures: {
          type: 'frozen',
          description: 'adds extra fields to the subfeatures of a feature',
          defaultValue: {},
          contextVariable: ['feature'],
        }
```

#### slot: formatDetails.depth

```js
depth: {
          type: 'number',
          defaultValue: 2,
          description:
            'depth of subfeatures to iterate the formatter on formatDetails.subfeatures (e.g. you may not want to format the exon/cds subfeatures, so limited to 2',
        }
```

#### slot: formatDetails.maxDepth

```js
maxDepth: {
          type: 'number',
          defaultValue: 99999,
          description: 'Maximum depth to render subfeatures',
        }
```

#### slot: formatAbout.config

```js
config: {
          type: 'frozen',
          description: 'formats configuration object in about dialog',
          defaultValue: {},
          contextVariable: ['config'],
        }
```

#### slot: formatAbout.hideUris

```js
hideUris: {
          type: 'boolean',
          defaultValue: false,
        }
```

### VariantTrack - Derives from

- [BaseTrack](../basetrack)

```js
baseConfiguration: createBaseTrackConfig(pluginManager)
```
