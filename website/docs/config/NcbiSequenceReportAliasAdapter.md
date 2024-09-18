---
id: ncbisequencereportaliasadapter
title: NcbiSequenceReportAliasAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/config/src/NcbiSequenceReportAliasAdapter/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/config/src/NcbiSequenceReportAliasAdapter/configSchema.ts)

can read "sequence_report.tsv" type files from NCBI

### NcbiSequenceReportAliasAdapter - Slots

#### slot: location

```js
location: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my/sequence_report.tsv',
        locationType: 'UriLocation',
      },
    }
```
