---
id: basewebsession
title: BaseWebSession
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/web-core/src/BaseWebSession/index.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/BaseWebSession.md)

## Docs

used for "web based" products, including jbrowse-web and react-app composed of

- [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)
- [ThemeManagerSessionMixin](../thememanagersessionmixin)
- [MultipleViewsSessionMixin](../multipleviewssessionmixin)
- [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin)
- [AssembliesMixin](../assembliesmixin)
- [WebSessionConnectionsMixin](../websessionconnectionsmixin)

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)

**Methods:** getReferring

**Actions:** removeReferring

### Available via [ThemeManagerSessionMixin](../thememanagersessionmixin)

**Getters:** themeName, theme

**Methods:** allThemes

**Actions:** setThemeName

### Available via [MultipleViewsSessionMixin](../multipleviewssessionmixin)

**Properties:** views, stickyViewHeaders, useWorkspaces

**Actions:** moveViewDown, moveViewUp, moveViewToTop, moveViewToBottom, addView,
removeView, setStickyViewHeaders, setUseWorkspaces

### Available via [BaseSessionModel](../basesessionmodel)

**Properties:** id, name, margin, focusedViewId

**Volatiles:** selection, hovered, queueOfDialogs

**Getters:** root, jbrowse, rpcManager, configuration, adminMode,
textSearchManager, assemblies, DialogComponent, DialogProps

**Actions:** setSelection, clearSelection, setHovered, setName,
setFocusedViewId, removeActiveDialog, queueDialog

### Available via [SnackbarModel](../snackbarmodel)

**Volatiles:** snackbarMessages

**Getters:** snackbarMessageSet

**Actions:** notify, notifyError, pushSnackbarMessage, popSnackbarMessage,
removeSnackbarMessage

### Available via [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)

**Properties:** drawerPosition, drawerWidth, widgets, activeWidgets, minimized

**Getters:** visibleWidget

**Actions:** setDrawerPosition, updateDrawerWidth, resizeDrawer, addWidget,
showWidget, hideWidget, minimizeWidgetDrawer, showWidgetDrawer, hideAllWidgets,
editConfiguration

### Available via [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin)

**Properties:** sessionTracks

**Getters:** tracks

**Actions:** addTrackConf, deleteTrackConf

### Available via [AssembliesMixin](../assembliesmixin)

**Properties:** sessionAssemblies, temporaryAssemblies

**Actions:** addSessionAssembly, addAssembly, removeAssembly,
removeSessionAssembly, addTemporaryAssembly, removeTemporaryAssembly

### Available via [WebSessionConnectionsMixin](../websessionconnectionsmixin)

**Properties:** sessionConnections

**Actions:** addConnectionConf, deleteConnection

### BaseWebSession - Properties

#### property: sessionPlugins

```js
// type signature
IArrayType<IType<PluginDefinition & { name: string; }, PluginDefinition & { name: string; }, PluginDefinition & { name: string; }>>
// code
sessionPlugins: types.array(
        types.frozen<PluginDefinition & { name: string }>(),
      )
```

### BaseWebSession - Volatiles

#### volatile: sessionThemeName

```js
// type signature
string
// code
sessionThemeName: localStorageGetItem('themeName') ?? 'default'
```

#### volatile: pendingFileHandleIds

```js
// type signature
string[]
// code
pendingFileHandleIds: [] as string[]
```

### BaseWebSession - Getters

#### getter: tracks

```js
// type
(ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; } & IStateTreeNode<AnyConfigurationSchemaType>)[]
```

#### getter: root

```js
// type
WebRootModelInterface
```

#### getter: assemblies

list of sessionAssemblies and jbrowse config assemblies, does not include
temporaryAssemblies. basically the list to be displayed in a AssemblySelector
dropdown

```js
// type
(ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; } & IStateTreeNode<ConfigurationSchemaType<{ aliases: { ...; }; ... 4 more ...; displayName: { ...; }; }, ConfigurationSchemaOptions<...>>> & { ...; })[]
```

#### getter: connections

list of config connections and session connections

