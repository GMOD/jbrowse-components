---
id: chromsizesadapter
title: ChromSizesAdapter
sidebar_label: Adapter -> ChromSizesAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/ChromSizesAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/ChromSizesAdapter.md)

## Example usage

```js
{
  type: 'ReferenceSequenceTrack',
  trackId: 'my_assembly-ReferenceSequenceTrack',
  adapter: {
    type: 'ChromSizesAdapter',
    uri: 'https://example.com/species.chrom.sizes',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

loads only chromosome names and lengths from a UCSC-style `.chrom.sizes` file
(tab-separated `name<TAB>length`), with no actual sequence. Useful for karyotype
or whole-genome/synteny views where the base-level sequence isn't needed.

### Used in

This adapter supplies data to the
[ReferenceSequenceTrack](../referencesequencetrack) track type.

### ChromSizesAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "ChromSizesAdapter",
  "uri": "yourfile.chrom.sizes"
}
```

<details open>
<summary>ChromSizesAdapter - Slots</summary>

#### slot: chromSizesLocation

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/species.chrom.sizes',
    locationType: 'UriLocation',
  },
}
```

</details>
