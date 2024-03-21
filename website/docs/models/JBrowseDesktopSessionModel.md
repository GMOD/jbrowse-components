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
- AppFocusMixin

### JBrowseDesktopSessionModel - Getters

#### getter: assemblies

```js
// type
ConfigurationSchemaType<{ aliases: { defaultValue: any[]; description: string; type: string; }; cytobands: ConfigurationSchemaType<{ adapter: IAnyModelType; }, ConfigurationSchemaOptions<undefined, undefined>>; displayName: { ...; }; refNameAliases: ConfigurationSchemaType<...>; refNameColors: { ...; }; sequence: An...
```

#### getter: root

```js
// type
{ assemblyManager: { assemblies: IMSTArray<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { cytobands: Feature[]; error: unknown; loaded: boolean; loadingP: Promise<...>; lowerCaseRefNameAliases: RefNameAliases; refNameAliases: RefNameAliases; volatileRegions: BasicRegion[]; } & ... 5 more ... & { ...
```

#### getter: assemblyManager

```js
// type
{ assemblies: IMSTArray<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { cytobands: Feature[]; error: unknown; loaded: boolean; loadingP: Promise<void>; lowerCaseRefNameAliases: RefNameAliases; refNameAliases: RefNameAliases; volatileRegions: BasicRegion[]; } & ... 5 more ... & { ...; }, _NotCustom...
```

#### getter: assemblyNames

```js
// type
string[]
```

#### getter: history

```js
// type
{ targetPath: string; undoIdx: number; } & NonEmptyObject & { history: unknown[]; notTrackingUndo: boolean; } & { readonly canRedo: boolean; readonly canUndo: boolean; } & { addUndoState(todos: unknown): void; ... 5 more ...; undo(): void; } & IStateTreeNode<...>
```

#### getter: menus

```js
// type
Menu[]
```

#### getter: savedSessionNames

```js
// type
IMSTArray<ISimpleType<string>> & IStateTreeNode<IMaybe<IArrayType<ISimpleType<string>>>>
```

#### getter: version

```js
// type
any
```

### JBrowseDesktopSessionModel - Methods

#### method: renderProps

```js
// type signature
renderProps: () => {
  highResolutionScaling: any
  theme: any
}
```

### JBrowseDesktopSessionModel - Actions

#### action: editTrackConfiguration

```js
// type signature
editTrackConfiguration: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<ConfigurationSchemaType<{ adapter: IAnyModelType; assemblyNames: { defaultValue: string[]; description: string; type: string; }; ... 7 more ...; textSearching: ConfigurationSchemaType<......
```

#### action: renameCurrentSession

```js
// type signature
renameCurrentSession: (sessionName: string) => void
```
