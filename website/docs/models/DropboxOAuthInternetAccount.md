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

### DropboxOAuthInternetAccount - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/dropboxoauthinternetaccount).

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
