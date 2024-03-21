---
id: basewebsession
title: BaseWebSession
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[packages/web-core/src/BaseWebSession/index.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/web-core/src/BaseWebSession/index.ts)

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
sessionPlugins: types.array(types.frozen())
```

### BaseWebSession - Getters

#### getter: assemblies

list of sessionAssemblies and jbrowse config assemblies, does not include
temporaryAssemblies. basically the list to be displayed in a AssemblySelector
dropdown

```js
// type
ConfigurationSchemaType<{ aliases: { defaultValue: any[]; description: string; type: string; }; cytobands: ConfigurationSchemaType<{ adapter: IAnyModelType; }, ConfigurationSchemaOptions<undefined, undefined>>; displayName: { ...; }; refNameAliases: ConfigurationSchemaType<...>; refNameColors: { ...; }; sequence: An...
```

#### getter: connections

list of config connections and session connections

```js
// type
({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<ConfigurationSchemaType<{ assemblyNames: { defaultValue: any[]; description: string; type: string; }; name: { ...; }; }, ConfigurationSchemaOptions<...>>>)[]
```

#### getter: root

```js
// type
any
```

#### getter: tracks

```js
// type
({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>)[]
```

#### getter: assemblyManager

```js
// type
{ assemblies: IMSTArray<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { cytobands: Feature[]; error: unknown; loaded: boolean; loadingP: Promise<void>; lowerCaseRefNameAliases: RefNameAliases; refNameAliases: RefNameAliases; volatileRegions: BasicRegion[]; } & ... 5 more ... & { ...; }, _NotCustom...
```

#### getter: assemblyNames

list of sessionAssemblies and jbrowse config assemblies, does not include
temporaryAssemblies. basically the list to be displayed in a AssemblySelector
dropdown

```js
// type
string[]
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

#### getter: previousAutosaveId

```js
// type
any
```

#### getter: savedSessionNames

```js
// type
any
```

#### getter: savedSessions

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

#### getter: version

```js
// type
any
```

### BaseWebSession - Methods

#### method: renderProps

```js
// type signature
renderProps: () => {
  highResolutionScaling: any
  theme: Theme
}
```

#### method: getTrackActionMenuItems

```js
// type signature
getTrackActionMenuItems: (config: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<ConfigurationSchemaType<{ adapter: IAnyModelType; assemblyNames: { defaultValue: string[]; description: string; type: string; }; ... 7 more ...; textSearching: ConfigurationSchemaType<...>; }, C...
```

### BaseWebSession - Actions

#### action: setName

```js
// type signature
setName: (str: string) => void
```

#### action: activateSession

```js
// type signature
activateSession: (sessionName: string) => any
```

#### action: addAssemblyConf

```js
// type signature
addAssemblyConf: (conf: AnyConfiguration) => void
```

#### action: addSavedSession

```js
// type signature
addSavedSession: (sessionSnapshot: ModelCreationType<ExtractCFromProps<{ activeWidgets: IMapType<IMaybe<IReferenceType<IAnyType>>>; drawerPosition: IOptionalIType<ISimpleType<string>, [undefined]>; drawerWidth: IOptionalIType<...>; minimized: IOptionalIType<...>; widgets: IMapType<...>; } & ... 8 more ... & { ...; }>>) => any
```

#### action: addSessionPlugin

```js
// type signature
addSessionPlugin: (plugin: JBrowsePlugin) => void
```

#### action: duplicateCurrentSession

```js
// type signature
duplicateCurrentSession: () => any
```

#### action: loadAutosaveSession

```js
// type signature
loadAutosaveSession: () => any
```

#### action: removeSavedSession

```js
// type signature
removeSavedSession: (sessionSnapshot: { name: string; }) => any
```

#### action: removeSessionPlugin

```js
// type signature
removeSessionPlugin: (pluginDefinition: PluginDefinition) => void
```

#### action: renameCurrentSession

```js
// type signature
renameCurrentSession: (sessionName: string) => any
```

#### action: saveSessionToLocalStorage

```js
// type signature
saveSessionToLocalStorage: () => any
```

#### action: setDefaultSession

```js
// type signature
setDefaultSession: () => any
```

#### action: setSession

```js
// type signature
setSession: (sessionSnapshot: ModelCreationType<ExtractCFromProps<{ activeWidgets: IMapType<IMaybe<IReferenceType<IAnyType>>>; drawerPosition: IOptionalIType<ISimpleType<string>, [undefined]>; drawerWidth: IOptionalIType<...>; minimized: IOptionalIType<...>; widgets: IMapType<...>; } & ... 8 more ... & { ...; }>>) => any
```

#### action: editTrackConfiguration

```js
// type signature
editTrackConfiguration: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```
