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
- [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)
- [DialogQueueSessionMixin](../dialogqueuesessionmixin)
- [ThemeManagerSessionMixin](../thememanagersessionmixin)
- [MultipleViewsSessionMixin](../multipleviewssessionmixin)
- [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin)
- [SessionAssembliesMixin](../sessionassembliesmixin)
- [TemporaryAssembliesMixin](../temporaryassembliesmixin)
- [WebSessionConnectionsMixin](../websessionconnectionsmixin)
- [AppFocusMixin](../appfocusmixin)

### BaseWebSession - Properties

#### property: margin

```js
// type signature
number
// code
margin: 0
```

#### property: sessionPlugins

```js
// type signature
IArrayType<IType<any, any, any>>
// code
sessionPlugins: types.array(
        types.frozen<PluginDefinition & { name: string }>(),
      )
```

### BaseWebSession - Getters

#### getter: tracks

```js
// type
AnyConfigurationModel[]
```

#### getter: root

```js
// type
any
```

#### getter: assemblies

list of sessionAssemblies and jbrowse config assemblies, does not include
temporaryAssemblies. basically the list to be displayed in a AssemblySelector
dropdown

```js
// type
any[]
```

#### getter: connections

list of config connections and session connections

```js
// type
BaseConnectionConfigModel[]
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
any
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
AssemblyManager
```

#### getter: savedSessionMetadata

```js
// type
any
```

#### getter: previousAutosaveId

```js
// type
any
```

#### getter: history

```js
// type
any
```

### BaseWebSession - Methods

#### method: renderProps

```js
// type signature
renderProps: () => {
  theme: any
  highResolutionScaling: any
}
```

#### method: getTrackActions

raw track actions (Settings, Copy, Delete) without submenu wrapper

```js
// type signature
getTrackActions: (config: BaseTrackConfig) => MenuItem[]
```

#### method: getTrackListMenuItems

flattened menu items for use in hierarchical track selector

```js
// type signature
getTrackListMenuItems: (config: BaseTrackConfig) => MenuItem[]
```

#### method: getTrackActionMenuItems

```js
// type signature
getTrackActionMenuItems: (config: BaseTrackConfig, extraTrackActions?: MenuItem[]) => MenuItem[]
```

#### method: menus

```js
// type signature
menus: () => Menu[]
```

### BaseWebSession - Actions

#### action: setName

```js
// type signature
setName: (str: string) => void
```

#### action: addAssemblyConf

```js
// type signature
addAssemblyConf: (conf: AnyConfiguration) => void
```

#### action: addSessionPlugin

```js
// type signature
addSessionPlugin: (plugin: any) => void
```

#### action: removeSessionPlugin

```js
// type signature
removeSessionPlugin: (pluginDefinition: PluginDefinition) => void
```

#### action: addSavedSession

```js
// type signature
addSavedSession: (sessionSnapshot: unknown) => any
```

#### action: deleteSavedSession

```js
// type signature
deleteSavedSession: (id: string) => any
```

#### action: favoriteSavedSession

```js
// type signature
favoriteSavedSession: (id: string) => any
```

#### action: unfavoriteSavedSession

```js
// type signature
unfavoriteSavedSession: (id: string) => any
```

#### action: renameCurrentSession

```js
// type signature
renameCurrentSession: (sessionName: string) => any
```

#### action: duplicateCurrentSession

```js
// type signature
duplicateCurrentSession: () => any
```

#### action: activateSession

```js
// type signature
activateSession: (sessionName: string) => any
```

#### action: setDefaultSession

```js
// type signature
setDefaultSession: () => any
```

#### action: saveSessionToLocalStorage

```js
// type signature
saveSessionToLocalStorage: () => any
```

#### action: loadAutosaveSession

```js
// type signature
loadAutosaveSession: () => any
```

#### action: setSession

```js
// type signature
setSession: (sessionSnapshot: unknown) => any
```

#### action: editTrackConfiguration

```js
// type signature
editTrackConfiguration: (configuration: any) => void
```
