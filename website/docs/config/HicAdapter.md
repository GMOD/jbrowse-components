---
id: hicadapter
title: HicAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/hic/src/HicAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/HicAdapter/configSchema.ts)

### HicAdapter - Slots

#### slot: hicLocation

```js
hicLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.hic',
        locationType: 'UriLocation',
      },
    }
```

#### slot: resolutionMultiplier

```js
resolutionMultiplier: {
      type: 'number',
      defaultValue: 1,
      description: 'Initial resolution multiplier',
    }
```
