---
id: jbrowse1connection
title: JBrowse1Connection
sidebar_label: Connection -> JBrowse1Connection
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/legacy-jbrowse/src/JBrowse1Connection/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/JBrowse1Connection.md)

## Overview

### JBrowse1Connection - State model

This config's runtime API is documented on its
[state model page](../../models/jbrowse1connection).

<details open>
<summary>JBrowse1Connection - Slots</summary>

#### slot: dataDirLocation

the location of the JBrowse 1 data directory, often something like
https://mysite.com/jbrowse/data/

**Type:** `fileLocation`

```js
{
  type: 'fileLocation',
  defaultValue: {
    uri: 'https://mysite.com/jbrowse/data/',
    locationType: 'UriLocation',
  },
  description:
    'the location of the JBrowse 1 data directory, often something like https://mysite.com/jbrowse/data/',
}
```

#### slot: assemblyNames

name of the assembly the connection belongs to, should be a single entry

**Type:** `stringArray`

```js
{
  description:
    'name of the assembly the connection belongs to, should be a single entry',
  type: 'stringArray',
  defaultValue: [],
}
```

</details>

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained.

<details open>
<summary>Inherited from BaseConnection</summary>

[BaseConnection config →](../baseconnection)

#### slot: name

a unique name for this connection

**Type:** `string` · **Default:** `'nameOfConnection'`

```js
{
  type: 'string',
  defaultValue: 'nameOfConnection',
  description: 'a unique name for this connection',
}
```

#### slot: assemblyNames

optional list of names of assemblies in this connection

**Type:** `stringArray`

```js
{
  type: 'stringArray',
  defaultValue: [],
  description: 'optional list of names of assemblies in this connection',
}
```

</details>

### JBrowse1Connection - Derives from

- [BaseConnection](../baseconnection)

```js
baseConfiguration: baseConnectionConfig
```
