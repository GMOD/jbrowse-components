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

## Members

| Member                                               | Kind    | Defined by                      | Description                                                                                                                                                    |
| ---------------------------------------------------- | ------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [getReferringMultiple](#method-getreferringmultiple) | Methods | ReferenceManagementSessionMixin | Walk the tree once and map each requested trackId to the nodes holding a `types.reference` that resolves to it (a view's track entry, a config editor widget). |
| [getReferring](#method-getreferring)                 | Methods | ReferenceManagementSessionMixin | The nodes currently referring to `trackId` (see getReferringMultiple).                                                                                         |
| [dereferenceTrack](#action-dereferencetrack)         | Actions | ReferenceManagementSessionMixin | Remove `trackId` from every view referring to it and close any config editor widget open on it.                                                                |

<details>
<summary>ReferenceManagementSessionMixin - Methods</summary>

#### method: getReferringMultiple

Walk the tree once and map each requested trackId to the nodes holding a
`types.reference` that resolves to it (a view's track entry, a config editor
widget). Track configs are matched by trackId, not identity, so a frozen base
and its hydrated MST node compare equal.

```ts
type getReferringMultiple = (trackIds: string[]) => Map<string, ReferringNode[]>
```

#### method: getReferring

The nodes currently referring to `trackId` (see getReferringMultiple).

```ts
type getReferring = (trackId: string) => ReferringNode[]
```

</details>

<details>
<summary>ReferenceManagementSessionMixin - Actions</summary>

#### action: dereferenceTrack

Remove `trackId` from every view referring to it and close any config editor
widget open on it. Runs immediately: the walk that produced `referring` has
finished, so mutating those views here is safe.

```ts
type dereferenceTrack = (trackId: string, referring: ReferringNode[]) => void
```

</details>
