---
id: baseconnection
title: BaseConnection
sidebar_label: Connection -> BaseConnection
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/baseConnectionConfig.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/BaseConnection.md)

## Overview

### BaseConnection - Identifier

Every BaseConnection has a unique `connectionId`, a required top-level field
that identifies it (not one of the config slots below).

<details open>
<summary>BaseConnection - Slots</summary>

#### slot: name

```js
{
  type: 'string',
  defaultValue: 'nameOfConnection',
  description: 'a unique name for this connection',
}
```

#### slot: assemblyNames

```js
{
  type: 'stringArray',
  defaultValue: [],
  description: 'optional list of names of assemblies in this connection',
}
```

</details>
