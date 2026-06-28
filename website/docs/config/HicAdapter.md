---
id: hicadapter
title: HicAdapter
sidebar_label: Adapter -> HicAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/HicAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/HicAdapter.md)

## Example usage

```js
{
  type: 'HicTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'HicAdapter',
    uri: 'https://example.com/map.hic',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

used to load Hi-C contact matrix data from a `.hic` file

### Used in

This adapter supplies data to the [HicTrack](../hictrack) track type.

### HicAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "HicAdapter",
  "uri": "file.hic"
}
```

<details open>
<summary>HicAdapter - Slots</summary>

#### slot: hicLocation

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/my.hic',
    locationType: 'UriLocation',
  },
}
```

</details>
