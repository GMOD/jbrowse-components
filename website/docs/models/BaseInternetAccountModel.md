---
id: baseinternetaccountmodel
title: BaseInternetAccountModel
sidebar_label: Internet Account -> BaseInternetAccountModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/InternetAccountModel.ts).

## Overview

## Members

| Member                                                                   | Kind       | Description                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [id](#property-id)                                                       | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [type](#property-type)                                                   | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [configuration](#property-configuration)                                 | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [name](#getter-name)                                                     | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [description](#getter-description)                                       | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [internetAccountId](#getter-internetaccountid)                           | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [authHeader](#getter-authheader)                                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [tokenType](#getter-tokentype)                                           | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [domains](#getter-domains)                                               | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [toggleContents](#getter-togglecontents)                                 | Getters    | Can use this to customize what is displayed in fileSelector's toggle box                                                                                                                                                                                                                                                                                                                                                                             |
| [SelectorComponent](#getter-selectorcomponent)                           | Getters    | Can use this to customize what the fileSelector. It takes a prop called `setLocation` that should be used to set a UriLocation                                                                                                                                                                                                                                                                                                                       |
| [selectorLabel](#getter-selectorlabel)                                   | Getters    | Can use this to add a label to the UrlChooser. Has no effect if a custom SelectorComponent is supplied                                                                                                                                                                                                                                                                                                                                               |
| [tokenKey](#getter-tokenkey)                                             | Getters    | The key used to store this internetAccount's token in sessionStorage                                                                                                                                                                                                                                                                                                                                                                                 |
| [handlesLocation](#method-handleslocation)                               | Methods    | Determine whether this internetAccount provides credentials for a URL                                                                                                                                                                                                                                                                                                                                                                                |
| [getTokenFromUser](#action-gettokenfromuser)                             | Actions    | Must be implemented by a model extending or composing this one. Pass the user's token to `resolve`.                                                                                                                                                                                                                                                                                                                                                  |
| [storeToken](#action-storetoken)                                         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [removeToken](#action-removetoken)                                       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [retrieveToken](#action-retrievetoken)                                   | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [validateToken](#action-validatetoken)                                   | Actions    | This can be used by an internetAccount to validate a token works before it is used. This is run when preAuthorizationInformation is requested, so it can be used to check that a token is valid before sending it to a worker thread. It expects the token to be returned so that this action can also be used to generate a new token (e.g. by using a refresh token) if the original one was invalid. Should throw an error if a token is invalid. |
| [getToken](#action-gettoken)                                             | Actions    | Try to get the token from the location pre-auth, from local storage, or from a previously cached promise. If token is not available, uses `getTokenFromUser`.                                                                                                                                                                                                                                                                                        |
| [addAuthHeaderToInit](#action-addauthheadertoinit)                       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [getPreAuthorizationInformation](#action-getpreauthorizationinformation) | Actions    | Gets the token and returns it along with the information needed to create a new internetAccount.                                                                                                                                                                                                                                                                                                                                                     |
| [getFetcher](#action-getfetcher)                                         | Actions    | Get a fetch method that will add any needed authentication headers to the request before sending it. If location is provided, it will be checked to see if it includes a token in it pre-auth information.                                                                                                                                                                                                                                           |
| [openLocation](#action-openlocation)                                     | Actions    | Gets a filehandle that uses a fetch that adds auth headers                                                                                                                                                                                                                                                                                                                                                                                           |

<details>
<summary>BaseInternetAccountModel - Properties</summary>

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: type

```ts
// type signature
type type = ISimpleType<string>
// code
type: types.string
```

#### property: configuration

```ts
// type signature
type configuration = ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(BaseInternetAccountConfig)
```

</details>

<details>
<summary>BaseInternetAccountModel - Getters</summary>

#### getter: toggleContents

Can use this to customize what is displayed in fileSelector's toggle box

```ts
type toggleContents = ReactNode
```

#### getter: SelectorComponent

Can use this to customize what the fileSelector. It takes a prop called
`setLocation` that should be used to set a UriLocation

```ts
type SelectorComponent = AnyReactComponentType | undefined
```

#### getter: selectorLabel

Can use this to add a label to the UrlChooser. Has no effect if a custom
SelectorComponent is supplied

```ts
type selectorLabel = string | undefined
```

#### getter: tokenKey

The key used to store this internetAccount's token in sessionStorage

```ts
type tokenKey = string
```

</details>

<details>
<summary>BaseInternetAccountModel - Getters (other undocumented members)</summary>

#### getter: name

```ts
type name = string
```

#### getter: description

```ts
type description = string
```

#### getter: internetAccountId

```ts
type internetAccountId = string
```

#### getter: authHeader

```ts
type authHeader = string
```

#### getter: tokenType

```ts
type tokenType = string
```

#### getter: domains

```ts
type domains = string[]
```

</details>

<details>
<summary>BaseInternetAccountModel - Methods</summary>

#### method: handlesLocation

Determine whether this internetAccount provides credentials for a URL

```ts
type handlesLocation = (location: UriLocation) => boolean
```

</details>

<details>
<summary>BaseInternetAccountModel - Actions</summary>

#### action: getTokenFromUser

Must be implemented by a model extending or composing this one. Pass the user's
token to `resolve`.

```ts
type getTokenFromUser = (
  _resolve: (token: string) => void,
  _reject: (error: Error) => void,
) => void
```

#### action: validateToken

This can be used by an internetAccount to validate a token works before it is
used. This is run when preAuthorizationInformation is requested, so it can be
used to check that a token is valid before sending it to a worker thread. It
expects the token to be returned so that this action can also be used to
generate a new token (e.g. by using a refresh token) if the original one was
invalid. Should throw an error if a token is invalid.

```ts
type validateToken = (token: string, _loc: UriLocation) => Promise<string>
```

#### action: getToken

Try to get the token from the location pre-auth, from local storage, or from a
previously cached promise. If token is not available, uses `getTokenFromUser`.

```ts
type getToken = (location?: UriLocation | undefined) => Promise<string>
```

#### action: getPreAuthorizationInformation

Gets the token and returns it along with the information needed to create a new
internetAccount.

```ts
type getPreAuthorizationInformation = (location: UriLocation) => Promise<{
  internetAccountType: string
  authInfo: { token: string; configuration: any }
}>
```

#### action: getFetcher

Get a fetch method that will add any needed authentication headers to the
request before sending it. If location is provided, it will be checked to see if
it includes a token in it pre-auth information.

```ts
type getFetcher = (
  loc?: UriLocation | undefined,
) => (input: RequestInfo, init?: RequestInit | undefined) => Promise<Response>
```

#### action: openLocation

Gets a filehandle that uses a fetch that adds auth headers

```ts
type openLocation = (location: UriLocation) => RemoteFileWithRangeCache
```

</details>

<details>
<summary>BaseInternetAccountModel - Actions (other undocumented members)</summary>

#### action: storeToken

```ts
type storeToken = (token: string) => void
```

#### action: removeToken

```ts
type removeToken = () => void
```

#### action: retrieveToken

```ts
type retrieveToken = () => string | null
```

#### action: addAuthHeaderToInit

```ts
type addAuthHeaderToInit = (init?: RequestInit | undefined, token?: string | undefined) => { headers: Headers; body?: BodyInit | null | undefined; cache?: RequestCache | undefined; ... 10 more ...; window?: null | undefined; }
```

</details>
