---
id: htsgetbamadapter
title: HtsgetBamAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/alignments/src/HtsgetBamAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/HtsgetBamAdapter/configSchema.ts)

Used to fetch data from Htsget endpoints in BAM format, using the gmod/bam
library

### HtsgetBamAdapter - Slots

#### slot: htsgetBase

```js
htsgetBase: {
      type: 'string',
      description: 'the base URL to fetch from',
      defaultValue: '',
    }
```

#### slot: htsgetTrackId

```js
htsgetTrackId: {
      type: 'string',
      description: 'the trackId, which is appended to the base URL',
      defaultValue: '',
    }
```

#### slot: sequenceAdapter

```js
sequenceAdapter: {
      type: 'frozen',
      description:
        'sequence data adapter, used to calculate SNPs when BAM reads lacking MD tags',
      defaultValue: null,
    }
```
