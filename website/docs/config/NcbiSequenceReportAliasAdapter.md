---
id: ncbisequencereportaliasadapter
title: NcbiSequenceReportAliasAdapter
sidebar_label: Adapter -> NcbiSequenceReportAliasAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `config`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/config/src/NcbiSequenceReportAliasAdapter/configSchema.ts).

## Overview

can read "sequence_report.tsv" type files from NCBI

### NcbiSequenceReportAliasAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "NcbiSequenceReportAliasAdapter",
  "uri": "sequence_report.tsv"
}
```

| Slot                                     | Type           | Description                                                           |
| ---------------------------------------- | -------------- | --------------------------------------------------------------------- |
| [location](#slot-location)               | `fileLocation` |                                                                       |
| [useNameOverride](#slot-usenameoverride) | `boolean`      | forces usage of the UCSC names over the NCBI style names from a FASTA |

<details>
<summary>NcbiSequenceReportAliasAdapter - Slots</summary>

#### slot: location

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my/sequence_report.tsv', locationType: 'UriLocation' }`

#### slot: useNameOverride

forces usage of the UCSC names over the NCBI style names from a FASTA

**Type:** `boolean` · **Default:** `true`

</details>
