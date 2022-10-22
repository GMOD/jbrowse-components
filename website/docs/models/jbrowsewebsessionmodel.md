---
id: jbrowsewebsessionmodel
title: JBrowseWebSessionModel
toplevel: true
---

### Properties

#### properties: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: types.optional(types.identifier, shortid())
```

#### properties: name

```js
// type signature
ISimpleType<string>
// code
name: types.string
```

#### properties: margin

```js
// type signature
number
// code
margin: 0
```

#### properties: drawerWidth

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
drawerWidth: types.optional(
        types.refinement(types.integer, width => width >= minDrawerWidth),
        384,
      )
```

#### properties: views

```js
// type signature
IArrayType<IAnyType>
// code
views: types.array(pluginManager.pluggableMstType('view', 'stateModel'))
```

#### properties: widgets

```js
// type signature
IMapType<IAnyType>
// code
widgets: types.map(
        pluginManager.pluggableMstType('widget', 'stateModel'),
      )
```

#### properties: activeWidgets

```js
// type signature
IMapType<IMaybe<IReferenceType<IAnyType>>>
// code
activeWidgets: types.map(
        types.safeReference(
          pluginManager.pluggableMstType('widget', 'stateModel'),
        ),
      )
```

#### properties: connectionInstances

```js
// type signature
IArrayType<IAnyType>
// code
connectionInstances: types.array(
        pluginManager.pluggableMstType('connection', 'stateModel'),
      )
```

#### properties: sessionTracks

```js
// type signature
IArrayType<IAnyModelType>
// code
sessionTracks: types.array(
        pluginManager.pluggableConfigSchemaType('track'),
      )
```

#### properties: sessionConnections

```js
// type signature
IArrayType<IAnyModelType>
// code
sessionConnections: types.array(
        pluginManager.pluggableConfigSchemaType('connection'),
      )
```

#### properties: sessionAssemblies

```js
// type signature
IArrayType<IType<any, any, any>>
// code
sessionAssemblies: types.array(assemblyConfigSchemasType)
```

#### properties: temporaryAssemblies

```js
// type signature
IArrayType<IType<any, any, any>>
// code
temporaryAssemblies: types.array(assemblyConfigSchemasType)
```

#### properties: sessionPlugins

```js
// type signature
IArrayType<IType<any, any, any>>
// code
sessionPlugins: types.array(types.frozen())
```

#### properties: minimized

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
minimized: types.optional(types.boolean, false)
```

#### properties: drawerPosition

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
drawerPosition: types.optional(
        types.string,
        localStorage.getItem('drawerPosition') || 'right',
      )
```

### Getters

#### getter: DialogComponent

```js
// type
any
```

#### getter: DialogProps

```js
// type
ReactProps
```

#### getter: shareURL

```js
// type
any
```

#### getter: rpcManager

```js
// type
RpcManager
```

#### getter: configuration

```js
// type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
```

#### getter: assemblies

```js
// type
({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>)[]
```

#### getter: assemblyNames

```js
// type
string[]
```

#### getter: tracks

```js
// type
({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>)[]
```

#### getter: textSearchManager

```js
// type
TextSearchManager
```

#### getter: connections

```js
// type
({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>)[]
```

#### getter: adminMode

```js
// type
boolean
```

#### getter: savedSessions

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

#### getter: assemblyManager

```js
// type
any
```

#### getter: version

```js
// type
any
```

#### getter: visibleWidget

```js
// type
any
```

### Methods

#### method: renderProps

```js
// type signature
renderProps: () => {
  theme: any
}
```

#### method: getReferring

See if any MST nodes currently have a types.reference to this object.

```js
// type signature
getReferring: (object: IAnyStateTreeNode) => ReferringNode[]
```

#### method: getTrackActionMenuItems

```js
// type signature
getTrackActionMenuItems: (config: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => ({ ...; } | { ...; })[]
```

### Actions

#### action: setDrawerPosition

```js
// type signature
setDrawerPosition: (arg: string) => void
```

#### action: queueDialog

```js
// type signature
queueDialog: (callback: (doneCallback: () => void) => [any, ReactProps]) => void
```

#### action: setName

```js
// type signature
setName: (str: string) => void
```

#### action: addAssembly

```js
// type signature
addAssembly: (conf: AnyConfiguration) => any
```

#### action: addTemporaryAssembly

used for read vs ref type assemblies.

```js
// type signature
addTemporaryAssembly: (conf: AnyConfiguration) => any
```

#### action: addSessionPlugin

```js
// type signature
addSessionPlugin: (plugin: JBrowsePlugin) => void
```

#### action: removeAssembly

```js
// type signature
removeAssembly: (assemblyName: string) => void
```

#### action: removeTemporaryAssembly

