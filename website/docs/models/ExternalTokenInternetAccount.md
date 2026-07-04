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
HEAD request.

### ExternalTokenInternetAccount - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/externaltokeninternetaccount).

<details>
<summary>ExternalTokenInternetAccount - Getters</summary>

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
<summary>ExternalTokenInternetAccount - Actions</summary>

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
