---
id: dropboxoauthinternetaccount
title: DropboxOAuthInternetAccount
sidebar_label: Internet Account -> DropboxOAuthInternetAccount
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`authentication` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/DropboxOAuthModel/model.tsx).

## Overview

## Members

| Member                                                                             | Kind       | Defined by                                      | Description                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------- | ---------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                                             | Properties | DropboxOAuthInternetAccount                     |                                                                                                                                                                                                                                                                               |
| [configuration](#property-configuration)                                           | Properties | DropboxOAuthInternetAccount                     |                                                                                                                                                                                                                                                                               |
| [toggleContents](#getter-togglecontents)                                           | Getters    | DropboxOAuthInternetAccount                     | The FileSelector icon for Dropbox                                                                                                                                                                                                                                             |
| [selectorLabel](#getter-selectorlabel)                                             | Getters    | DropboxOAuthInternetAccount                     |                                                                                                                                                                                                                                                                               |
| [getFetcher](#method-getfetcher)                                                   | Methods    | DropboxOAuthInternetAccount                     |                                                                                                                                                                                                                                                                               |
| [validateToken](#action-validatetoken)                                             | Actions    | DropboxOAuthInternetAccount                     |                                                                                                                                                                                                                                                                               |
| [conf](#getter-conf)                                                               | Getters    | [OAuthInternetAccount](../oauthinternetaccount) | The config typed off the concrete schema. `ConfigurationReference` erases `self.configuration` to `any` (the reference's MST instance brand doesn't carry the schema's slot definitions), so reads go through this getter to recover per-slot types and slot-name validation. |
| [codeVerifierPKCE](#getter-codeverifierpkce)                                       | Getters    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                                                                                                                                                               |
| [authEndpoint](#getter-authendpoint)                                               | Getters    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                                                                                                                                                               |
| [tokenEndpoint](#getter-tokenendpoint)                                             | Getters    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                                                                                                                                                               |
| [needsPKCE](#getter-needspkce)                                                     | Getters    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                                                                                                                                                               |
| [clientId](#getter-clientid)                                                       | Getters    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                                                                                                                                                               |
| [scopes](#getter-scopes)                                                           | Getters    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                                                                                                                                                               |
| [state](#getter-state)                                                             | Getters    | [OAuthInternetAccount](../oauthinternetaccount) | OAuth state parameter: https://www.rfc-editor.org/rfc/rfc6749#section-4.1.1 Can override or extend if dynamic state is needed.                                                                                                                                                |
| [responseType](#getter-responsetype)                                               | Getters    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                                                                                                                                                               |
| [refreshTokenKey](#getter-refreshtokenkey)                                         | Getters    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                                                                                                                                                               |
| [retrieveRefreshToken](#method-retrieverefreshtoken)                               | Methods    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                                                                                                                                                               |
| [storeRefreshToken](#action-storerefreshtoken)                                     | Actions    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                                                                                                                                                               |
| [removeRefreshToken](#action-removerefreshtoken)                                   | Actions    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                                                                                                                                                               |
| [exchangeAuthorizationForAccessToken](#action-exchangeauthorizationforaccesstoken) | Actions    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                                                                                                                                                               |
| [exchangeRefreshForAccessToken](#action-exchangerefreshforaccesstoken)             | Actions    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                                                                                                                                                               |
| [getTokenViaAuthFlow](#action-gettokenviaauthflow)                                 | Actions    | [OAuthInternetAccount](../oauthinternetaccount) | Opens the provider's auth page and returns a promise for the resulting token. For Electron, drives the flow directly via IPC; for web, opens a popup and waits for the redirect message.                                                                                      |
| [getTokenFromUser](#action-gettokenfromuser)                                       | Actions    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                                                                                                                                                               |
| [getFetcher](#action-getfetcher)                                                   | Actions    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                                                                                                                                                               |

### DropboxOAuthInternetAccount - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/dropboxoauthinternetaccount).

<details>
<summary>DropboxOAuthInternetAccount - Properties</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'DropboxOAuthInternetAccount'>
// code
type: types.literal('DropboxOAuthInternetAccount')
```

#### property: configuration

```ts
// type signature
type configuration = IConfigurationReference<ConfigurationSchemaType<{ readonly authEndpoint: { readonly description: "the authorization code endpoint of the internet account"; readonly type: "string"; readonly defaultValue: "https://www.dropbox.com/oauth2/authorize"; }; readonly tokenEndpoint: { ...; }; readonly needsPKCE: { ...; }; re...
// code
configuration: ConfigurationReference(configSchema)
```

</details>

<details>
<summary>DropboxOAuthInternetAccount - Getters</summary>

#### getter: toggleContents

The FileSelector icon for Dropbox

```ts
type toggleContents = Element
```

</details>

<details>
<summary>DropboxOAuthInternetAccount - Getters (other undocumented members)</summary>

#### getter: selectorLabel

```ts
type selectorLabel = string
```

</details>

<details>
<summary>DropboxOAuthInternetAccount - Methods</summary>

#### method: getFetcher

```ts
type getFetcher = (
  location?: UriLocation | undefined,
) => (input: RequestInfo, init?: RequestInit | undefined) => Promise<Response>
```

</details>

<details>
<summary>DropboxOAuthInternetAccount - Actions</summary>

#### action: validateToken

```ts
type validateToken = (token: string, location: UriLocation) => Promise<string>
```

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from OAuthInternetAccount</summary>

[OAuthInternetAccount →](../oauthinternetaccount)

**Getters**

#### getter: conf

The config typed off the concrete schema. `ConfigurationReference` erases
`self.configuration` to `any` (the reference's MST instance brand doesn't carry
the schema's slot definitions), so reads go through this getter to recover
per-slot types and slot-name validation.

```ts
type conf = ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>
```

#### getter: codeVerifierPKCE

```ts
type codeVerifierPKCE = string
```

#### getter: authEndpoint

```ts
type authEndpoint = string
```

#### getter: tokenEndpoint

```ts
type tokenEndpoint = string
```

#### getter: needsPKCE

```ts
type needsPKCE = boolean
```

#### getter: clientId

```ts
type clientId = string
```

#### getter: scopes

```ts
type scopes = string
```

#### getter: state

OAuth state parameter: https://www.rfc-editor.org/rfc/rfc6749#section-4.1.1

Can override or extend if dynamic state is needed.

```ts
type state = string
```

#### getter: responseType

```ts
type responseType = 'code' | 'token'
```

#### getter: refreshTokenKey

```ts
type refreshTokenKey = string
```

**Methods**

#### method: retrieveRefreshToken

```ts
type retrieveRefreshToken = () => string | null
```

**Actions**

#### action: storeRefreshToken

```ts
type storeRefreshToken = (refreshToken: string) => void
```

#### action: removeRefreshToken

```ts
type removeRefreshToken = () => void
```

#### action: exchangeAuthorizationForAccessToken

```ts
type exchangeAuthorizationForAccessToken = (
  code: string,
  redirectUri: string,
) => Promise<string>
```

#### action: exchangeRefreshForAccessToken

```ts
type exchangeRefreshForAccessToken = (refreshToken: string) => Promise<string>
```

#### action: getTokenViaAuthFlow

Opens the provider's auth page and returns a promise for the resulting token.
For Electron, drives the flow directly via IPC; for web, opens a popup and waits
for the redirect message.

```ts
type getTokenViaAuthFlow = () => Promise<string>
```

#### action: getTokenFromUser

```ts
type getTokenFromUser = (
  resolve: (token: string) => void,
  reject: (error: Error) => void,
) => Promise<void>
```

#### action: getFetcher

```ts
type getFetcher = (
  loc?: UriLocation | undefined,
) => (input: RequestInfo, init?: RequestInit | undefined) => Promise<Response>
```

</details>
