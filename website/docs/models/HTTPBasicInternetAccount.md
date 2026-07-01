---
id: httpbasicinternetaccount
title: HTTPBasicInternetAccount
sidebar_label: Internet Account -> HTTPBasicInternetAccount
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/HTTPBasicModel/model.tsx)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/HTTPBasicInternetAccount.md)

## Overview

### HTTPBasicInternetAccount - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/httpbasicinternetaccount).

<details open>
<summary>HTTPBasicInternetAccount - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                     | Signature                                 |
| ------------------------------------------ | ----------------------------------------- |
| [`type`](#property-type)                   | `ISimpleType<"HTTPBasicInternetAccount">` |
| [`configuration`](#property-configuration) | `ITypeUnion<any, any, any>`               |

</details>

<details>
<summary>HTTPBasicInternetAccount - Properties (all signatures)</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'HTTPBasicInternetAccount'>
// code
type: types.literal('HTTPBasicInternetAccount')
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
<summary>HTTPBasicInternetAccount - Getters</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                         | Signature                                                                                                                                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`conf`](#getter-conf)                         | `ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>` |
| [`validateWithHEAD`](#getter-validatewithhead) | `boolean`                                                                                                                                                                                      |

</details>

<details>
<summary>HTTPBasicInternetAccount - Getters (all signatures)</summary>

#### getter: conf

```ts
type conf = ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>
```

#### getter: validateWithHEAD

```ts
type validateWithHEAD = boolean
```

</details>

<details open>
<summary>HTTPBasicInternetAccount - Actions</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                         | Signature                                                                    |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| [`getTokenFromUser`](#action-gettokenfromuser) | `(resolve: (token: string) => void, reject: (error: Error) => void) => void` |
| [`validateToken`](#action-validatetoken)       | `(token: string, location: UriLocation) => Promise<string>`                  |

</details>

<details>
<summary>HTTPBasicInternetAccount - Actions (all signatures)</summary>

#### action: getTokenFromUser

```ts
type getTokenFromUser = (
  resolve: (token: string) => void,
  reject: (error: Error) => void,
) => void
```

#### action: validateToken

```ts
type validateToken = (token: string, location: UriLocation) => Promise<string>
```

</details>
