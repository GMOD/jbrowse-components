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

<details open>
<summary>HTTPBasicInternetAccount - Properties</summary>

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
