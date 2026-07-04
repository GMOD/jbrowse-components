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

<details>
<summary>InternetAccountsMixin - Properties</summary>

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

<details>
<summary>InternetAccountsMixin - Actions</summary>

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
