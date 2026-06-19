---
id: bgzipfastaadapter
title: BgzipFastaAdapter
sidebar_label: Adapter -> BgzipFastaAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/BgzipFastaAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/BgzipFastaAdapter.md)

## Example usage

The `uri` shorthand auto-resolves the `.fai` and `.gzi` indexes:

```js
{
  type: 'BgzipFastaAdapter',
  uri: 'https://example.com/genome.fa.gz',
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

### BgzipFastaAdapter - Pre-processor / simplified config

preprocessor to allow minimal config, assumes yourfile.fa.fai and
yourfile.fa.gzi:

```json
{
  "type": "BgzipFastaAdapter",
  "uri": "yourfile.fa"
}
```

### BgzipFastaAdapter - Slots

#### slot: fastaLocation

```js
{
  type: 'fileLocation',
  defaultValue: { uri: '/path/to/seq.fa.gz', locationType: 'UriLocation' },
}
```

#### slot: faiLocation

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/seq.fa.gz.fai',
    locationType: 'UriLocation',
  },
}
```

#### slot: metadataLocation

```js
{
  description: 'Optional metadata file',
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/fa.metadata.yaml',
    locationType: 'UriLocation',
  },
}
```

#### slot: gziLocation

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/seq.fa.gz.gzi',
    locationType: 'UriLocation',
  },
}
```
