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
- DesktopSessionMixin
- SessionAssembliesMixin
- TemporaryAssembliesMixin
- DesktopSessionTrackMenuMixin
- SnackbarModel

### JBrowseDesktopSessionModel - Getters

#### getter: assemblies

```js
// type
ConfigurationSchemaType<{ aliases: { type: string; defaultValue: any[]; description: string; }; sequence: AnyConfigurationSchemaType; refNameColors: { type: string; defaultValue: any[]; description: string; }; refNameAliases: ConfigurationSchemaType<...>; cytobands: ConfigurationSchemaType<...>; displayName: { ...; ...
```

#### getter: root

```js
// type
{ jbrowse: any; session: any; sessionPath: string; assemblyManager: { assemblies: IMSTArray<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { ...; } & ... 4 more ... & { ...; }, _NotCustomized, _NotCustomized>> & IStateTreeNode<...>; } & ... 5 more ... & IStateTreeNode<...>; internetAccounts: IMSTAr...
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
{ undoIdx: number; targetPath: string; } & NonEmptyObject & { history: unknown[]; notTrackingUndo: boolean; } & { readonly canUndo: boolean; readonly canRedo: boolean; } & { stopTrackingUndo(): void; ... 5 more ...; redo(): void; } & IStateTreeNode<...>
```

#### getter: menus

```js
// type
Menu[]
```

#### getter: assemblyManager

```js
// type
{ assemblies: IMSTArray<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: unknown; loaded: boolean; loadingP: Promise<void>; volatileRegions: BasicRegion[]; refNameAliases: RefNameAliases; lowerCaseRefNameAliases: RefNameAliases; cytobands: Feature[]; } & ... 4 more ... & { ...; }, _NotCustom...
```

#### getter: savedSessionNames

```js
// type
IMSTArray<ISimpleType<string>> & IStateTreeNode<IMaybe<IArrayType<ISimpleType<string>>>>
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
renameCurrentSession: (sessionName: string) => void
```

#### action: editTrackConfiguration

```js
// type signature
editTrackConfiguration: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<ConfigurationSchemaType<{ name: { description: string; type: string; defaultValue: string; }; ... 8 more ...; formatAbout: ConfigurationSchemaType<...>; }, ConfigurationSchemaOptions<...>...
```
