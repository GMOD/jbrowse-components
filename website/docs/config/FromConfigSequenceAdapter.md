---
id: fromconfigsequenceadapter
title: FromConfigSequenceAdapter
sidebar_label: Adapter -> FromConfigSequenceAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `config`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/config/src/FromConfigSequenceAdapter/configSchema.ts).

## Example usage

Used as the adapter of an assembly's `sequence` (a `ReferenceSequenceTrack`):

```js
{
  type: 'ReferenceSequenceTrack',
  trackId: 'my_refseq',
  adapter: {
    type: 'FromConfigSequenceAdapter',
    features: [
      { uniqueId: 'ctgA', refName: 'ctgA', start: 0, end: 10, seq: 'ATGCATGCAT' },
    ],
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

supplies reference sequence inline in the config; each feature's `seq` holds the
bases for its region

<details open>
<summary>FromConfigSequenceAdapter - Slots</summary>

#### slot: adapterId

**Type:** `string` · **Default:** `''`

#### slot: features

**Type:** `frozen` · **Default:** `[]`

</details>
