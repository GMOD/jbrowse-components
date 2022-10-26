---
id: mcscananchorsadapter
title: MCScanAnchorsAdapter
toplevel: true
---

Note: this document is automatically generated from configuration objects in
our source code. See [Understanding the configuration
model](/docs/devguide_config/) and [Config guide](/docs/config_guide) for more
info

### MCScanAnchorsAdapter - Slots

#### slot: mcscanAnchorsLocation

```js
mcscanAnchorsLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/mcscan.anchors',
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
