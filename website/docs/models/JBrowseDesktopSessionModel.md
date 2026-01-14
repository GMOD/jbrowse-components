---
id: jbrowsedesktopsessionmodel
title: JBrowseDesktopSessionModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-desktop/src/sessionModel/sessionModel.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/JBrowseDesktopSessionModel.md)

## Docs

composed of

- ReferenceManagementSessionMixin
- ConnectionManagementSessionMixin
- DrawerWidgetSessionMixin
- DialogQueueSessionMixin
- ThemeManagerSessionMixin
- TracksManagerSessionMixin
- MultipleViewsSessionMixin
- DesktopSessionMixin
- SessionAssembliesMixin
- TemporaryAssembliesMixin
- DesktopSessionTrackMenuMixin
- SnackbarModel
- AppFocusMixin

### JBrowseDesktopSessionModel - Getters

#### getter: assemblies

```js
// type
BaseAssemblyConfigSchema[]
```

#### getter: root

```js
// type
{ jbrowse: any; session: any; sessionPath: string; assemblyManager: any; internetAccounts: IMSTArray<any> & IStateTreeNode<IArrayType<any>>; history: any; jobsManager: {} & ... 5 more ... & IStateTreeNode<...>; } & ... 13 more ... & IStateTreeNode<...>
```

#### getter: assemblyNames

```js
// type
string[]
```

#### getter: version

```js
// type
any
```

#### getter: history

```js
// type
any
```

#### getter: menus

```js
// type
() => Menu[]
```

#### getter: assemblyManager

```js
// type
any
```

### JBrowseDesktopSessionModel - Methods

#### method: renderProps

```js
// type signature
renderProps: () => {
  theme: any
  highResolutionScaling: any
}
```

### JBrowseDesktopSessionModel - Actions

#### action: renameCurrentSession

```js
// type signature
renameCurrentSession: (sessionName: string) => void
```

#### action: editTrackConfiguration

```js
// type signature
editTrackConfiguration: (configuration: BaseTrackConfig) => void
```
