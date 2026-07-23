---
id: googledriveoauthinternetaccount
title: GoogleDriveOAuthInternetAccount
sidebar_label: Internet Account -> GoogleDriveOAuthInternetAccount
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`authentication` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/GoogleDriveOAuthModel/model.tsx).

## Overview

## Members

| Member                                                                             | Kind       | Defined by                                      | Description                                                                                                                    |
| ---------------------------------------------------------------------------------- | ---------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [type](#property-type)                                                             | Properties | GoogleDriveOAuthInternetAccount                 |                                                                                                                                |
| [configuration](#property-configuration)                                           | Properties | GoogleDriveOAuthInternetAccount                 |                                                                                                                                |
| [toggleContents](#getter-togglecontents)                                           | Getters    | GoogleDriveOAuthInternetAccount                 | The FileSelector icon for Google drive                                                                                         |
| [selectorLabel](#getter-selectorlabel)                                             | Getters    | GoogleDriveOAuthInternetAccount                 |                                                                                                                                |
| [getFetcher](#method-getfetcher)                                                   | Methods    | GoogleDriveOAuthInternetAccount                 |                                                                                                                                |
| [openLocation](#method-openlocation)                                               | Methods    | GoogleDriveOAuthInternetAccount                 |                                                                                                                                |
| [validateToken](#action-validatetoken)                                             | Actions    | GoogleDriveOAuthInternetAccount                 |                                                                                                                                |
| [conf](#getter-conf)                                                               | Getters    | [OAuthInternetAccount](../oauthinternetaccount) | The config typed off the concrete schema.                                                                                      |
| [codeVerifierPKCE](#getter-codeverifierpkce)                                       | Getters    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                |
| [authEndpoint](#getter-authendpoint)                                               | Getters    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                |
| [tokenEndpoint](#getter-tokenendpoint)                                             | Getters    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                |
| [needsPKCE](#getter-needspkce)                                                     | Getters    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                |
| [clientId](#getter-clientid)                                                       | Getters    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                |
| [scopes](#getter-scopes)                                                           | Getters    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                |
| [state](#getter-state)                                                             | Getters    | [OAuthInternetAccount](../oauthinternetaccount) | OAuth state parameter: https://www.rfc-editor.org/rfc/rfc6749#section-4.1.1 Can override or extend if dynamic state is needed. |
| [responseType](#getter-responsetype)                                               | Getters    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                |
| [refreshTokenKey](#getter-refreshtokenkey)                                         | Getters    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                |
| [retrieveRefreshToken](#method-retrieverefreshtoken)                               | Methods    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                |
| [storeRefreshToken](#action-storerefreshtoken)                                     | Actions    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                |
| [removeRefreshToken](#action-removerefreshtoken)                                   | Actions    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                |
| [exchangeAuthorizationForAccessToken](#action-exchangeauthorizationforaccesstoken) | Actions    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                |
| [exchangeRefreshForAccessToken](#action-exchangerefreshforaccesstoken)             | Actions    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                |
| [getTokenViaAuthFlow](#action-gettokenviaauthflow)                                 | Actions    | [OAuthInternetAccount](../oauthinternetaccount) | Opens the provider's auth page and returns a promise for the resulting token.                                                  |
| [getTokenFromUser](#action-gettokenfromuser)                                       | Actions    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                |
| [getFetcher](#action-getfetcher)                                                   | Actions    | [OAuthInternetAccount](../oauthinternetaccount) |                                                                                                                                |

### GoogleDriveOAuthInternetAccount - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/googledriveoauthinternetaccount).

<details>
<summary>GoogleDriveOAuthInternetAccount - Properties</summary>

| Member                                                 | Type                                                  |
| ------------------------------------------------------ | ----------------------------------------------------- |
| <span id="property-type">type</span>                   | `ISimpleType<"GoogleDriveOAuthInternetAccount">`      |
| <span id="property-configuration">configuration</span> | `IConfigurationReference<ConfigurationSchemaType<…>>` |

</details>

<details>
<summary>GoogleDriveOAuthInternetAccount - Getters</summary>

#### getter: toggleContents

The FileSelector icon for Google drive

```ts
type toggleContents = Element
```

</details>

<details>
<summary>GoogleDriveOAuthInternetAccount - Getters (other undocumented members)</summary>

| Member                                               | Type     |
| ---------------------------------------------------- | -------- |
| <span id="getter-selectorlabel">selectorLabel</span> | `string` |

</details>

<details>
<summary>GoogleDriveOAuthInternetAccount - Methods</summary>

| Member                                             | Type                                                                                                                              |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| <span id="method-getfetcher">getFetcher</span>     | `(location?: UriLocation \| undefined) => (input: RequestInfo, init?: RequestInitWithMetadata \| undefined) => Promise<Response>` |
| <span id="method-openlocation">openLocation</span> | `(location: UriLocation) => GoogleDriveFile`                                                                                      |

</details>

<details>
<summary>GoogleDriveOAuthInternetAccount - Actions</summary>

| Member                                               | Type                                                        |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| <span id="action-validatetoken">validateToken</span> | `(token: string, location: UriLocation) => Promise<string>` |

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from OAuthInternetAccount</summary>

[OAuthInternetAccount →](../oauthinternetaccount)

**Getters**

#### getter: conf

The config typed off the concrete schema. `ConfigurationReference` erases
`self.configuration` to `any` (the reference's MST instance brand doesn't carry
the schema's slot definitions), so reads go through this getter to recover
per-slot types and slot-name validation.

```ts
type conf = ModelInstanceTypeProps<Record<…>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>
```

#### getter: state

OAuth state parameter: https://www.rfc-editor.org/rfc/rfc6749#section-4.1.1

Can override or extend if dynamic state is needed.

```ts
type state = string
```

| Member                                                     | Type                |
| ---------------------------------------------------------- | ------------------- |
| <span id="getter-codeverifierpkce">codeVerifierPKCE</span> | `string`            |
| <span id="getter-authendpoint">authEndpoint</span>         | `string`            |
| <span id="getter-tokenendpoint">tokenEndpoint</span>       | `string`            |
| <span id="getter-needspkce">needsPKCE</span>               | `boolean`           |
| <span id="getter-clientid">clientId</span>                 | `string`            |
| <span id="getter-scopes">scopes</span>                     | `string`            |
| <span id="getter-responsetype">responseType</span>         | `"code" \| "token"` |
| <span id="getter-refreshtokenkey">refreshTokenKey</span>   | `string`            |

**Methods**

| Member                                                             | Type                   |
| ------------------------------------------------------------------ | ---------------------- |
| <span id="method-retrieverefreshtoken">retrieveRefreshToken</span> | `() => string \| null` |

**Actions**

#### action: getTokenViaAuthFlow

Opens the provider's auth page and returns a promise for the resulting token.
For Electron, drives the flow directly via IPC; for web, opens a popup and waits
for the redirect message.

```ts
type getTokenViaAuthFlow = () => Promise<string>
```

| Member                                                                                           | Type                                                                                                             |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| <span id="action-storerefreshtoken">storeRefreshToken</span>                                     | `(refreshToken: string) => void`                                                                                 |
| <span id="action-removerefreshtoken">removeRefreshToken</span>                                   | `() => void`                                                                                                     |
| <span id="action-exchangeauthorizationforaccesstoken">exchangeAuthorizationForAccessToken</span> | `(code: string, redirectUri: string) => Promise<string>`                                                         |
| <span id="action-exchangerefreshforaccesstoken">exchangeRefreshForAccessToken</span>             | `(refreshToken: string) => Promise<string>`                                                                      |
| <span id="action-gettokenfromuser">getTokenFromUser</span>                                       | `(resolve: (token: string) => void, reject: (error: Error) => void) => Promise<void>`                            |
| <span id="action-getfetcher">getFetcher</span>                                                   | `(loc?: UriLocation \| undefined) => (input: RequestInfo, init?: RequestInit \| undefined) => Promise<Response>` |

</details>
