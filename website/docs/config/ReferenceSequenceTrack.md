---
id: referencesequencetrack
title: ReferenceSequenceTrack
toplevel: true
---

Note: this document is automatically generated from configuration objects in
our source code. See [Understanding the configuration
model](/docs/devguide_config/) and [Config guide](/docs/config_guide) for more
info

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

#### slot: name

```js
name: {
        type: 'string',
        description:
          'optional track name, otherwise uses the "Reference sequence (assemblyName)"',
        defaultValue: '',
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

#### slot: formatAbout.config

```js
config: {
          type: 'frozen',
          description: 'formats configuration in about dialog',
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
