---
id: bigwigadapter
title: BigWigAdapter
sidebar_label: Adapter -> BigWigAdapter
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `wiggle`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/BigWigAdapter/configSchema.ts).

## Example usage

```js
{
  type: 'QuantitativeTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://example.com/coverage.bw',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

used to load BigWig quantitative signal files

### Used in

Supplies data to the [QuantitativeTrack](../quantitativetrack) track, rendered
by:

- [LinearWiggleDisplay](../linearwiggledisplay)

### BigWigAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "BigWigAdapter",
  "uri": "yourfile.bw"
}
```

<details open>
<summary>BigWigAdapter - Slots</summary>

#### slot: bigWigLocation

**Type:** `fileLocation` · **Default:**
`{ uri: '/path/to/my.bw', locationType: 'UriLocation' }`

#### slot: source

added as feature.get('source') on all features

**Type:** `string` · **Default:** `''`

#### slot: resolutionMultiplier

Resolution multiplier applied to every fetch: <1 fetches more points (higher
resolution), >1 fetches fewer (e.g. 2 = half as many points)

**Type:** `number` · **Default:** `1` · _advanced_

</details>
