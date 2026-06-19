---
id: referencemanagementsessionmixin
title: ReferenceManagementSessionMixin
sidebar_label: Mixin -> ReferenceManagementSessionMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/ReferenceManagement.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/ReferenceManagementSessionMixin.md)

## Overview

<details open>
<summary>ReferenceManagementSessionMixin - Methods</summary>

#### method: getReferring

See if any MST nodes currently have a types.reference to this object.

```ts
type getReferring = (object: IAnyStateTreeNode) => ReferringNode[]
```

#### method: getReferringMultiple

Batch version of getReferring: walks the tree once and returns a map from
trackId to referring nodes. Use this instead of calling getReferring() in a loop
to avoid O(n × treeSize) traversals.

```ts
type getReferringMultiple = (
  tracks: IAnyStateTreeNode[],
) => Map<string, ReferringNode[]>
```

</details>

<details open>
<summary>ReferenceManagementSessionMixin - Actions</summary>

#### action: removeReferring

```ts
type removeReferring = (referring: ReferringNode[], track: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>, callbacks: (() => void)[], dereferenceTypeCount: Record<...>) => void
```

</details>
