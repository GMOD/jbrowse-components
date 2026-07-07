---
id: oauthinternetaccount
title: OAuthInternetAccount
sidebar_label: Internet Account -> OAuthInternetAccount
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`authentication` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/OAuthModel/model.tsx).

## Overview

## Members

| Member                                                                             | Kind       | Description                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                                             | Properties |                                                                                                                                                                                                                                                                               |
| [configuration](#property-configuration)                                           | Properties |                                                                                                                                                                                                                                                                               |
| [conf](#getter-conf)                                                               | Getters    | The config typed off the concrete schema. `ConfigurationReference` erases `self.configuration` to `any` (the reference's MST instance brand doesn't carry the schema's slot definitions), so reads go through this getter to recover per-slot types and slot-name validation. |
| [codeVerifierPKCE](#getter-codeverifierpkce)                                       | Getters    |                                                                                                                                                                                                                                                                               |
| [authEndpoint](#getter-authendpoint)                                               | Getters    |                                                                                                                                                                                                                                                                               |
| [tokenEndpoint](#getter-tokenendpoint)                                             | Getters    |                                                                                                                                                                                                                                                                               |
| [needsPKCE](#getter-needspkce)                                                     | Getters    |                                                                                                                                                                                                                                                                               |
| [clientId](#getter-clientid)                                                       | Getters    |                                                                                                                                                                                                                                                                               |
| [scopes](#getter-scopes)                                                           | Getters    |                                                                                                                                                                                                                                                                               |
| [state](#getter-state)                                                             | Getters    | OAuth state parameter: https://www.rfc-editor.org/rfc/rfc6749#section-4.1.1 Can override or extend if dynamic state is needed.                                                                                                                                                |
| [responseType](#getter-responsetype)                                               | Getters    |                                                                                                                                                                                                                                                                               |
| [refreshTokenKey](#getter-refreshtokenkey)                                         | Getters    |                                                                                                                                                                                                                                                                               |
| [retrieveRefreshToken](#method-retrieverefreshtoken)                               | Methods    |                                                                                                                                                                                                                                                                               |
| [storeRefreshToken](#action-storerefreshtoken)                                     | Actions    |                                                                                                                                                                                                                                                                               |
| [removeRefreshToken](#action-removerefreshtoken)                                   | Actions    |                                                                                                                                                                                                                                                                               |
| [exchangeAuthorizationForAccessToken](#action-exchangeauthorizationforaccesstoken) | Actions    |                                                                                                                                                                                                                                                                               |
| [exchangeRefreshForAccessToken](#action-exchangerefreshforaccesstoken)             | Actions    |                                                                                                                                                                                                                                                                               |
| [getTokenViaAuthFlow](#action-gettokenviaauthflow)                                 | Actions    | Opens the provider's auth page and returns a promise for the resulting token. For Electron, drives the flow directly via IPC; for web, opens a popup and waits for the redirect message.                                                                                      |
| [getTokenFromUser](#action-gettokenfromuser)                                       | Actions    |                                                                                                                                                                                                                                                                               |
| [validateToken](#action-validatetoken)                                             | Actions    |                                                                                                                                                                                                                                                                               |
| [getFetcher](#action-getfetcher)                                                   | Actions    |                                                                                                                                                                                                                                                                               |

### OAuthInternetAccount - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/oauthinternetaccount).

<details>
<summary>OAuthInternetAccount - Properties</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'OAuthInternetAccount'>
// code
type: types.literal('OAuthInternetAccount')
```

#### property: configuration

```ts
// type signature
type configuration = ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

</details>

<details>
<summary>OAuthInternetAccount - Getters</summary>

#### getter: conf

The config typed off the concrete schema. `ConfigurationReference` erases
`self.configuration` to `any` (the reference's MST instance brand doesn't carry
the schema's slot definitions), so reads go through this getter to recover
per-slot types and slot-name validation.

```ts
type conf = ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>
```

#### getter: state

OAuth state parameter: https://www.rfc-editor.org/rfc/rfc6749#section-4.1.1

Can override or extend if dynamic state is needed.

```ts
type state = string
```

</details>

<details>
<summary>OAuthInternetAccount - Getters (other undocumented members)</summary>

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

#### getter: responseType

```ts
type responseType = 'code' | 'token'
```

#### getter: refreshTokenKey

```ts
type refreshTokenKey = string
```

</details>

<details>
<summary>OAuthInternetAccount - Methods</summary>

#### method: retrieveRefreshToken

```ts
type retrieveRefreshToken = () => string | null
```

</details>

<details>
<summary>OAuthInternetAccount - Actions</summary>

#### action: getTokenViaAuthFlow

Opens the provider's auth page and returns a promise for the resulting token.
For Electron, drives the flow directly via IPC; for web, opens a popup and waits
for the redirect message.

```ts
type getTokenViaAuthFlow = () => Promise<string>
```

</details>

<details>
<summary>OAuthInternetAccount - Actions (other undocumented members)</summary>

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

#### action: getTokenFromUser

```ts
type getTokenFromUser = (
  resolve: (token: string) => void,
  reject: (error: Error) => void,
) => Promise<void>
```

#### action: validateToken

```ts
type validateToken = (token: string, location: UriLocation) => Promise<string>
```

#### action: getFetcher

```ts
type getFetcher = (
  loc?: UriLocation | undefined,
) => (input: RequestInfo, init?: RequestInit | undefined) => Promise<Response>
```

</details>
