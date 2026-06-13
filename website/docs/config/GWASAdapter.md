---
id: gwasadapter
title: GWASAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gwas/src/GWASAdapter/index.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/GWASAdapter.md)

## Overview

adapter for GWAS results files; a BedTabixAdapter with `scoreColumn` defaulted
to `neg_log_pvalue` so files load with a sensible Manhattan plot score out of
the box

### GWASAdapter - Slots

#### slot: scoreColumn

```js
scoreColumn: {
          type: 'string',
          description: 'BED column to read as the Manhattan plot score',
          defaultValue: 'neg_log_pvalue',
        }
```

### GWASAdapter - Derives from

```js
baseConfiguration: res.configSchema
```
