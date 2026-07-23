---
id: historymanagementmixin
title: HistoryManagementMixin
sidebar_label: Mixin -> HistoryManagementMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/HistoryManagement/index.ts).

## Overview

## Members

| Member                       | Kind       | Defined by             | Description        |
| ---------------------------- | ---------- | ---------------------- | ------------------ |
| [history](#property-history) | Properties | HistoryManagementMixin | used for undo/redo |

<details>
<summary>HistoryManagementMixin - Properties</summary>

#### property: history

used for undo/redo

```ts
// type signature
type history = IOptionalIType<IModelType<…>, [...]>
// code
history: types.optional(TimeTraveller, { targetPath: '../session' })
```

</details>
