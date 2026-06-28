---
id: trixtextsearchadapter
title: TrixTextSearchAdapter
sidebar_label: Adapter -> TrixTextSearchAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/trix/src/TrixTextSearchAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/TrixTextSearchAdapter.md)

## Overview

### TrixTextSearchAdapter - Pre-processor / simplified config

preprocessor to allow minimal config, assumes file.ixx also exists:

```json
{
  "type": "TrixTextSearchAdapter",
  "uri": "file.ix",
  "assemblyNames": ["hg19"],
  "textSearchAdapterId": "hg19SearchIndex"
}
```

### TrixTextSearchAdapter - Identifier

Every TrixTextSearchAdapter has a unique `textSearchAdapterId`, a required
top-level field that identifies it (not one of the config slots below).

<details open>
<summary>TrixTextSearchAdapter - Slots</summary>

#### slot: ixFilePath

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: 'out.ix',
    locationType: 'UriLocation',
  },
}
```

#### slot: ixxFilePath

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: 'out.ixx',
    locationType: 'UriLocation',
  },
}
```

#### slot: metaFilePath

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: 'meta.json',
    locationType: 'UriLocation',
  },
}
```

#### slot: tracks

List of tracks covered by text search adapter

**Type:** `stringArray`

```js
{
  type: 'stringArray',
  defaultValue: [],
  description: 'List of tracks covered by text search adapter',
}
```

#### slot: assemblyNames

List of assemblies covered by text search adapter

**Type:** `stringArray`

```js
{
  type: 'stringArray',
  defaultValue: [],
  description: 'List of assemblies covered by text search adapter',
}
```

</details>
