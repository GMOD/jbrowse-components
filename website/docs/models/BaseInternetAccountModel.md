---
id: baseinternetaccountmodel
title: BaseInternetAccountModel
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[packages/core/pluggableElementTypes/models/InternetAccountModel.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/pluggableElementTypes/models/InternetAccountModel.ts)

### BaseInternetAccountModel - Properties

#### property: configuration

```js
// type signature
ConfigurationSchemaType<{ authHeader: { defaultValue: string; description: string; type: string; }; description: { defaultValue: string; description: string; type: string; }; domains: { defaultValue: any[]; description: string; type: string; }; name: { ...; }; tokenType: { ...; }; }, ConfigurationSchemaOptions<...>>
// code
configuration: ConfigurationReference(BaseInternetAccountConfig)
```

#### property: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: type

```js
// type signature
ISimpleType<string>
// code
type: types.string
```

### BaseInternetAccountModel - Getters

#### getter: SelectorComponent

Can use this to customize what the fileSelector. It takes a prop called
`setLocation` that should be used to set a UriLocation

```js
// type
any
```

#### getter: authHeader

```js
// type
string
```

#### getter: description

```js
// type
string
```

#### getter: domains

```js
// type
string[]
```

#### getter: internetAccountId

```js
// type
string
```

#### getter: name

```js
// type
string
```

#### getter: selectorLabel

Can use this to add a label to the UrlChooser. Has no effect if a custom
SelectorComponent is supplied

```js
// type
string
```

#### getter: toggleContents

Can use this to customize what is displayed in fileSelector's toggle box

```js
// type
React.ReactNode
```

#### getter: tokenType

```js
// type
string
```

#### getter: tokenKey

The key used to store this internetAccount's token in sessionStorage

```js
// type
string
```

### BaseInternetAccountModel - Methods

#### method: handlesLocation

Determine whether this internetAccount provides credentials for a URL

```js
// type signature
handlesLocation: (location: UriLocation) => boolean
```

### BaseInternetAccountModel - Actions

#### action: getTokenFromUser

Must be implemented by a model extending or composing this one. Pass the user's
token to `resolve`.

```js
// type signature
getTokenFromUser: (_resolve: (token: string) => void, _reject: (error: Error) => void) => void
```

#### action: removeToken

```js
// type signature
removeToken: () => void
```

#### action: retrieveToken

```js
// type signature
retrieveToken: () => string
```

#### action: storeToken

```js
// type signature
storeToken: (token: string) => void
```

#### action: validateToken

This can be used by an internetAccount to validate a token works before it is
used. This is run when preAuthorizationInformation is requested, so it can be
used to check that a token is valid before sending it to a worker thread. It
expects the token to be returned so that this action can also be used to
generate a new token (e.g. by using a refresh token) if the original one was
invalid. Should throw an error if a token is invalid.

```js
// type signature
validateToken: (token: string, _loc: UriLocation) => Promise<string>
```

#### action: getToken

Try to get the token from the location pre-auth, from local storage, or from a
previously cached promise. If token is not available, uses `getTokenFromUser`.

```js
// type signature
getToken: (location?: UriLocation) => Promise<string>
```

#### action: addAuthHeaderToInit

```js
// type signature
addAuthHeaderToInit: (init: RequestInit, token: string) => { headers: Headers; body?: BodyInit; cache?: RequestCache; credentials?: RequestCredentials; ... 9 more ...; window?: null; }
```

#### action: getPreAuthorizationInformation

Gets the token and returns it along with the information needed to create a new
internetAccount.

```js
// type signature
getPreAuthorizationInformation: (location: UriLocation) => Promise<{ authInfo: { configuration: any; token: string; }; internetAccountType: string; }>
```

#### action: getFetcher

Get a fetch method that will add any needed authentication headers to the
request before sending it. If location is provided, it will be checked to see if
it includes a token in it pre-auth information.

```js
// type signature
getFetcher: (loc?: UriLocation) => (input: RequestInfo, init?: RequestInit) => Promise<Response>
```

#### action: openLocation

Gets a filehandle that uses a fetch that adds auth headers

```js
// type signature
openLocation: (location: UriLocation) => RemoteFileWithRangeCache
```
