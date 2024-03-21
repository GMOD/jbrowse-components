---
id: mcscansimpleanchorsadapter
title: MCScanSimpleAnchorsAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/comparative-adapters/src/MCScanSimpleAnchorsAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/MCScanSimpleAnchorsAdapter/configSchema.ts)

### MCScanSimpleAnchorsAdapter - Slots

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

#### slot: mcscanSimpleAnchorsLocation

```js
mcscanSimpleAnchorsLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/mcscan.anchors.simple',
      },
      type: 'fileLocation',
    }
```
