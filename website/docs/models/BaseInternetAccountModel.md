---
id: baseinternetaccountmodel
title: BaseInternetAccountModel
sidebar_label: Internet Account -> BaseInternetAccountModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/pluggableElementTypes/models/InternetAccountModel.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/BaseInternetAccountModel.md)

## Overview

<details open>
<summary>BaseInternetAccountModel - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                     | Signature                                          |
| ------------------------------------------ | -------------------------------------------------- |
| [`id`](#property-id)                       | `IOptionalIType<ISimpleType<string>, [undefined]>` |
| [`type`](#property-type)                   | `ISimpleType<string>`                              |
| [`configuration`](#property-configuration) | `ITypeUnion<any, any, any>`                        |

</details>

<details>
<summary>BaseInternetAccountModel - Properties (all signatures)</summary>

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

<details open>
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

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                           | Signature  |
| ------------------------------------------------ | ---------- |
| [`name`](#getter-name)                           | `string`   |
| [`description`](#getter-description)             | `string`   |
| [`internetAccountId`](#getter-internetaccountid) | `string`   |
| [`authHeader`](#getter-authheader)               | `string`   |
| [`tokenType`](#getter-tokentype)                 | `string`   |
| [`domains`](#getter-domains)                     | `string[]` |

</details>

<details>
<summary>BaseInternetAccountModel - Getters (all signatures)</summary>

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

<details open>
<summary>BaseInternetAccountModel - Methods</summary>

#### method: handlesLocation

Determine whether this internetAccount provides credentials for a URL

```ts
type handlesLocation = (location: UriLocation) => boolean
```

</details>

<details open>
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

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                               | Signature                                                                                                                                                                                                       |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`storeToken`](#action-storetoken)                   | `(token: string) => void`                                                                                                                                                                                       |
| [`removeToken`](#action-removetoken)                 | `() => void`                                                                                                                                                                                                    |
| [`retrieveToken`](#action-retrievetoken)             | `() => string \| null`                                                                                                                                                                                          |
| [`addAuthHeaderToInit`](#action-addauthheadertoinit) | `(init?: RequestInit \| undefined, token?: string \| undefined) => { headers: Headers; body?: BodyInit \| null \| undefined; cache?: RequestCache \| undefined; ... 10 more ...; window?: null \| undefined; }` |

</details>

<details>
<summary>BaseInternetAccountModel - Actions (all signatures)</summary>

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
