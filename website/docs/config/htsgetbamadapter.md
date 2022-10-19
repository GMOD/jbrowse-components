---
id: htsgetbamadapter
title: HtsgetBamAdapter
toplevel: true
---
Used to fetch data from Htsget endpoints in BAM format, using the gmod/bam library
#### slot: htsgetBase
```js

      /**
       * !slot
       */
      htsgetBase: {
        type: 'string',
        description: 'the base URL to fetch from',
        defaultValue: '',
      }
```
#### slot: htsgetTrackId
```js

      /**
       * !slot
       */
      htsgetTrackId: {
        type: 'string',
        description: 'the trackId, which is appended to the base URL',
        defaultValue: '',
      }
```
#### slot: sequenceAdapter
```js

      /**
       * !slot
       */
      sequenceAdapter: {
        type: 'frozen',
        description:
          'sequence data adapter, used to calculate SNPs when BAM reads lacking MD tags',
        defaultValue: null,
      }
```
