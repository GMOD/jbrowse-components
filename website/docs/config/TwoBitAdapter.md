---
id: twobitadapter
title: TwoBitAdapter
toplevel: true
---

Note: this document is automatically generated from configuration objects in
our source code. See [Understanding the configuration
model](/docs/devguide_config/) and [Config guide](/docs/config_guide) for more
info

### TwoBitAdapter - Slots

#### slot: twoBitLocation

```js
twoBitLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.2bit', locationType: 'UriLocation' },
    }
```

#### slot: chromSizesLocation

```js
chromSizesLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/default.chrom.sizes',
        locationType: 'UriLocation',
      },
      description:
        'An optional chrom.sizes file can be supplied to speed up loading since parsing the twobit file can take time',
    }
```
