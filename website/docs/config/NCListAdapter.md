---
id: nclistadapter
title: NCListAdapter
toplevel: true
---

Note: this document is automatically generated from configuration objects in
our source code. See [Understanding the configuration
model](/docs/devguide_config/) and [Config guide](/docs/config_guide) for more
info

### NCListAdapter - Slots

#### slot: rootUrlTemplate

```js
rootUrlTemplate: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my/{refseq}/trackData.json',
        locationType: 'UriLocation',
      },
    }
```

#### slot: refNames

```js
refNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of refNames used by the NCList used for aliasing',
    }
```
