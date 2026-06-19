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

<details>
<summary>OAuthInternetAccount - Properties</summary>

#### property: type

```js
// type signature
ISimpleType<"OAuthInternetAccount">
// code
type: types.literal('OAuthInternetAccount')
```

#### property: configuration

```js
// type signature
ITypeUnion<any, any, any>
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

```js
// type
ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>
```

#### getter: codeVerifierPKCE

```js
// type
string
```

#### getter: authEndpoint

```js
// type
string
```

#### getter: tokenEndpoint

```js
// type
string
```

#### getter: needsPKCE

```js
// type
boolean
```

#### getter: clientId

```js
// type
string
```

#### getter: scopes

```js
// type
string
```

#### getter: state

OAuth state parameter: https://www.rfc-editor.org/rfc/rfc6749#section-4.1.1

Can override or extend if dynamic state is needed.

```js
// type
string
```

#### getter: responseType

```js
// type
'code' | 'token'
```

#### getter: refreshTokenKey

```js
// type
string
```

</details>

<details>
<summary>OAuthInternetAccount - Methods</summary>

#### method: retrieveRefreshToken

```js
// type signature
retrieveRefreshToken: () => string | null
```

</details>

<details>
<summary>OAuthInternetAccount - Actions</summary>

#### action: storeRefreshToken

```js
// type signature
storeRefreshToken: (refreshToken: string) => void
```

#### action: removeRefreshToken

```js
// type signature
removeRefreshToken: () => void
```

#### action: exchangeAuthorizationForAccessToken

```js
// type signature
exchangeAuthorizationForAccessToken: (code: string, redirectUri: string) => Promise<string>
```

#### action: exchangeRefreshForAccessToken

```js
// type signature
exchangeRefreshForAccessToken: (refreshToken: string) => Promise<string>
```

#### action: getTokenViaAuthFlow

Opens the provider's auth page and returns a promise for the resulting token.
For Electron, drives the flow directly via IPC; for web, opens a popup and waits
for the redirect message.

```js
// type signature
getTokenViaAuthFlow: () => Promise<string>
```

#### action: getTokenFromUser

```js
// type signature
getTokenFromUser: (resolve: (token: string) => void, reject: (error: Error) => void) => Promise<void>
```

#### action: validateToken

```js
// type signature
validateToken: (token: string, location: UriLocation) => Promise<string>
```

#### action: getFetcher

```js
// type signature
getFetcher: (loc?: UriLocation | undefined) => (input: RequestInfo, init?: RequestInit | undefined) => Promise<Response>
```

</details>
