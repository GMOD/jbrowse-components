---
id: jbrowse1textsearchadapter
title: JBrowse1TextSearchAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/legacy-jbrowse/src/JBrowse1TextSearchAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/legacy-jbrowse/src/JBrowse1TextSearchAdapter/configSchema.ts)

note: metadata about tracks and assemblies covered by text search adapter

### JBrowse1TextSearchAdapter - Identifier

#### slot: explicitIdentifier

### JBrowse1TextSearchAdapter - Slots

#### slot: assemblyNames

```js
assemblyNames: {
      defaultValue: [],
      description: 'List of assemblies covered by text search adapter',
      type: 'stringArray',
    }
```

#### slot: namesIndexLocation

```js
namesIndexLocation: {
      defaultValue: { locationType: 'UriLocation', uri: '/volvox/names' },
      description: 'the location of the JBrowse1 names index data directory',
      type: 'fileLocation',
    }
```

#### slot: tracks

```js
tracks: {
      defaultValue: [],
      description: 'List of tracks covered by text search adapter',
      type: 'stringArray',
    }
```
