---
id: mcscansimpleanchorsadapter
title: MCScanSimpleAnchorsAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/comparative-adapters/src/MCScanSimpleAnchorsAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/MCScanSimpleAnchorsAdapter/configSchema.ts)

### MCScanSimpleAnchorsAdapter - Slots

#### slot: mcscanSimpleAnchorsLocation

```js
mcscanSimpleAnchorsLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/mcscan.anchors.simple',
        locationType: 'UriLocation',
      },
    }
```

#### slot: bed1Location

```js
bed1Location: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/file.bed',
        locationType: 'UriLocation',
      },
    }
```

#### slot: bed2Location

```js
bed2Location: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/file.bed',
        locationType: 'UriLocation',
      },
    }
```

#### slot: assemblyNames

```js
assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
    }
```
