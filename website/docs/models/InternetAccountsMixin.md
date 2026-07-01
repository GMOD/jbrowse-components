---
id: internetaccountsmixin
title: InternetAccountsMixin
sidebar_label: Mixin -> InternetAccountsMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/InternetAccounts.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/InternetAccountsMixin.md)

## Overview

<details open>
<summary>InternetAccountsMixin - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                           | Signature              |
| ------------------------------------------------ | ---------------------- |
| [`internetAccounts`](#property-internetaccounts) | `IArrayType<IAnyType>` |

</details>

<details>
<summary>InternetAccountsMixin - Properties (all signatures)</summary>

#### property: internetAccounts

```ts
// type signature
type internetAccounts = IArrayType<IAnyType>
// code
internetAccounts: types.array(
  pluginManager.pluggableMstType('internet account', 'stateModel'),
)
```

</details>

<details open>
<summary>InternetAccountsMixin - Actions</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                                     | Signature                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`initializeInternetAccount`](#action-initializeinternetaccount)           | `(internetAccountConfig: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>, initialSnapshot?: any) => any` |
| [`createEphemeralInternetAccount`](#action-createephemeralinternetaccount) | `(internetAccountId: string, initialSnapshot: Record<string, unknown>, url: string) => any`                                                                                                                                                           |
| [`findAppropriateInternetAccount`](#action-findappropriateinternetaccount) | `(location: UriLocation) => any`                                                                                                                                                                                                                      |

</details>

<details>
<summary>InternetAccountsMixin - Actions (all signatures)</summary>

#### action: initializeInternetAccount

```ts
type initializeInternetAccount = (internetAccountConfig: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>, initialSnapshot?: any) => any
```

#### action: createEphemeralInternetAccount

```ts
type createEphemeralInternetAccount = (
  internetAccountId: string,
  initialSnapshot: Record<string, unknown>,
  url: string,
) => any
```

#### action: findAppropriateInternetAccount

```ts
type findAppropriateInternetAccount = (location: UriLocation) => any
```

</details>
