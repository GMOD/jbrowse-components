---
id: externaltokeninternetaccount
title: ExternalTokenInternetAccount
sidebar_label: Internet Account -> ExternalTokenInternetAccount
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/ExternalTokenModel/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/ExternalTokenInternetAccount.md)

## Overview

### ExternalTokenInternetAccount - State model

This config's runtime API is documented on its
[state model page](../../models/externaltokeninternetaccount).

<details open>
<summary>ExternalTokenInternetAccount - Slots</summary>

#### slot: validateWithHEAD

validate the token with a HEAD request before using it

**Type:** `boolean` · **Default:** `true`

```js
{
  description: 'validate the token with a HEAD request before using it',
  type: 'boolean',
  defaultValue: true,
}
```

</details>

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained.

<details open>
<summary>Inherited from BaseInternetAccount</summary>

[BaseInternetAccount config →](../baseinternetaccount)

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

### ExternalTokenInternetAccount - Derives from

- [BaseInternetAccount](../baseinternetaccount)

```js
baseConfiguration: BaseInternetAccountConfig
```
