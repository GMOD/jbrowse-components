---
id: externaltokeninternetaccount
title: ExternalTokenInternetAccount
sidebar_label: Internet Account -> ExternalTokenInternetAccount
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/ExternalTokenModel/model.tsx)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/ExternalTokenInternetAccount.md)

## Overview

Internet account that authenticates requests with a user-supplied external
token, prompting for the token via a dialog and optionally validating it with a
HEAD request.

### ExternalTokenInternetAccount - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/externaltokeninternetaccount).

<details open>
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

<details open>
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
