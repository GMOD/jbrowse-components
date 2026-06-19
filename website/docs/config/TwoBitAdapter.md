---
id: twobitadapter
title: TwoBitAdapter
sidebar_label: Adapter -> TwoBitAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/TwoBitAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/TwoBitAdapter.md)

## Example usage

A `.2bit` file is self-contained; add `chromSizes` to skip an initial full-file
scan on genomes with many contigs:

```js
{
  type: 'TwoBitAdapter',
  uri: 'https://example.com/genome.2bit',
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

### TwoBitAdapter - Pre-processor / simplified config

preprocessor to allow minimal config (note that adding chromSizes improves
speed, otherwise has to read a lot of the twobit file to calculate chromosome
names and sizes):

```json
{
  "type": "TwoBitAdapter",
  "uri": "yourfile.2bit"
  "chromSizes":"yourfile.chrom.sizes"
}

```

<details open>
<summary>TwoBitAdapter - Slots</summary>

#### slot: twoBitLocation

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/my.2bit',
    locationType: 'UriLocation',
  },
}
```

#### slot: chromSizesLocation

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/default.chrom.sizes',
    locationType: 'UriLocation',
  },
  description:
    'An optional chrom.sizes file can be supplied to speed up loading since parsing the twobit file can take time',
}
```

</details>
