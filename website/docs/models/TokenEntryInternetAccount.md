---
id: tokenentryinternetaccount
title: TokenEntryInternetAccount
sidebar_label: Internet Account -> TokenEntryInternetAccount
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`authentication` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/tokenEntryModelFactory.ts).

## Overview

Shared base for internet accounts whose token is supplied by the user through a
dialog (HTTP Basic, external token). Such accounts differ only in their
discriminating `type` and the dialog form used to collect the token, both passed
here. Not registered on its own — see HTTPBasicInternetAccount and
ExternalTokenInternetAccount.

## Members

| Member                                       | Kind       | Defined by                | Description                                                                                                                   |
| -------------------------------------------- | ---------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                       | Properties | TokenEntryInternetAccount |                                                                                                                               |
| [configuration](#property-configuration)     | Properties | TokenEntryInternetAccount |                                                                                                                               |
| [validateWithHEAD](#getter-validatewithhead) | Getters    | TokenEntryInternetAccount | validate the token with a HEAD request before it is used                                                                      |
| [getTokenFromUser](#action-gettokenfromuser) | Actions    | TokenEntryInternetAccount | Prompt the user for a token via the account's dialog form, resolving with the entered token or rejecting if the user cancels. |
| [validateToken](#action-validatetoken)       | Actions    | TokenEntryInternetAccount | Optionally validate the token with a HEAD request before use, per the `validateWithHEAD` config slot.                         |

<details>
<summary>TokenEntryInternetAccount - Properties</summary>

| Member                                                 | Type                                                  |
| ------------------------------------------------------ | ----------------------------------------------------- |
| <span id="property-type">type</span>                   | `ISimpleType<Type>`                                   |
| <span id="property-configuration">configuration</span> | `IConfigurationReference<AnyConfigurationSchemaType>` |

</details>

<details>
<summary>TokenEntryInternetAccount - Getters</summary>

#### getter: validateWithHEAD

validate the token with a HEAD request before it is used

```ts
type validateWithHEAD = boolean
```

</details>

<details>
<summary>TokenEntryInternetAccount - Actions</summary>

#### action: getTokenFromUser

Prompt the user for a token via the account's dialog form, resolving with the
entered token or rejecting if the user cancels.

```ts
type getTokenFromUser = (
  resolve: (token: string) => void,
  reject: (error: Error) => void,
) => void
```

#### action: validateToken

Optionally validate the token with a HEAD request before use, per the
`validateWithHEAD` config slot.

```ts
type validateToken = (token: string, location: UriLocation) => Promise<string>
```

</details>
