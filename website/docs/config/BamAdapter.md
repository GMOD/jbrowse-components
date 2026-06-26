---
id: bamadapter
title: BamAdapter
sidebar_label: Adapter -> BamAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/BamAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/BamAdapter.md)

## Example usage

The `uri` shorthand auto-resolves the `.bai` index. For a `.csi` index or a
differently-named index, set `index` explicitly with the full slot form:

```js
{
  type: 'AlignmentsTrack',
  trackId: 'my_track',
  name: 'My track',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BamAdapter',
    uri: 'https://example.com/sample.bam',
  },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

used to configure BAM adapter

Note: `sequenceAdapter` does **not** need to be specified manually — JBrowse
automatically supplies it from the enclosing assembly's sequence track.

### BamAdapter - Pre-processor / simplified config

preprocessor to allow minimal config, assumes yourfile.bam.bai:

```json
{
  "type": "BamAdapter",
  "uri": "yourfile.bam"
}
```

<details open>
<summary>BamAdapter - Slots</summary>

#### slot: bamLocation

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/my.bam',
    locationType: 'UriLocation',
  },
}
```

#### slot: index.indexType

```js
{
  model: types.enumeration('IndexType', ['BAI', 'CSI']),
  type: 'stringEnum',
  defaultValue: 'BAI',
}
```

#### slot: index.location

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/my.bam.bai',
    locationType: 'UriLocation',
  },
}
```

#### slot: fetchSizeLimit

```js
{
  type: 'number',
  description:
    'size to fetch in bytes over which to display a warning to the user that too much data will be fetched',
  defaultValue: 5_000_000,
  advanced: true,
}
```

</details>
