---
id: fromconfigadapter
title: FromConfigAdapter
sidebar_label: Adapter -> FromConfigAdapter
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/config/src/FromConfigAdapter/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/FromConfigAdapter.md)

## Overview

### FromConfigAdapter - Slots

#### slot: adapterId

stable identifier used as the adapter cache key; avoids hashing the (potentially
large) features array. optional — falls back to hash.

```js
{
  type: 'string',
  defaultValue: '',
}
```

#### slot: features

```js
{
  type: 'frozen',
  defaultValue: [],
}
```
