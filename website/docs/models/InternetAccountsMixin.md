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

<details>
<summary>InternetAccountsMixin - Properties</summary>

#### property: internetAccounts

```js
// type signature
IArrayType<IAnyType>
// code
internetAccounts: types.array(
        pluginManager.pluggableMstType('internet account', 'stateModel'),
      )
```

</details>

<details>
<summary>InternetAccountsMixin - Actions</summary>

#### action: initializeInternetAccount

```js
// type signature
initializeInternetAccount: (internetAccountConfig: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>, initialSnapshot?: any) => any
```

#### action: createEphemeralInternetAccount

```js
// type signature
createEphemeralInternetAccount: (internetAccountId: string, initialSnapshot: Record<string, unknown>, url: string) => any
```

#### action: findAppropriateInternetAccount

```js
// type signature
findAppropriateInternetAccount: (location: UriLocation) => any
```

</details>