```js
// type
(ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; } & IStateTreeNode<ConfigurationSchemaType<{ name: { type: string; defaultValue: string; description: string; }; assemblyNames: { ...; }; }, ConfigurationSchemaOptions<...>>>)[]
```

#### getter: assemblyNames

list of sessionAssemblies and jbrowse config assemblies, does not include
temporaryAssemblies. basically the list to be displayed in a AssemblySelector
dropdown

```js
// type
string[]
```

#### getter: version

```js
// type
string
```

#### getter: shareURL

```js
// type
any
```

#### getter: textSearchManager

```js
// type
TextSearchManager
```

#### getter: assemblyManager

```js
// type
ModelInstanceTypeProps<{ assemblies: IArrayType<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: unknown; loadingP: Promise<void> | undefined; volatileRegions: BasicRegion[] | undefined; ... 4 more ...; allRefNamesWithLowerCase: Set<...> | undefined; } & ... 11 more ... & { ...; }, _NotCusto...
```

#### getter: savedSessionMetadata

```js
// type
SessionMetadata[] | undefined
```

#### getter: history

```js
// type
{ canUndo: boolean; canRedo: boolean; undo(): void; redo(): void; }
```

### BaseWebSession - Methods

#### method: renderProps

```js
// type signature
renderProps: () => {
  theme: Theme
  highResolutionScaling: any
}
```

#### method: getTrackActions

raw track actions (Settings, Copy, Delete) without submenu wrapper

```js
// type signature
getTrackActions: (config: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; } & IStateTreeNode<ConfigurationSchemaType<{ name: { ...; }; ... 9 more ...; formatAbout: ConfigurationSchemaType<...>; }, ConfigurationSchemaOptions<...>>>, view?: { ...; } | undefined) => Me...
```

#### method: getTrackListMenuItems

flattened menu items for use in hierarchical track selector

```js
// type signature
getTrackListMenuItems: (config: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; } & IStateTreeNode<ConfigurationSchemaType<{ name: { ...; }; ... 9 more ...; formatAbout: ConfigurationSchemaType<...>; }, ConfigurationSchemaOptions<...>>>, view?: { ...; } | undefined) => Me...
```

#### method: getTrackActionMenuItems

```js
// type signature
getTrackActionMenuItems: (config: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; } & IStateTreeNode<ConfigurationSchemaType<{ name: { ...; }; ... 9 more ...; formatAbout: ConfigurationSchemaType<...>; }, ConfigurationSchemaOptions<...>>>, extraTrackActions: MenuItem[] | un...
```

#### method: menus

```js
// type signature
menus: () => Menu[]
```

### BaseWebSession - Actions

#### action: addAssemblyConf

```js
// type signature
addAssemblyConf: (conf: AnyConfiguration) => void
```

#### action: addSessionPlugin

```js
// type signature
addSessionPlugin: (plugin: PluginDefinition & { name: string; }) => void
```

#### action: removeSessionPlugin

```js
// type signature
removeSessionPlugin: (pluginDefinition: PluginDefinition) => void
```

#### action: deleteSavedSession

```js
// type signature
deleteSavedSession: (id: string) => Promise<void>
```

#### action: setSavedSessionFavorite

```js
// type signature
setSavedSessionFavorite: (id: string, favorite: boolean) => Promise<void>
```

#### action: renameCurrentSession

```js
// type signature
renameCurrentSession: (sessionName: string) => void
```

#### action: activateSession

```js
// type signature
activateSession: (sessionName: string) => Promise<void>
```

#### action: setDefaultSession

```js
// type signature
setDefaultSession: () => void
```

#### action: setSession

```js
// type signature
setSession: (sessionSnapshot: ModelCreationType<ExtractCFromProps<_OverrideProps<_OverrideProps<_OverrideProps<_OverrideProps<_OverrideProps<_OverrideProps<Omit<{}, never>, _OverrideProps<_OverrideProps<Omit<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; name: ISimpleType<string>; margin: IType<...>; focusedViewId: IMa...
```

#### action: editTrackConfiguration

```js
// type signature
editTrackConfiguration: (configuration: (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; } & IStateTreeNode<AnyConfigurationSchemaType>) | { ...; }) => void
```
