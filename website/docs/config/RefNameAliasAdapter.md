---
id: refnamealiasadapter
title: RefNameAliasAdapter
sidebar_label: Adapter -> RefNameAliasAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `config`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/config/src/RefNameAliasAdapter/configSchema.ts).

## Overview

can read "chromAliases" type files from UCSC or any tab separated file of
refName aliases

### RefNameAliasAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "RefNameAliasAdapter",
  "uri": "yourfile.chromAlias.txt"
}
```

<details open>
<summary>RefNameAliasAdapter - Slots</summary>

#### slot: location

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my/aliases.txt', locationType: 'UriLocation' }`

#### slot: refNameColumn

by default, the "ref names that match the fasta" are assumed to be in the first
column (0), change this variable if needed

**Type:** `number` · **Default:** `0` · _advanced_

#### slot: refNameColumnHeaderName

refNameColumnHeaderName

**Type:** `string` · **Default:** `''` · _advanced_

</details>
