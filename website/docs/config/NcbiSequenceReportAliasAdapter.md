---
id: ncbisequencereportaliasadapter
title: NcbiSequenceReportAliasAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/config/src/NcbiSequenceReportAliasAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/NcbiSequenceReportAliasAdapter.md)

## Docs

can read "sequence_report.tsv" type files from NCBI

### NcbiSequenceReportAliasAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "NcbiSequenceReportAliasAdapter",
  "uri": "sequence_report.tsv"
}
```

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

#### slot: useNameOverride

```js
useNameOverride: {
      type: 'boolean',
      defaultValue: true,
      description:
        'forces usage of the UCSC names over the NCBI style names from a FASTA',
    }
```
