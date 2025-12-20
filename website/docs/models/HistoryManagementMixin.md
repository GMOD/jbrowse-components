---
id: historymanagementmixin
title: HistoryManagementMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/HistoryManagement/index.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/HistoryManagementMixin.md)

## Docs

### HistoryManagementMixin - Properties

#### property: history

used for undo/redo

```js
// type signature
IOptionalIType<IModelType<{ undoIdx: IType<number, number, number>; targetPath: IType<string, string, string>; }, { history: PatchEntry[]; notTrackingUndo: boolean; } & { readonly canUndo: boolean; readonly canRedo: boolean; } & { ...; }, _NotCustomized, _NotCustomized>, [...]>
// code
history: types.optional(TimeTraveller, { targetPath: '../session' })
```
