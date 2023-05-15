---
id: jbrowsedesktopsessionmodel
title: JBrowseDesktopSessionModel
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[products/jbrowse-desktop/src/sessionModel/index.ts](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-desktop/src/sessionModel/index.ts)

composed of

- ReferenceManagementSessionMixin
- ConnectionManagementSessionMixin
- DrawerWidgetSessionMixin
- DialogQueueSessionMixin
- ThemeManagerSessionMixin
- TracksManagerSessionMixin
- MultipleViewsSessionMixin
- JBrowseDesktopSessionMixin
- JBrowseDesktopSessionAssembliesModel
- JBrowseDesktopSessionTrackMenuMixin
- SnackbarModel

### JBrowseDesktopSessionModel - Getters

#### getter: root

```js
// type
{ jbrowse: any; version: string; session: any; sessionPath: string; assemblyManager: { assemblies: IMSTArray<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { ...; } & ... 4 more ... & { ...; }, _NotCustomized, _NotCustomized>> & IStateTreeNode<...>; } & ... 4 more ... & IStateTreeNode<...>; interne...
```

#### getter: history

```js
// type
any
```

#### getter: menus

```js
// type
any
```

#### getter: savedSessionNames

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
}
```

### JBrowseDesktopSessionModel - Actions

#### action: renameCurrentSession

```js
// type signature
renameCurrentSession: (sessionName: string) => Promise<void>
```

#### action: editTrackConfiguration

```js
// type signature
editTrackConfiguration: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<ConfigurationSchemaType<{ name: { description: string; type: string; defaultValue: string; }; ... 8 more ...; formatAbout: ConfigurationSchemaType<...>; }, ConfigurationSchemaOptions<...>...
```
