---
id: htsgetbamadapter
title: HtsgetBamAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/HtsgetBamAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/HtsgetBamAdapter.md)

## Docs

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
