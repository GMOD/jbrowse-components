---
title: Config model basics
description: Config slot types, defaults, and how configuration schemas work
guide_category: Core concepts
---

The configuration model structures the data and features available in a JBrowse
session. Each pluggable element you create needs its own configuration schema.

## Configuration slot types

The configuration system is typed to support graphical editing. Each
configuration schema has a list of slots, each with a name, description, type,
and value. For the canonical list of slot types and their JS types see the
[configuration schema](/docs/developer_guides/configuration_schema#slot-types)
guide; below is how each type renders in the graphical config editor:

- `stringEnum` - one of a limited set of entries, becomes a dropdown box in the
  GUI
- `color` - select a color, becomes a color picker in the GUI
- `number` - enter any numeric value
- `string` - enter any string
- `integer` - enter an integer value
- `boolean` - a checkbox
- `frozen` - arbitrary JSON, becomes a textarea in the GUI
- `fileLocation` - refers to a URL, local file path on desktop, or file blob
  object in the browser
- `text` - enter a string, becomes a textarea in the GUI
- `stringArray` - enter a list of strings, becomes a "todolist" style editor in
  the GUI where you can add or delete things
- `stringArrayMap` - enter a list of key-value entries
- `numberMap` - enter a list of key-value entries where values are numbers

Let's examine the `LinearCanvasBaseDisplay` configuration as an example.

## Example config with multiple slot types

This `LinearCanvasBaseDisplay` config (abbreviated) contains an example of
several different slot types:

```js
// plugins/canvas/src/LinearBasicDisplay/baseConfigSchema.ts

import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

export default function baseConfigSchemaFactory(pluginManager) {
  return ConfigurationSchema(
    'LinearCanvasBaseDisplay',
    {
      color: {
        type: 'color',
        description: 'the main fill color of each feature',
        defaultValue: 'goldenrod',
        contextVariable: ['feature'],
      },
      displayMode: {
        type: 'stringEnum',
        model: types.enumeration('displayMode', [
          'normal',
          'compact',
          'collapse',
        ]),
        description: 'Alternative display modes',
        defaultValue: 'normal',
      },
      featureHeight: {
        type: 'number',
        description: 'height in pixels of the main body of each feature',
        defaultValue: 10,
      },
      showDescriptions: {
        type: 'boolean',
        description: 'show feature descriptions',
        defaultValue: true,
      },
    },
    {
      // inherit the base display slots (see configuration_schema.md)
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}
```

## Accessing config values

Config values are read through helper functions rather than direct property
access, so that default-value resolution and jexl callbacks are applied. Instead
of accessing `config.displayMode` directly, use `readConfObject`:

```js
readConfObject(config, 'displayMode')
```

You might also see `getConf` used on a state model that has a `.configuration`
member:

```js
getConf(track, 'featureHeight')
```

which is equivalent to:

```js
readConfObject(track.configuration, 'featureHeight')
```

See the [configuration API reference](/docs/api/core-configuration) for the full
signatures, and
[configuration schema](/docs/developer_guides/configuration_schema#reading-config-values)
for when to use each.

## Using config callbacks

Any config slot can be a callback. The `contextVariable` field lists what
arguments the callback expects — these must be provided by the calling code. To
pass arguments:

```js
readConfObject(config, 'color', { feature })
```

## Example of a config callback

We use Jexl to express callbacks. See https://github.com/TomFrost/Jexl for more
details.

There are also more examples and information in our
[config guide](/docs/config_guides/jexl).

If you had a variant track in your config, and wanted to make a custom config
callback for color, it might look like this:

```json
{
  "type": "VariantTrack",
  "trackId": "variant_colors",
  "name": "volvox filtered vcf (green snp, purple indel)",
  "category": ["VCF"],
  "assemblyNames": ["volvox"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "vcfGzLocation": {
      "uri": "volvox.filtered.vcf.gz",
      "locationType": "UriLocation"
    },
    "index": {
      "location": {
        "uri": "volvox.filtered.vcf.gz.tbi",
        "locationType": "UriLocation"
      }
    }
  },
  "displays": [
    {
      "type": "LinearVariantDisplay",
      "displayId": "volvox_filtered_vcf_color-LinearVariantDisplay",
      "color": "jexl:get(feature,'type')=='SNV'?'green':'purple'"
    }
  ]
}
```

This draws all SNV (single nucleotide variants) as green, and other types as
purple (insertion, deletion, other structural variant).

You can also
[write your own jexl function](/docs/developer_guides/pluggable_elements) and
call it in the same way in the configuration.

:::info

Custom jexl functions can be used as default slot values in your pluggable
elements — any slot with a `contextVariable` (such as the `color` slot in the
[example above](#example-config-with-multiple-slot-types)) can take a jexl
callback as its default.

:::

## Configuration internals

A configuration is a type of @jbrowse/mobx-state-tree model, in which leaf nodes
are ConfigSlot types, and other nodes are ConfigurationSchema types.

```
       Schema
    /     |     \
   Slot  Schema  Slot
         |    \
         Slot  Slot
```

Configurations are all descendants of a single root configuration, which is
`root.configuration`.

Configuration types should always be created by the `ConfigurationSchema`
factory, e.g.:

```js
import { ConfigurationSchema } from '@jbrowse/core/configuration'
const ThingStateModel = types.model('MyThingsState', {
  foo: 42,
  configuration: ConfigurationSchema('MyThing', {
    backgroundColor: {
      defaultValue: 'white',
      type: 'string',
    },
  }),
})
```

An example of a config schema with a sub-config schema is the `BamAdapter`, with
the index sub-config schema:

```js
ConfigurationSchema(
  'BamAdapter',
  {
    bamLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bam', locationType: 'UriLocation' },
    },
    // this is a sub-config schema
    index: ConfigurationSchema('BamIndex', {
      indexType: {
        model: types.enumeration('IndexType', ['BAI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'BAI',
      },
      location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.bam.bai',
          locationType: 'UriLocation',
        },
      },
    }),
  },
  { explicitlyTyped: true },
)
```

Reading the sub-config schema is as follows

```js
const indexType = readConfObject(config, ['index', 'indexType'])
```

Note: avoid accessing properties directly on the result of `readConfObject`
(e.g. `readConfObject(config, ['index']).indexType`) as this bypasses the
default value resolution logic.

## See also

- [Configuration schema](/docs/developer_guides/configuration_schema) — slot
  type reference, inheritance, `preProcessSnapshot`, `ConfigurationReference`
- [Configuration API reference](/docs/api/core-configuration) — `getConf` /
  `readConfObject` signatures
- [jexl config callbacks](/docs/config_guides/jexl)
