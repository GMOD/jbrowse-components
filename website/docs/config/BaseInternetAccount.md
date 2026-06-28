---
id: baseinternetaccount
title: BaseInternetAccount
sidebar_label: Internet Account -> BaseInternetAccount
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/baseInternetAccountConfig.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/BaseInternetAccount.md)

## Overview

the "base" internet account type

### BaseInternetAccount - Identifier

Every BaseInternetAccount has a unique `internetAccountId`, a required top-level
field that identifies it (not one of the config slots below).

<details open>
<summary>BaseInternetAccount - Slots</summary>

#### slot: name

descriptive name of the internet account

**Type:** `string` · **Default:** `''`

```js
{
  description: 'descriptive name of the internet account',
  type: 'string',
  defaultValue: '',
}
```

#### slot: description

a description of the internet account

**Type:** `string` · **Default:** `''`

```js
{
  description: 'a description of the internet account',
  type: 'string',
  defaultValue: '',
}
```

#### slot: authHeader

request header for credentials

**Type:** `string` · **Default:** `'Authorization'`

```js
{
  description: 'request header for credentials',
  type: 'string',
  defaultValue: 'Authorization',
}
```

#### slot: tokenType

a custom name for a token to include in the header

**Type:** `string` · **Default:** `''`

```js
{
  description: 'a custom name for a token to include in the header',
  type: 'string',
  defaultValue: '',
}
```

#### slot: domains

array of valid domains the url can contain to use this account

**Type:** `stringArray`

```js
{
  description:
    'array of valid domains the url can contain to use this account',
  type: 'stringArray',
  defaultValue: [],
}
```

</details>
