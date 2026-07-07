---
id: blasttabularadapter
title: BlastTabularAdapter
sidebar_label: Adapter -> BlastTabularAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`comparative-adapters` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/BlastTabularAdapter/configSchema.ts).

## Overview

| Slot                                           | Type           | Description                                                                                                                                                                                                 |
| ---------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [assemblyNames](#slot-assemblynames)           | `stringArray`  | Query assembly is the first value in the array, target assembly is the second                                                                                                                               |
| [targetAssembly](#slot-targetassembly)         | `string`       | Alternative to assemblyNames array: the target assembly                                                                                                                                                     |
| [queryAssembly](#slot-queryassembly)           | `string`       | Alternative to assemblyNames array: the query assembly                                                                                                                                                      |
| [blastTableLocation](#slot-blasttablelocation) | `fileLocation` |                                                                                                                                                                                                             |
| [columns](#slot-columns)                       | `string`       | Optional space-separated column name list. If custom columns were used in outfmt, enter them here exactly as specified in the command. At least qseqid, sseqid, qstart, qend, sstart, and send are required |

<details>
<summary>BlastTabularAdapter - Slots</summary>

#### slot: assemblyNames

Query assembly is the first value in the array, target assembly is the second

**Type:** `stringArray` · **Default:** `[]`

#### slot: targetAssembly

Alternative to assemblyNames array: the target assembly

**Type:** `string` · **Default:** `''`

#### slot: queryAssembly

Alternative to assemblyNames array: the query assembly

**Type:** `string` · **Default:** `''`

#### slot: blastTableLocation

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/blastTable.tsv', locationType: 'UriLocation' }`

#### slot: columns

Optional space-separated column name list. If custom columns were used in
outfmt, enter them here exactly as specified in the command. At least qseqid,
sseqid, qstart, qend, sstart, and send are required

**Type:** `string` · **Default:**
`'qseqid sseqid pident length mismatch gapopen qstart qend sstart send evalue bitscore'`

</details>
