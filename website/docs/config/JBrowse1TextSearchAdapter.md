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

#### slot: namesIndexLocation

```js
namesIndexLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/volvox/names', locationType: 'UriLocation' },
      description: 'the location of the JBrowse1 names index data directory',
    }
```

#### slot: tracks

```js
tracks: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of tracks covered by text search adapter',
    }
```

#### slot: assemblyNames

```js
assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of assemblies covered by text search adapter',
    }
```
