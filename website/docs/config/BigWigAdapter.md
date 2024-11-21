---
id: bigwigadapter
title: BigWigAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/wiggle/src/BigWigAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/BigWigAdapter/configSchema.ts)

### BigWigAdapter - Slots

#### slot: bigWigLocation

```js
bigWigLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bw',
        locationType: 'UriLocation',
      },
    }
```

#### slot: source

```js
source: {
      type: 'string',
      defaultValue: '',
      description: 'Used for multiwiggle',
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
