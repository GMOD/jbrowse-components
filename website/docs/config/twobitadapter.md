---
id: twobitadapter
title: TwoBitAdapter
toplevel: true
---

#### slot: twoBitLocation
```js

    /**
     * !slot
     */
    twoBitLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.2bit', locationType: 'UriLocation' },
    }
```
#### slot: chromSizesLocation
```js

    /**
     * !slot
     */
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
