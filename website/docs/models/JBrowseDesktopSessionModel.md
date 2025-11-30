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
ConfigurationSchemaType<{ aliases: { type: string; defaultValue: any[]; description: string; }; sequence: AnyConfigurationSchemaType; refNameColors: { type: string; defaultValue: any[]; description: string; }; refNameAliases: ConfigurationSchemaType<...>; cytobands: ConfigurationSchemaType<...>; displayName: { ...; ...
```

#### getter: root

```js
// type
{ jbrowse: any; session: any; sessionPath: string; assemblyManager: { assemblies: IMSTArray<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { ...; } & ... 5 more ... & { ...; }, _NotCustomized, _NotCustomized>> & IStateTreeNode<...>; } & ... 5 more ... & IStateTreeNode<...>; internetAccounts: IMSTAr...
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
() => Menu[]
```

#### getter: assemblyManager

```js
// type
{ assemblies: IMSTArray<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: unknown; loadingP: Promise<void>; volatileRegions: BasicRegion[]; refNameAliases: RefNameAliases; cytobands: Feature[]; } & ... 5 more ... & { ...; }, _NotCustomized, _NotCustomized>> & IStateTreeNode<...>; } & ... 5 mo...
```

### JBrowseDesktopSessionModel - Methods

#### method: renderProps

```js
// type signature
renderProps: () => {
  theme: Theme
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
editTrackConfiguration: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & { ...; } & IStateTreeNode<...>); } & IStateTreeNode<...>) => void
```
