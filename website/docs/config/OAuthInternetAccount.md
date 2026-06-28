---
id: oauthinternetaccount
title: OAuthInternetAccount
sidebar_label: Internet Account -> OAuthInternetAccount
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/OAuthModel/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/OAuthInternetAccount.md)

## Overview

### OAuthInternetAccount - State model

This config's runtime API is documented on its
[state model page](../../models/oauthinternetaccount).

<details open>
<summary>OAuthInternetAccount - Slots</summary>

#### slot: tokenType

a custom name for a token to include in the header

**Type:** `string` · **Default:** `'Bearer'`

```js
{
  description: 'a custom name for a token to include in the header',
  type: 'string',
  defaultValue: 'Bearer',
}
```

#### slot: authEndpoint

the authorization code endpoint of the internet account

**Type:** `string` · **Default:** `''`

```js
{
  description: 'the authorization code endpoint of the internet account',
  type: 'string',
  defaultValue: '',
}
```

#### slot: tokenEndpoint

the token endpoint of the internet account

**Type:** `string` · **Default:** `''`

```js
{
  description: 'the token endpoint of the internet account',
  type: 'string',
  defaultValue: '',
}
```

#### slot: needsPKCE

boolean to indicate if the endpoint needs a PKCE code

**Type:** `boolean` · **Default:** `false`

```js
{
  description: 'boolean to indicate if the endpoint needs a PKCE code',
  type: 'boolean',
  defaultValue: false,
}
```

#### slot: clientId

id for the OAuth application

**Type:** `string` · **Default:** `''`

```js
{
  description: 'id for the OAuth application',
  type: 'string',
  defaultValue: '',
}
```

#### slot: scopes

optional scopes for the authorization call

**Type:** `string` · **Default:** `''`

```js
{
  description: 'optional scopes for the authorization call',
  type: 'string',
  defaultValue: '',
}
```

#### slot: state

optional state for the authorization call

**Type:** `string` · **Default:** `''`

```js
{
  description: 'optional state for the authorization call',
  type: 'string',
  defaultValue: '',
}
```

#### slot: responseType

the type of response from the authorization endpoint. can be 'token' or 'code'

**Type:** `string` · **Default:** `'code'`

```js
{
  description:
    "the type of response from the authorization endpoint. can be 'token' or 'code'",
  type: 'string',
  defaultValue: 'code',
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

### OAuthInternetAccount - Derives from

- [BaseInternetAccount](../baseinternetaccount)

```js
baseConfiguration: BaseInternetAccountConfig
```
