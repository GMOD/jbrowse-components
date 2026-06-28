---
id: gff3adapter
title: Gff3Adapter
sidebar_label: Adapter -> Gff3Adapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gff3/src/Gff3Adapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/Gff3Adapter.md)

## Example usage

```js
{
  type: 'FeatureTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'Gff3Adapter',
    uri: 'https://example.com/genes.gff3',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

used to load plain-text GFF3 files. Loads the whole file into memory, so prefer
the Gff3TabixAdapter for large files.

### Used in

This adapter supplies data to the [FeatureTrack](../featuretrack) track type.

### Gff3Adapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "Gff3Adapter",
  "uri": "yourfile.gff3"
}
```

<details open>
<summary>Gff3Adapter - Slots</summary>

#### slot: gffLocation

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/my.gff',
    locationType: 'UriLocation',
  },
}
```

</details>
