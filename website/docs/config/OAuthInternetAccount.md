---
id: oauthinternetaccount
title: OAuthInternetAccount
sidebar_label: Internet Account -> OAuthInternetAccount
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`authentication` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/OAuthModel/configSchema.ts).

## Overview

### OAuthInternetAccount - State model

This config's runtime API is documented on its
[state model page](../../models/oauthinternetaccount).

<details open>
<summary>OAuthInternetAccount - Slots</summary>

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

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained.

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

### OAuthInternetAccount - Derives from

- [BaseInternetAccount](../baseinternetaccount)
