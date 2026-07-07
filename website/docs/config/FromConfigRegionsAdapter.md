---
id: fromconfigregionsadapter
title: FromConfigRegionsAdapter
sidebar_label: Adapter -> FromConfigRegionsAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `config`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/config/src/FromConfigRegionsAdapter/configSchema.ts).

## Example usage

Supplies refNames+sizes with no sequence, as the adapter of an assembly's
`sequence` (a `ReferenceSequenceTrack`):

```js
{
  type: 'ReferenceSequenceTrack',
  trackId: 'my_refseq',
  adapter: {
    type: 'FromConfigRegionsAdapter',
    features: [
      { uniqueId: 'ctgA', refName: 'ctgA', start: 0, end: 50000 },
      { uniqueId: 'ctgB', refName: 'ctgB', start: 0, end: 6079 },
    ],
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

used for specifying refNames+sizes of an assembly

| Slot                         | Type     | Description |
| ---------------------------- | -------- | ----------- |
| [adapterId](#slot-adapterid) | `string` |             |
| [features](#slot-features)   | `frozen` |             |

<details>
<summary>FromConfigRegionsAdapter - Slots</summary>

#### slot: adapterId

**Type:** `string` · **Default:** `''`

#### slot: features

**Type:** `frozen` · **Default:** `[]`

</details>
