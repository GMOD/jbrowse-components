---
id: referencemanagementsessionmixin
title: ReferenceManagementSessionMixin
sidebar_label: Mixin -> ReferenceManagementSessionMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/ReferenceManagement.ts).

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

<details>
<summary>ReferenceManagementSessionMixin - Actions</summary>

#### action: removeReferring

```ts
type removeReferring = (referring: ReferringNode[], track: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>, callbacks: (() => void)[], dereferenceTypeCount: Record<...>) => void
```

</details>
