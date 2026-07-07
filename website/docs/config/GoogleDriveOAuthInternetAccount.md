---
id: googledriveoauthinternetaccount
title: GoogleDriveOAuthInternetAccount
sidebar_label: Internet Account -> GoogleDriveOAuthInternetAccount
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`authentication` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/GoogleDriveOAuthModel/configSchema.ts).

## Overview

| Slot                               | Type          | Description                                                    |
| ---------------------------------- | ------------- | -------------------------------------------------------------- |
| [authEndpoint](#slot-authendpoint) | `string`      | the authorization code endpoint of the internet account        |
| [scopes](#slot-scopes)             | `string`      | optional scopes for the authorization call                     |
| [domains](#slot-domains)           | `stringArray` | array of valid domains the url can contain to use this account |
| [responseType](#slot-responsetype) | `string`      | the type of response from the authorization endpoint           |

<details>
<summary>GoogleDriveOAuthInternetAccount - Slots</summary>

#### slot: authEndpoint

the authorization code endpoint of the internet account

**Type:** `string` · **Default:**
`'https://accounts.google.com/o/oauth2/v2/auth'`

#### slot: scopes

optional scopes for the authorization call

**Type:** `string` · **Default:**
`'https://www.googleapis.com/auth/drive.readonly'`

#### slot: domains

array of valid domains the url can contain to use this account

**Type:** `stringArray` · **Default:** `['drive.google.com']`

#### slot: responseType

the type of response from the authorization endpoint

**Type:** `string` · **Default:** `'token'`

</details>

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained. A slot redeclared by a more specific config is
shown once, at its most specific definition.

<details>
<summary>Inherited from OAuthInternetAccount</summary>

[OAuthInternetAccount config →](../oauthinternetaccount)

#### slot: tokenType

a custom name for a token to include in the header

**Type:** `string` · **Default:** `'Bearer'`

#### slot: tokenEndpoint

the token endpoint of the internet account

**Type:** `string` · **Default:** `''`

#### slot: needsPKCE

boolean to indicate if the endpoint needs a PKCE code

**Type:** `boolean` · **Default:** `false`

#### slot: clientId

id for the OAuth application

**Type:** `string` · **Default:** `''`

#### slot: state

optional state for the authorization call

**Type:** `string` · **Default:** `''`

</details>

<details>
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

</details>

## Related links

- **State model:** [runtime API](../../models/googledriveoauthinternetaccount)
- **Base config:** [OAuthInternetAccount](../oauthinternetaccount)
