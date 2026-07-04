---
id: httpbasicinternetaccount
title: HTTPBasicInternetAccount
sidebar_label: Internet Account -> HTTPBasicInternetAccount
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`authentication` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/HTTPBasicModel/model.tsx).

## Overview

### HTTPBasicInternetAccount - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/httpbasicinternetaccount).

<details>
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

<details>
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

<details>
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