```js
// type signature
removeTemporaryAssembly: (assemblyName: string) => void
```

#### action: removeSessionPlugin

```js
// type signature
removeSessionPlugin: (pluginDefinition: PluginDefinition) => void
```

#### action: makeConnection

```js
// type signature
makeConnection: (
  configuration: { [x: string]: any } & NonEmptyObject & {
      setSubschema(slotName: string, data: unknown): any,
    } & IStateTreeNode<AnyConfigurationSchemaType>,
  initialSnapshot?: {},
) => any
```

#### action: removeReferring

```js
// type signature
removeReferring: (referring: any, track: any, callbacks: Function[], dereferenceTypeCount: Record<string, number>) => void
```

#### action: prepareToBreakConnection

```js
// type signature
prepareToBreakConnection: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => (Record<...> | (() => void))[]
```

#### action: breakConnection

```js
// type signature
breakConnection: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```

#### action: deleteConnection

```js
// type signature
deleteConnection: (
  configuration: { [x: string]: any } & NonEmptyObject & {
      setSubschema(slotName: string, data: unknown): any,
    } & IStateTreeNode<AnyConfigurationSchemaType>,
) => any
```

#### action: updateDrawerWidth

```js
// type signature
updateDrawerWidth: (drawerWidth: number) => number
```

#### action: resizeDrawer

```js
// type signature
resizeDrawer: (distance: number) => number
```

#### action: addView

```js
// type signature
addView: (typeName: string, initialState?: {}) => any
```

#### action: removeView

```js
// type signature
removeView: (view: any) => void
```

#### action: addAssemblyConf

```js
// type signature
addAssemblyConf: (assemblyConf: AnyConfiguration) => any
```

#### action: addTrackConf

```js
// type signature
addTrackConf: (trackConf: AnyConfiguration) => any
```

#### action: deleteTrackConf

```js
// type signature
deleteTrackConf: (
  trackConf: { [x: string]: any } & NonEmptyObject & {
      setSubschema(slotName: string, data: unknown): any,
    } & IStateTreeNode<AnyConfigurationSchemaType>,
) => any
```

#### action: addConnectionConf

```js
// type signature
addConnectionConf: (connectionConf: any) => any
```

#### action: addLinearGenomeViewOfAssembly

```js
// type signature
addLinearGenomeViewOfAssembly: (assemblyName: string, initialState?: {}) => any
```

#### action: addViewOfAssembly

```js
// type signature
addViewOfAssembly: (viewType: any, assemblyName: string, initialState?: any) =>
  any
```

#### action: addViewFromAnotherView

```js
// type signature
addViewFromAnotherView: (
  viewType: string,
  otherView: any,
  initialState?: { displayedRegions?: Region[] },
) => any
```

#### action: addWidget

```js
// type signature
addWidget: (
  typeName: string,
  id: string,
  initialState?: {},
  configuration?: { type: string },
) => any
```

#### action: showWidget

```js
// type signature
showWidget: (widget: any) => void
```

#### action: hasWidget

```js
// type signature
hasWidget: (widget: any) => boolean
```

#### action: hideWidget

```js
// type signature
hideWidget: (widget: any) => void
```

#### action: minimizeWidgetDrawer

```js
// type signature
minimizeWidgetDrawer: () => void
```

#### action: showWidgetDrawer

```js
// type signature
showWidgetDrawer: () => void
```

#### action: hideAllWidgets

```js
// type signature
hideAllWidgets: () => void
```

#### action: setSelection

set the global selection, i.e. the globally-selected object.
can be a feature, a view, just about anything

```js
// type signature
setSelection: (thing: any) => void
```

#### action: clearSelection

clears the global selection

```js
// type signature
clearSelection: () => void
```

#### action: clearConnections

```js
// type signature
clearConnections: () => void
```

#### action: addSavedSession

```js
// type signature
addSavedSession: (sessionSnapshot: ModelCreationType<ExtractCFromProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; name: ISimpleType<string>; margin: IType<number, number, number>; ... 11 more ...; drawerPosition: IOptionalIType<...>; }>>) => any
```

#### action: removeSavedSession

```js
// type signature
removeSavedSession: (sessionSnapshot: any) => any
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
activateSession: (sessionName: any) => any
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
setSession: (sessionSnapshot: ModelCreationType<ExtractCFromProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; name: ISimpleType<string>; margin: IType<number, number, number>; ... 11 more ...; drawerPosition: IOptionalIType<...>; }>>) => any
```

#### action: editConfiguration

opens a configuration editor to configure the given thing,
and sets the current task to be configuring it

```js
// type signature
editConfiguration: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```

#### action: editTrackConfiguration

```js
// type signature
editTrackConfiguration: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```
