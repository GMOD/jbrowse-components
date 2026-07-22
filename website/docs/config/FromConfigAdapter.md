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

_See the **Config slots** section below for all available configuration fields._

supplies features inline in the config instead of reading a file, useful for
small feature sets added via a URL or session spec

## Related links

- **Track:** [FeatureTrack](../featuretrack)
- **Display:** [LinearScoreDisplay](../linearscoredisplay)
- **Display:** [LinearArcDisplay](../lineararcdisplay)
- **Display:** [LinearBasicDisplay](../linearbasicdisplay)
- **Display:** [LinearMultiRowFeatureDisplay](../linearmultirowfeaturedisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                         | Type     | Description                                                                                             |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| [adapterId](#slot-adapterid) | `string` | stable identifier used as the adapter cache key; avoids hashing the (potentially large) features array. |
| [features](#slot-features)   | `frozen` |                                                                                                         |

<details>
<summary>FromConfigAdapter - Slots</summary>

#### slot: adapterId

stable identifier used as the adapter cache key; avoids hashing the (potentially
large) features array. optional — falls back to hash.

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: features

**Type:** [`frozen`](/docs/config_guides/slot_types#frozen) · **Default:** `[]`

</details>
