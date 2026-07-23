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

| Member                                                                   | Kind       | Defined by               | Description                                                                                                                                  |
| ------------------------------------------------------------------------ | ---------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [id](#property-id)                                                       | Properties | BaseInternetAccountModel |                                                                                                                                              |
| [type](#property-type)                                                   | Properties | BaseInternetAccountModel |                                                                                                                                              |
| [configuration](#property-configuration)                                 | Properties | BaseInternetAccountModel |                                                                                                                                              |
| [name](#getter-name)                                                     | Getters    | BaseInternetAccountModel |                                                                                                                                              |
| [description](#getter-description)                                       | Getters    | BaseInternetAccountModel |                                                                                                                                              |
| [internetAccountId](#getter-internetaccountid)                           | Getters    | BaseInternetAccountModel |                                                                                                                                              |
| [authHeader](#getter-authheader)                                         | Getters    | BaseInternetAccountModel |                                                                                                                                              |
| [tokenType](#getter-tokentype)                                           | Getters    | BaseInternetAccountModel |                                                                                                                                              |
| [domains](#getter-domains)                                               | Getters    | BaseInternetAccountModel |                                                                                                                                              |
| [toggleContents](#getter-togglecontents)                                 | Getters    | BaseInternetAccountModel | Can use this to customize what is displayed in fileSelector's toggle box                                                                     |
| [SelectorComponent](#getter-selectorcomponent)                           | Getters    | BaseInternetAccountModel | Can use this to customize what the fileSelector.                                                                                             |
| [selectorLabel](#getter-selectorlabel)                                   | Getters    | BaseInternetAccountModel | Can use this to add a label to the UrlChooser.                                                                                               |
| [tokenKey](#getter-tokenkey)                                             | Getters    | BaseInternetAccountModel | The key used to store this internetAccount's token in sessionStorage                                                                         |
| [handlesLocation](#method-handleslocation)                               | Methods    | BaseInternetAccountModel | Determine whether this internetAccount provides credentials for a URL                                                                        |
| [getTokenFromUser](#action-gettokenfromuser)                             | Actions    | BaseInternetAccountModel | Must be implemented by a model extending or composing this one.                                                                              |
| [storeToken](#action-storetoken)                                         | Actions    | BaseInternetAccountModel |                                                                                                                                              |
| [retrieveToken](#action-retrievetoken)                                   | Actions    | BaseInternetAccountModel |                                                                                                                                              |
| [validateToken](#action-validatetoken)                                   | Actions    | BaseInternetAccountModel | This can be used by an internetAccount to validate a token works before it is used.                                                          |
| [removeToken](#action-removetoken)                                       | Actions    | BaseInternetAccountModel | Clears the stored token.                                                                                                                     |
| [getToken](#action-gettoken)                                             | Actions    | BaseInternetAccountModel | Try to get the token from the location pre-auth, from local storage, or from a previously cached promise.                                    |
| [addAuthHeaderToInit](#action-addauthheadertoinit)                       | Actions    | BaseInternetAccountModel |                                                                                                                                              |
| [getValidatedToken](#action-getvalidatedtoken)                           | Actions    | BaseInternetAccountModel | Fetch a token and, when a location is supplied, run it through `validateToken` so subclasses can refresh an expired token before it is used. |
| [getPreAuthorizationInformation](#action-getpreauthorizationinformation) | Actions    | BaseInternetAccountModel | Gets the token and returns it along with the information needed to create a new internetAccount.                                             |
| [getFetcher](#action-getfetcher)                                         | Actions    | BaseInternetAccountModel | Get a fetch method that will add any needed authentication headers to the request before sending it.                                         |
| [openLocation](#action-openlocation)                                     | Actions    | BaseInternetAccountModel | Gets a filehandle that uses a fetch that adds auth headers                                                                                   |

<details>
<summary>BaseInternetAccountModel - Properties</summary>

| Member                                                 | Type                                                  |
| ------------------------------------------------------ | ----------------------------------------------------- |
| <span id="property-id">id</span>                       | `IOptionalIType<ISimpleType<string>, [undefined]>`    |
| <span id="property-type">type</span>                   | `ISimpleType<string>`                                 |
| <span id="property-configuration">configuration</span> | `IConfigurationReference<ConfigurationSchemaType<…>>` |

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

| Member                                                       | Type       |
| ------------------------------------------------------------ | ---------- |
| <span id="getter-name">name</span>                           | `string`   |
| <span id="getter-description">description</span>             | `string`   |
| <span id="getter-internetaccountid">internetAccountId</span> | `string`   |
| <span id="getter-authheader">authHeader</span>               | `string`   |
| <span id="getter-tokentype">tokenType</span>                 | `string`   |
| <span id="getter-domains">domains</span>                     | `string[]` |

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

#### action: removeToken

Clears the stored token. Also drops the in-memory cached promise so a subsequent
`getToken` re-prompts / re-derives rather than handing back the token that was
just invalidated.

```ts
type removeToken = () => void
```

#### action: getToken

Try to get the token from the location pre-auth, from local storage, or from a
previously cached promise. If token is not available, uses `getTokenFromUser`.

```ts
type getToken = (location?: UriLocation | undefined) => Promise<string>
```

#### action: getValidatedToken

Fetch a token and, when a location is supplied, run it through `validateToken`
so subclasses can refresh an expired token before it is used. Shared by the
auth-aware fetchers.

```ts
type getValidatedToken = (loc?: UriLocation | undefined) => Promise<string>
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

| Member                                                           | Type                                                                    |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| <span id="action-storetoken">storeToken</span>                   | `(token: string) => void`                                               |
| <span id="action-retrievetoken">retrieveToken</span>             | `() => string \| null`                                                  |
| <span id="action-addauthheadertoinit">addAuthHeaderToInit</span> | `(init?: RequestInit \| undefined, token?: string \| undefined) => {…}` |

</details>
