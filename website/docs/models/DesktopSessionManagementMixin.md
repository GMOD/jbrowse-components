---
id: desktopsessionmanagementmixin
title: DesktopSessionManagementMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-desktop/src/rootModel/Sessions.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/DesktopSessionManagementMixin.md)

## Docs

### DesktopSessionManagementMixin - Properties

#### property: sessionPath

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
sessionPath: types.optional(types.string, '')
```

### DesktopSessionManagementMixin - Actions

#### action: saveSession

```js
// type signature
saveSession: (val: unknown) => Promise<void>
```

#### action: activateSession

```js
// type signature
activateSession: (sessionSnapshot: ModelCreationType<ExtractCFromProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; name: ISimpleType<string>; margin: IType<number, number, number>; }>>) => void
```
