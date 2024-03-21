---
id: mcscananchorsadapter
title: MCScanAnchorsAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/comparative-adapters/src/MCScanAnchorsAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/MCScanAnchorsAdapter/configSchema.ts)

### MCScanAnchorsAdapter - Slots

#### slot: assemblyNames

```js
assemblyNames: {
      defaultValue: [],
      type: 'stringArray',
    }
```

#### slot: bed1Location

```js
bed1Location: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/file.bed',
      },
      type: 'fileLocation',
    }
```

#### slot: bed2Location

```js
bed2Location: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/file.bed',
      },
      type: 'fileLocation',
    }
```

#### slot: mcscanAnchorsLocation

```js
mcscanAnchorsLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/mcscan.anchors',
      },
      type: 'fileLocation',
    }
```
