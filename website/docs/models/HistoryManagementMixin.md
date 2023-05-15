---
id: historymanagementmixin
title: HistoryManagementMixin
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[products/jbrowse-desktop/src/rootModel/HistoryManagement.ts](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-desktop/src/rootModel/HistoryManagement.ts)

### HistoryManagementMixin - Properties

#### property: history

used for undo/redo

```js
// type signature
IOptionalIType<IModelType<{ undoIdx: IType<number, number, number>; targetPath: IType<string, string, string>; }, { history: unknown[]; notTrackingUndo: boolean; } & { readonly canUndo: boolean; readonly canRedo: boolean; } & { ...; }, _NotCustomized, _NotCustomized>, [...]>
// code
history: types.optional(TimeTraveller, { targetPath: '../session' })
```
