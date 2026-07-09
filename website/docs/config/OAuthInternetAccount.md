---
id: oauthinternetaccount
title: OAuthInternetAccount
sidebar_label: Internet Account -> OAuthInternetAccount
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`authentication` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/OAuthModel/configSchema.ts).

## Related links

- **State model:** [runtime API](../../models/oauthinternetaccount)
- **Base config:** [BaseInternetAccount](../baseinternetaccount)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                 | Type      | Description                                             |
| ------------------------------------ | --------- | ------------------------------------------------------- |
| [tokenType](#slot-tokentype)         | `string`  | a custom name for a token to include in the header      |
| [authEndpoint](#slot-authendpoint)   | `string`  | the authorization code endpoint of the internet account |
| [tokenEndpoint](#slot-tokenendpoint) | `string`  | the token endpoint of the internet account              |
| [needsPKCE](#slot-needspkce)         | `boolean` | boolean to indicate if the endpoint needs a PKCE code   |
| [clientId](#slot-clientid)           | `string`  | id for the OAuth application                            |
| [scopes](#slot-scopes)               | `string`  | optional scopes for the authorization call              |
| [state](#slot-state)                 | `string`  | optional state for the authorization call               |
| [responseType](#slot-responsetype)   | `string`  | the type of response from the authorization endpoint.   |

<details>
<summary>OAuthInternetAccount - Slots</summary>

#### slot: tokenType

a custom name for a token to include in the header

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'Bearer'`

#### slot: authEndpoint

the authorization code endpoint of the internet account

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: tokenEndpoint

the token endpoint of the internet account

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: needsPKCE

boolean to indicate if the endpoint needs a PKCE code

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false`

#### slot: clientId

id for the OAuth application

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: scopes

optional scopes for the authorization call

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: state

optional state for the authorization call

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: responseType

the type of response from the authorization endpoint. can be 'token' or 'code'

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'code'`

</details>

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained. A slot redeclared by a more specific config is
shown once, at its most specific definition.

<details>
<summary>Inherited from BaseInternetAccount</summary>

[BaseInternetAccount config →](../baseinternetaccount)

#### slot: name

descriptive name of the internet account

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: description

a description of the internet account

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:** `''`

#### slot: authHeader

request header for credentials

**Type:** [`string`](/docs/config_guides/slot_types#string) · **Default:**
`'Authorization'`

#### slot: domains

array of valid domains the url can contain to use this account

**Type:** `stringArray` · **Default:** `[]`

</details>
