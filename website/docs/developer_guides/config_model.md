---
title: Configuration model basics
description: Config slot types, defaults, and how configuration schemas work
guide_category: Core concepts
---

The configuration model structures the data and features available in a JBrowse
session. Each pluggable element you create needs its own configuration schema.

### Configuration slot types

The configuration system is typed to support graphical editing. Each
configuration schema has a list of slots, each with a name, description, type,
and value.

Here is a mostly comprehensive list of config types:

- `stringEnum` - allows assigning one of a limited set of entries, becomes a
  dropdown box in the GUI
- `color` - allows selecting a color, becomes a color picker in the GUI
- `number` - allows entering any numeric value
- `string` - allows entering any string
- `integer` - allows entering a integer value
- `boolean` - allows a boolean value
- `frozen` - an arbitrary JSON can be specified in this config slot, becomes
  textarea in the GUI
- `fileLocation` - refers to a URL, local file path on desktop, or file blob
  object in the browser
- `text` - allows entering a string, becomes textarea in the GUI
- `stringArray` - allows entering a list of strings, becomes a "todolist" style
  editor in the GUI where you can add or delete things
- `stringArrayMap` - allows entering a list of key-value entries
- `numberMap` - allows entering a list of key-value entries where values are
  numbers

Let's examine the `LinearCanvasBaseDisplay` configuration as an example.

### Example config with multiple slot types

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
      color1: {
        type: 'color',
        description: 'the main color of each feature',
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

### Accessing config values

So instead of accessing `config.displayMode`, we say,

```js
readConfObject(config, 'displayMode')
```

You might also see in the code like this:

```js
getConf(track, 'featureHeight')
```

Which would be equivalent to calling,

```js
readConfObject(track.configuration, 'featureHeight')
```

### Using config callbacks

Any config slot can be a callback. The `contextVariable` field lists what
arguments the callback expects — these must be provided by the calling code. To
pass arguments:

```js
readConfObject(config, 'color', { feature })
```

### Example of a config callback

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
      "color1": "jexl:get(feature,'type')=='SNV'?'green':'purple'"
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
elements — any slot with a `contextVariable` (such as the `color1` slot in the
[example above](#example-config-with-multiple-slot-types)) can take a jexl
callback as its default.

:::

### Configuration internals

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
