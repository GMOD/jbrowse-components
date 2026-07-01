---
id: oauthinternetaccount
title: OAuthInternetAccount
sidebar_label: Internet Account -> OAuthInternetAccount
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/OAuthModel/model.tsx)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/OAuthInternetAccount.md)

## Overview

### OAuthInternetAccount - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/oauthinternetaccount).

<details open>
<summary>OAuthInternetAccount - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                     | Signature                             |
| ------------------------------------------ | ------------------------------------- |
| [`type`](#property-type)                   | `ISimpleType<"OAuthInternetAccount">` |
| [`configuration`](#property-configuration) | `ITypeUnion<any, any, any>`           |

</details>

<details>
<summary>OAuthInternetAccount - Properties (all signatures)</summary>

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

<details open>
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

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                         | Signature           |
| ---------------------------------------------- | ------------------- |
| [`codeVerifierPKCE`](#getter-codeverifierpkce) | `string`            |
| [`authEndpoint`](#getter-authendpoint)         | `string`            |
| [`tokenEndpoint`](#getter-tokenendpoint)       | `string`            |
| [`needsPKCE`](#getter-needspkce)               | `boolean`           |
| [`clientId`](#getter-clientid)                 | `string`            |
| [`scopes`](#getter-scopes)                     | `string`            |
| [`responseType`](#getter-responsetype)         | `"code" \| "token"` |
| [`refreshTokenKey`](#getter-refreshtokenkey)   | `string`            |

</details>

<details>
<summary>OAuthInternetAccount - Getters (all signatures)</summary>

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

<details open>
<summary>OAuthInternetAccount - Methods</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                 | Signature              |
| ------------------------------------------------------ | ---------------------- |
| [`retrieveRefreshToken`](#method-retrieverefreshtoken) | `() => string \| null` |

</details>

<details>
<summary>OAuthInternetAccount - Methods (all signatures)</summary>

#### method: retrieveRefreshToken

```ts
type retrieveRefreshToken = () => string | null
```

</details>

<details open>
<summary>OAuthInternetAccount - Actions</summary>

#### action: getTokenViaAuthFlow

Opens the provider's auth page and returns a promise for the resulting token.
For Electron, drives the flow directly via IPC; for web, opens a popup and waits
for the redirect message.

```ts
type getTokenViaAuthFlow = () => Promise<string>
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                                               | Signature                                                                                                        |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| [`storeRefreshToken`](#action-storerefreshtoken)                                     | `(refreshToken: string) => void`                                                                                 |
| [`removeRefreshToken`](#action-removerefreshtoken)                                   | `() => void`                                                                                                     |
| [`exchangeAuthorizationForAccessToken`](#action-exchangeauthorizationforaccesstoken) | `(code: string, redirectUri: string) => Promise<string>`                                                         |
| [`exchangeRefreshForAccessToken`](#action-exchangerefreshforaccesstoken)             | `(refreshToken: string) => Promise<string>`                                                                      |
| [`getTokenFromUser`](#action-gettokenfromuser)                                       | `(resolve: (token: string) => void, reject: (error: Error) => void) => Promise<void>`                            |
| [`validateToken`](#action-validatetoken)                                             | `(token: string, location: UriLocation) => Promise<string>`                                                      |
| [`getFetcher`](#action-getfetcher)                                                   | `(loc?: UriLocation \| undefined) => (input: RequestInfo, init?: RequestInit \| undefined) => Promise<Response>` |

</details>

<details>
<summary>OAuthInternetAccount - Actions (all signatures)</summary>

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
