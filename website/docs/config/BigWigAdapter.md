---
id: bigwigadapter
title: BigWigAdapter
sidebar_label: Adapter -> BigWigAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/BigWigAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/BigWigAdapter.md)

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

This adapter supplies data to the [QuantitativeTrack](../quantitativetrack)
track type.

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

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/my.bw',
    locationType: 'UriLocation',
  },
}
```

#### slot: source

added as feature.get('source') on all features

**Type:** `string` · **Default:** `''`

```js
{
  type: 'string',
  defaultValue: '',
  description:
    'Label added to all features; used as the subtrack/row name when this adapter is a subadapter of a multi-wiggle track',
}
```

#### slot: resolutionMultiplier

Resolution multiplier applied to every fetch: <1 fetches more points (higher
resolution), >1 fetches fewer (e.g. 2 = half as many points)

**Type:** `number` · **Default:** `1`

```js
{
  type: 'number',
  defaultValue: 1,
  description:
    'Resolution multiplier applied to every fetch: <1 fetches more points (higher resolution), >1 fetches fewer (e.g. 2 = half as many points)',
  advanced: true,
}
```

</details>
