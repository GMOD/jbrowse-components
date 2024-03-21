---
id: trixtextsearchadapter
title: TrixTextSearchAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/trix/src/TrixTextSearchAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/trix/src/TrixTextSearchAdapter/configSchema.ts)

### TrixTextSearchAdapter - Identifier

#### slot: explicitIdentifier

### TrixTextSearchAdapter - Slots

#### slot: assemblyNames

```js
assemblyNames: {
      defaultValue: [],
      description: 'List of assemblies covered by text search adapter',
      type: 'stringArray',
    }
```

#### slot: ixFilePath

```js
ixFilePath: {
      defaultValue: { locationType: 'UriLocation', uri: 'out.ix' },
      description: 'the location of the trix ix file',
      type: 'fileLocation',
    }
```

#### slot: ixxFilePath

```js
ixxFilePath: {
      defaultValue: { locationType: 'UriLocation', uri: 'out.ixx' },
      description: 'the location of the trix ixx file',
      type: 'fileLocation',
    }
```

#### slot: metaFilePath

```js
metaFilePath: {
      defaultValue: { locationType: 'UriLocation', uri: 'meta.json' },
      description: 'the location of the metadata json file for the trix index',
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
