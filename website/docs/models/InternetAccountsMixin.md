---
id: internetaccountsmixin
title: InternetAccountsMixin
sidebar_label: Mixin -> InternetAccountsMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/InternetAccounts.ts).

## Overview

## Members

| Member                                                                   | Kind       | Defined by            | Description |
| ------------------------------------------------------------------------ | ---------- | --------------------- | ----------- |
| [internetAccounts](#property-internetaccounts)                           | Properties | InternetAccountsMixin |             |
| [initializeInternetAccount](#action-initializeinternetaccount)           | Actions    | InternetAccountsMixin |             |
| [createEphemeralInternetAccount](#action-createephemeralinternetaccount) | Actions    | InternetAccountsMixin |             |
| [findAppropriateInternetAccount](#action-findappropriateinternetaccount) | Actions    | InternetAccountsMixin |             |

<details>
<summary>InternetAccountsMixin - Properties</summary>

| Member                                                       | Type                   |
| ------------------------------------------------------------ | ---------------------- |
| <span id="property-internetaccounts">internetAccounts</span> | `IArrayType<IAnyType>` |

</details>

<details>
<summary>InternetAccountsMixin - Actions</summary>

| Member                                                                                 | Type                                                                                                         |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| <span id="action-initializeinternetaccount">initializeInternetAccount</span>           | `(internetAccountConfig: ModelInstanceTypeProps<…> & {…} & IStateTreeNode<…>, initialSnapshot?: any) => any` |
| <span id="action-createephemeralinternetaccount">createEphemeralInternetAccount</span> | `(internetAccountId: string, initialSnapshot: Record<string, unknown>, url: string) => any`                  |
| <span id="action-findappropriateinternetaccount">findAppropriateInternetAccount</span> | `(location: UriLocation) => any`                                                                             |

</details>
