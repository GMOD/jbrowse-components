---
id: mcscananchorsadapter
title: MCScanAnchorsAdapter
sidebar_label: Adapter -> MCScanAnchorsAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/comparative-adapters/src/MCScanAnchorsAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/MCScanAnchorsAdapter.md)

## Overview

### MCScanAnchorsAdapter - Pre-processor / simplified config

preprocessor to allow minimal config:

```json
{
  "type": "MCScanAnchorsAdapter",
  "uri": "file.anchors",
  "bed1": "bed1.bed",
  "bed2": "bed2.bed",
  "assemblyNames": ["hg19", "hg38"]
}
```

<details open>
<summary>MCScanAnchorsAdapter - Slots</summary>

#### slot: mcscanAnchorsLocation

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/mcscan.anchors',
    locationType: 'UriLocation',
  },
}
```

#### slot: bed1Location

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/file.bed',
    locationType: 'UriLocation',
  },
}
```

#### slot: bed2Location

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: '/path/to/file.bed',
    locationType: 'UriLocation',
  },
}
```

#### slot: assemblyNames

```js
{
  type: 'stringArray',
  defaultValue: [],
}
```

</details>
