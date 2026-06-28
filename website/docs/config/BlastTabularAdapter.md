---
id: blasttabularadapter
title: BlastTabularAdapter
sidebar_label: Adapter -> BlastTabularAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/BlastTabularAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/BlastTabularAdapter.md)

## Overview

<details open>
<summary>BlastTabularAdapter - Slots</summary>

#### slot: assemblyNames

Query assembly is the first value in the array, target assembly is the second

**Type:** `stringArray`

```js
{
  type: 'stringArray',
  defaultValue: [],
  description:
    'Query assembly is the first value in the array, target assembly is the second',
}
```

#### slot: targetAssembly

Alternative to assemblyNames array: the target assembly

**Type:** `string` · **Default:** `''`

```js
{
  type: 'string',
  defaultValue: '',
  description: 'Alternative to assemblyNames array: the target assembly',
}
```

#### slot: queryAssembly

Alternative to assemblyNames array: the query assembly

**Type:** `string` · **Default:** `''`

```js
{
  type: 'string',
  defaultValue: '',
  description: 'Alternative to assemblyNames array: the query assembly',
}
```

#### slot: blastTableLocation

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/blastTable.tsv',
    locationType: 'UriLocation',
  },
}
```

#### slot: columns

Optional space-separated column name list. If custom columns were used in
outfmt, enter them here exactly as specified in the command. At least qseqid,
sseqid, qstart, qend, sstart, and send are required

**Type:** `string` · **Default:**
`'qseqid sseqid pident length mismatch gapopen qstart qend sstart send evalue bitscore'`

```js
{
  type: 'string',
  description:
    'Optional space-separated column name list. If custom columns were used in outfmt, enter them here exactly as specified in the command. At least qseqid, sseqid, qstart, qend, sstart, and send are required',
  defaultValue:
    'qseqid sseqid pident length mismatch gapopen qstart qend sstart send evalue bitscore',
}
```

</details>
