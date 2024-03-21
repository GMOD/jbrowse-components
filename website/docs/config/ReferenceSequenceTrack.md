---
id: referencesequencetrack
title: ReferenceSequenceTrack
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/sequence/src/ReferenceSequenceTrack/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/ReferenceSequenceTrack/configSchema.ts)

used to display base level DNA sequence tracks

### ReferenceSequenceTrack - Identifier

#### slot: explicitIdentifier

### ReferenceSequenceTrack - Slots

#### slot: adapter

configuration for track adapter

```js
adapter: pluginManager.pluggableConfigSchemaType('adapter')
```

#### slot: displays

configuration for the displays e.g. LinearReferenceSequenceDisplay

```js
displays: types.array(pluginManager.pluggableConfigSchemaType('display'))
```

#### slot: formatAbout.config

```js
config: {
          contextVariable: ['config'],
          defaultValue: {},
          description: 'formats configuration in about dialog',
          type: 'frozen',
        }
```

#### slot: formatAbout.hideUris

```js
hideUris: {
          defaultValue: false,
          type: 'boolean',
        }
```

#### slot: metadata

```js
metadata: {
        defaultValue: {},
        description: 'anything to add about this track',
        type: 'frozen',
      }
```

#### slot: name

```js
name: {
        defaultValue: '',
        description:
          'optional track name, otherwise uses the "Reference sequence (assemblyName)"',
        type: 'string',
      }
```
