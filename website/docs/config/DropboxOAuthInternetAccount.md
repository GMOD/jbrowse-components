---
id: dropboxoauthinternetaccount
title: DropboxOAuthInternetAccount
sidebar_label: Internet Account -> DropboxOAuthInternetAccount
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`authentication` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/DropboxOAuthModel/configSchema.ts).

## Overview

### DropboxOAuthInternetAccount - State model

This config's runtime API is documented on its
[state model page](../../models/dropboxoauthinternetaccount).

<details open>
<summary>DropboxOAuthInternetAccount - Slots</summary>

#### slot: authEndpoint

the authorization code endpoint of the internet account

**Type:** `string` · **Default:** `'https://www.dropbox.com/oauth2/authorize'`

#### slot: tokenEndpoint

the token endpoint of the internet account

**Type:** `string` · **Default:** `'https://api.dropbox.com/oauth2/token'`

#### slot: needsPKCE

boolean to indicate if the endpoint needs a PKCE code

**Type:** `boolean` · **Default:** `true`

#### slot: domains

array of valid domains the url can contain to use this account

**Type:** `stringArray`

```js
{
  description:
    'array of valid domains the url can contain to use this account',
  type: 'stringArray',
  defaultValue: [
    'addtodropbox.com',
    'db.tt',
    'dropbox.com',
    'dropboxapi.com',
    'dropboxbusiness.com',
    'dropbox.tech',
    'getdropbox.com',
  ],
}
```

</details>

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained.

<details open>
<summary>Inherited from OAuthInternetAccount</summary>

[OAuthInternetAccount config →](../oauthinternetaccount)

#### slot: tokenType

a custom name for a token to include in the header

**Type:** `string` · **Default:** `'Bearer'`

#### slot: authEndpoint

the authorization code endpoint of the internet account

**Type:** `string` · **Default:** `''`

#### slot: tokenEndpoint

the token endpoint of the internet account

**Type:** `string` · **Default:** `''`

#### slot: needsPKCE

boolean to indicate if the endpoint needs a PKCE code

**Type:** `boolean` · **Default:** `false`

#### slot: clientId

id for the OAuth application

**Type:** `string` · **Default:** `''`

#### slot: scopes

optional scopes for the authorization call

**Type:** `string` · **Default:** `''`

#### slot: state

optional state for the authorization call

**Type:** `string` · **Default:** `''`

#### slot: responseType

the type of response from the authorization endpoint. can be 'token' or 'code'

**Type:** `string` · **Default:** `'code'`

</details>

<details open>
<summary>Inherited from BaseInternetAccount</summary>

[BaseInternetAccount config →](../baseinternetaccount)

#### slot: name

descriptive name of the internet account

**Type:** `string` · **Default:** `''`

#### slot: description

a description of the internet account

**Type:** `string` · **Default:** `''`

#### slot: authHeader

request header for credentials

**Type:** `string` · **Default:** `'Authorization'`

#### slot: tokenType

a custom name for a token to include in the header

**Type:** `string` · **Default:** `''`

#### slot: domains

array of valid domains the url can contain to use this account

**Type:** `stringArray` · **Default:** `[]`

</details>

### DropboxOAuthInternetAccount - Derives from

- [OAuthInternetAccount](../oauthinternetaccount)
