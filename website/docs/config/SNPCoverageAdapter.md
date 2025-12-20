---
id: snpcoverageadapter
title: SNPCoverageAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/SNPCoverageAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/SNPCoverageAdapter.md)

## Docs

### SNPCoverageAdapter - Slots

#### slot: subadapter

normally refers to a BAM or CRAM adapter

```js
subadapter: {
      type: 'frozen',
      defaultValue: null,
    }
```

#### slot: sequenceAdapter

sequence adapter for fetching reference sequences (needed by CRAM)

```js
sequenceAdapter: {
      type: 'frozen',
      defaultValue: null,
    }
```
