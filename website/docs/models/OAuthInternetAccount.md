---
id: oauthinternetaccount
title: OAuthInternetAccount
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

## Docs

### OAuthInternetAccount - Properties

#### propertie: type

```js
// type signature
ISimpleType<"OAuthInternetAccount">
// code
type: types.literal('OAuthInternetAccount')
```

#### propertie: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

### OAuthInternetAccount - Getters

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

### OAuthInternetAccount - Methods

#### method: state

OAuth state parameter: https://www.rfc-editor.org/rfc/rfc6749#section-4.1.1

Can override or extend if dynamic state is needed.

```js
// type signature
state: () => string | undefined
```

#### method: retrieveRefreshToken

```js
// type signature
retrieveRefreshToken: () => string | null
```

### OAuthInternetAccount - Actions

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

#### action: addMessageChannel

used to listen to child window for auth code/token

```js
// type signature
addMessageChannel: (resolve: (token: string) => void, reject: (error: Error) => void) => void
```

#### action: deleteMessageChannel

```js
// type signature
deleteMessageChannel: () => void
```

#### action: finishOAuthWindow

Returns the token if the event completes the flow, undefined if the event name
doesn't match. Throws on any OAuth error.

```js
// type signature
finishOAuthWindow: (event: MessageEvent<any>) => Promise<string | undefined>
```

#### action: useEndpointForAuthorization

opens external OAuth flow, popup for web and new browser window for desktop

```js
// type signature
useEndpointForAuthorization: (resolve: (token: string) => void) => Promise<void>
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
