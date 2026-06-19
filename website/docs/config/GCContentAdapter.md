---
id: gccontentadapter
title: GCContentAdapter
sidebar_label: Adapter -> GCContentAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gccontent/src/GCContentAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/GCContentAdapter.md)

## Overview

<details open>
<summary>GCContentAdapter - Slots</summary>

#### slot: sequenceAdapter

```js
{
  type: 'frozen',
  defaultValue: null,
}
```

#### slot: windowSize

```js
{
  type: 'number',
  defaultValue: 100,
  advanced: true,
}
```

#### slot: windowDelta

```js
{
  type: 'number',
  defaultValue: 100,
  advanced: true,
}
```

#### slot: gcMode

```js
{
  type: 'stringEnum',
  model: types.enumeration('gcMode', ['content', 'skew']),
  defaultValue: 'content',
  description: 'calculate GC content fraction or GC skew (G-C)/(G+C)',
}
```

</details>
