---
id: sequencesearchadapter
title: SequenceSearchAdapter
sidebar_label: Adapter -> SequenceSearchAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/SequenceSearchAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/SequenceSearchAdapter.md)

## Overview

<details open>
<summary>SequenceSearchAdapter - Slots</summary>

#### slot: search

Search string or regex to search for

**Type:** `string` · **Default:** `''`

```js
{
  type: 'string',
  defaultValue: '',
  description: 'Search string or regex to search for',
}
```

#### slot: sequenceAdapter

**Type:** `frozen`

```js
{
  type: 'frozen',
  defaultValue: null,
}
```

#### slot: searchForward

**Type:** `boolean` · **Default:** `true`

```js
{
  type: 'boolean',
  defaultValue: true,
}
```

#### slot: searchReverse

**Type:** `boolean` · **Default:** `true`

```js
{
  type: 'boolean',
  defaultValue: true,
}
```

#### slot: caseInsensitive

**Type:** `boolean` · **Default:** `true`

```js
{
  type: 'boolean',
  defaultValue: true,
}
```

</details>
