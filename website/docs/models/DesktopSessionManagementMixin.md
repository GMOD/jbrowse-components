---
id: desktopsessionmanagementmixin
title: DesktopSessionManagementMixin
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[products/jbrowse-desktop/src/rootModel/Sessions.ts](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-desktop/src/rootModel/Sessions.ts)

### DesktopSessionManagementMixin - Properties

#### property: savedSessionNames

```js
// type signature
IMaybe<IArrayType<ISimpleType<string>>>
// code
savedSessionNames: types.maybe(types.array(types.string))
```

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

#### action: duplicateCurrentSession

```js
// type signature
duplicateCurrentSession: () => void
```

#### action: activateSession

```js
// type signature
activateSession: (sessionSnapshot: ModelCreationType<ExtractCFromProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; name: ISimpleType<string>; margin: IType<number, number, number>; }>>) => void
```
