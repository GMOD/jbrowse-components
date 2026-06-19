---
id: dropboxoauthinternetaccount
title: DropboxOAuthInternetAccount
sidebar_label: Internet Account -> DropboxOAuthInternetAccount
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/DropboxOAuthModel/model.tsx)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/DropboxOAuthInternetAccount.md)

## Overview

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [OAuthInternetAccount](../oauthinternetaccount)

**Properties:** [type](../oauthinternetaccount#property-type),
[configuration](../oauthinternetaccount#property-configuration)

**Getters:** [conf](../oauthinternetaccount#getter-conf),
[codeVerifierPKCE](../oauthinternetaccount#getter-codeverifierpkce),
[authEndpoint](../oauthinternetaccount#getter-authendpoint),
[tokenEndpoint](../oauthinternetaccount#getter-tokenendpoint),
[needsPKCE](../oauthinternetaccount#getter-needspkce),
[clientId](../oauthinternetaccount#getter-clientid),
[scopes](../oauthinternetaccount#getter-scopes),
[state](../oauthinternetaccount#getter-state),
[responseType](../oauthinternetaccount#getter-responsetype),
[refreshTokenKey](../oauthinternetaccount#getter-refreshtokenkey)

**Methods:**
[retrieveRefreshToken](../oauthinternetaccount#method-retrieverefreshtoken)

**Actions:**
[storeRefreshToken](../oauthinternetaccount#action-storerefreshtoken),
[removeRefreshToken](../oauthinternetaccount#action-removerefreshtoken),
[exchangeAuthorizationForAccessToken](../oauthinternetaccount#action-exchangeauthorizationforaccesstoken),
[exchangeRefreshForAccessToken](../oauthinternetaccount#action-exchangerefreshforaccesstoken),
[getTokenViaAuthFlow](../oauthinternetaccount#action-gettokenviaauthflow),
[getTokenFromUser](../oauthinternetaccount#action-gettokenfromuser),
[validateToken](../oauthinternetaccount#action-validatetoken),
[getFetcher](../oauthinternetaccount#action-getfetcher)

<details open>
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
type configuration = ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

</details>

<details open>
<summary>DropboxOAuthInternetAccount - Getters</summary>

#### getter: toggleContents

The FileSelector icon for Dropbox

```ts
type toggleContents = Element
```

#### getter: selectorLabel

```ts
type selectorLabel = string
```

</details>

<details open>
<summary>DropboxOAuthInternetAccount - Methods</summary>

#### method: getFetcher

```ts
type getFetcher = (
  location?: UriLocation | undefined,
) => (input: RequestInfo, init?: RequestInit | undefined) => Promise<Response>
```

</details>

<details open>
<summary>DropboxOAuthInternetAccount - Actions</summary>

#### action: validateToken

```ts
type validateToken = (token: string, location: UriLocation) => Promise<string>
```

</details>
