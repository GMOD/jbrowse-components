---
id: developer_config_model
title: Configuration model concepts
---

### Configuration slot types

Our configuration system is "typed" unlike the jbrowse 1 system, which
faciliates GUI editing of the config in a more intelligent way. Here is a list
of configuration slot types that you assign to your given config entry

Here is a mostly comprehensive list of config types

- stringEnum - allows assigning one of a limited set of entries, becomes a
  dropdown box in the GUI
- color - allows selecting a color, becomes a color picker in the GUI
- number - allows entering any numeric value
- string - allows entering any string
- integer - allows entering a integer value
- boolean
- frozen - an arbitrary JSON can be specified in this config slot, becomes
  textarea in the GUI
- fileLocation - refers to a URL, local file path on desktop, or file blob
  object in the browser
- text - allows entering a string, becomes textarea in the GUI
- stringArray - allows entering a list of strings, becomes a "todolist" style
  editor in the GUI where you can add or delete things
- stringArrayMap - allows entering a list of key-value entries

Let's look at the pileup renderer config as an example of several types of
features

### Example config with multiple slot types

This PileupRenderer config contains an example of several different slot types

```js
import { types } from 'mobx-state-tree'
export default ConfigurationSchema('PileupRenderer', {
  color: {
    type: 'color',
    description: 'the color of each feature in a pileup alignment',
    defaultValue: `function(feature) {
        var s = feature.get('strand');
        return s === -1 ? '#8F8FD8': '#EC8B8B'
      }`,
    functionSignature: ['feature'],
  },
  displayMode: {
    type: 'stringEnum',
    model: types.enumeration('displayMode', ['normal', 'compact', 'collapse']),
    description: 'Alternative display modes',
    defaultValue: 'normal',
  },
  minSubfeatureWidth: {
    type: 'number',
    description: `the minimum width in px for a pileup mismatch feature. use for
        increasing mismatch marker widths when zoomed out to e.g. 1px or
        0.5px`,
    defaultValue: 0,
  },
  maxHeight: {
    type: 'integer',
    description: 'the maximum height to be used in a pileup rendering',
    defaultValue: 600,
  },
})
```

### Accessing config values

So instead of accessing `config.displayMode`, we say

```js
readConfObject(config, 'displayMode')
```

You might also see in the code like this

```js
getConf(track, 'maxHeight')
```

Which would be equivalent to calling

```js
readConfObject(track.configuration, 'maxHeight')`
```

### Using config callbacks

Config callbacks allow you to have a dynamic color based on some function logic
you provide. All config slots can actually become config callback. The
arguments that are given to the callback are listed by the 'functionSignature'
but must be provided by the calling code (the code reading the config slot). To
pass arguments to the a callback we say

```js
readConfObject(config, 'color', [feature])
```

That implies the color configuration callback will be passed a feature, so the
config callback can be a complex function determining the color to use based on
various feature attributes

### Example of a config callback

If you had an variant track in your config, and wanted to make a custom config
callback for color, it might look like this

```json
{
  "type": "VariantTrack",
  "trackId": "myvcf",
  "name": "My variants",
  "assemblyNames": ["h19"],
  "category": ["VCF"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "vcfGzLocation": {
      "uri": "test_data/volvox/volvox.filtered.vcf.gz"
    },
    "index": {
      "location": {
        "uri": "test_data/volvox/volvox.filtered.vcf.gz.tbi"
      }
    }
  },
  "renderers": {
    "SvgFeatureRenderer": {
      "type": "SvgFeatureRenderer",
      "color": "function(feat) { return feat.get('type')==='SNV'?'green':'purple' }"
    }
  }
}
```

This draws all SNV (single nucleotide variants) as green, and other types as
purple (insertion, deletion, other structural variant). Note that JSON format
doesn't allow fancy multiline

### Configuration internals

A configuration is a type of mobx-state-tree model, in which leaf nodes are
ConfigSlot types, and other nodes are ConfigurationSchema types.

```
       Schema
    /     |     \
   Slot  Schema  Slot
         |    \
         Slot  Slot
```

Configurations are all descendents of a single root configuration, which is
`root.configuration`.

Configuration types should always be created by the `ConfigurationSchema`
factory, e.g.

```js
import { ConfigurationSchema } from '@gmod/jbrowse-core/utils/configuration'
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

An example of a config schema with a sub-config schema is the BamAdapter, with
the index sub-config schema

```js
ConfigurationSchema(
  'BamAdapter',
  {
    bamLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bam' },
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
        defaultValue: { uri: '/path/to/my.bam.bai' },
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
