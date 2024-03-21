---
id: twobitadapter
title: TwoBitAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/sequence/src/TwoBitAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/TwoBitAdapter/configSchema.ts)

### TwoBitAdapter - Slots

#### slot: chromSizesLocation

```js
chromSizesLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/default.chrom.sizes',
      },
      description:
        'An optional chrom.sizes file can be supplied to speed up loading since parsing the twobit file can take time',
      type: 'fileLocation',
    }
```

#### slot: twoBitLocation

```js
twoBitLocation: {
      defaultValue: { locationType: 'UriLocation', uri: '/path/to/my.2bit' },
      type: 'fileLocation',
    }
```
