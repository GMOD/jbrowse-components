---
id: externaltokeninternetaccount
title: ExternalTokenInternetAccount
sidebar_label: Internet Account -> ExternalTokenInternetAccount
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`authentication` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/ExternalTokenModel/model.tsx).

## Overview

Internet account that authenticates requests with a user-supplied external
token, prompting for the token via a dialog and optionally validating it with a
HEAD request. See [TokenEntryInternetAccount](../tokenentryinternetaccount) for
the shared behavior.

## Members

| Member                                       | Kind       | Defined by                                                | Description                                                                                                                   |
| -------------------------------------------- | ---------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                       | Properties | [TokenEntryInternetAccount](../tokenentryinternetaccount) |                                                                                                                               |
| [configuration](#property-configuration)     | Properties | [TokenEntryInternetAccount](../tokenentryinternetaccount) |                                                                                                                               |
| [validateWithHEAD](#getter-validatewithhead) | Getters    | [TokenEntryInternetAccount](../tokenentryinternetaccount) | validate the token with a HEAD request before it is used                                                                      |
| [getTokenFromUser](#action-gettokenfromuser) | Actions    | [TokenEntryInternetAccount](../tokenentryinternetaccount) | Prompt the user for a token via the account's dialog form, resolving with the entered token or rejecting if the user cancels. |
| [validateToken](#action-validatetoken)       | Actions    | [TokenEntryInternetAccount](../tokenentryinternetaccount) | Optionally validate the token with a HEAD request before use, per the `validateWithHEAD` config slot.                         |

### ExternalTokenInternetAccount - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/externaltokeninternetaccount).

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from TokenEntryInternetAccount</summary>

[TokenEntryInternetAccount →](../tokenentryinternetaccount)

**Properties**

| Member                                                 | Type                                                  |
| ------------------------------------------------------ | ----------------------------------------------------- |
| <span id="property-type">type</span>                   | `ISimpleType<Type>`                                   |
| <span id="property-configuration">configuration</span> | `IConfigurationReference<AnyConfigurationSchemaType>` |

**Getters**

#### getter: validateWithHEAD

validate the token with a HEAD request before it is used

```ts
type validateWithHEAD = boolean
```

**Actions**

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
