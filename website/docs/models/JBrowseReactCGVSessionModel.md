---
id: jbrowsereactcgvsessionmodel
title: JBrowseReactCGVSessionModel
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

## Source file

[products/jbrowse-react-circular-genome-view/src/createModel/createSessionModel.ts](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-circular-genome-view/src/createModel/createSessionModel.ts)

## Docs

### JBrowseReactCGVSessionModel - Properties

#### property: name

```js
// type signature
ISimpleType<string>
// code
name: types.identifier
```

#### property: view

```js
// type signature
IAnyModelType
// code
view: pluginManager.getViewType('CircularView').stateModel
```

#### property: widgets

```js
// type signature
IMapType<IAnyType>
// code
widgets: types.map(
        pluginManager.pluggableMstType('widget', 'stateModel'),
      )
```

#### property: activeWidgets

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

#### property: connectionInstances

```js
// type signature
IArrayType<IAnyType>
// code
connectionInstances: types.array(
        pluginManager.pluggableMstType('connection', 'stateModel'),
      )
```

### JBrowseReactCGVSessionModel - Getters

#### getter: DialogComponent

```js
// type
any
```

#### getter: DialogProps

```js
// type
any
```

#### getter: rpcManager

```js
// type
any
```

#### getter: configuration

```js
// type
any
```

#### getter: assemblies

```js
// type
any[]
```

#### getter: assemblyNames

```js
// type
any[]
```

#### getter: tracks

```js
// type
any
```

#### getter: aggregateTextSearchAdapters

```js
// type
any
```

#### getter: connections

```js
// type
any
```

#### getter: adminMode

```js
// type
boolean
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

#### getter: views

```js
// type
any[]
```

#### getter: visibleWidget

```js
// type
any
```

### JBrowseReactCGVSessionModel - Methods

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
getTrackActionMenuItems: (config: any) => { label: string; onClick: () => void; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; }[]
```

### JBrowseReactCGVSessionModel - Actions

#### action: queueDialog

```js
// type signature
queueDialog: (callback: (doneCallback: () => void) => [any, any]) => void
```

#### action: removeActiveDialog

```js
// type signature
removeActiveDialog: () => void
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

#### action: addView

replaces view in this case

```js
// type signature
addView: (typeName: string, initialState?: {}) => any
```

#### action: removeView

does nothing

```js
// type signature
removeView: () => void
```

#### action: addWidget

```js
// type signature
addWidget: (typeName: string, id: string, initialState?: {}, conf?: unknown) =>
  any
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

#### action: hideAllWidgets

```js
// type signature
hideAllWidgets: () => void
```

#### action: setSelection

set the global selection, i.e. the globally-selected object. can be a feature, a
view, just about anything

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

#### action: renameCurrentSession

```js
// type signature
renameCurrentSession: (sessionName: string) => any
```
