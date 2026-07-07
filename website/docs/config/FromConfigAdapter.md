---
id: fromconfigadapter
title: FromConfigAdapter
sidebar_label: Adapter -> FromConfigAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `config`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/config/src/FromConfigAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'FeatureTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'FromConfigAdapter',
    features: [
      { uniqueId: 'f1', refName: 'ctgA', start: 100, end: 200, name: 'feature1' },
    ],
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

supplies features inline in the config instead of reading a file, useful for
small feature sets added via a URL or session spec

| Slot                         | Type     | Description                                                                                                                            |
| ---------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| [adapterId](#slot-adapterid) | `string` | stable identifier used as the adapter cache key; avoids hashing the (potentially large) features array. optional — falls back to hash. |
| [features](#slot-features)   | `frozen` |                                                                                                                                        |

<details>
<summary>FromConfigAdapter - Slots</summary>

#### slot: adapterId

stable identifier used as the adapter cache key; avoids hashing the (potentially
large) features array. optional — falls back to hash.

**Type:** `string` · **Default:** `''`

#### slot: features

**Type:** `frozen` · **Default:** `[]`

</details>
