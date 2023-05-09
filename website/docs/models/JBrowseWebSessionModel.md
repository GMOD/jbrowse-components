---
id: jbrowsewebsessionmodel
title: JBrowseWebSessionModel
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

## Source file

[products/jbrowse-web/src/sessionModel/index.ts](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-web/src/sessionModel/index.ts)

## Docs

inherits SnackbarModel

### JBrowseWebSessionModel - Properties

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

### JBrowseWebSessionModel - Getters

#### getter: tracks

```js
// type
({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>)[]
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

#### getter: version

```js
// type
any
```

### JBrowseWebSessionModel - Methods

#### method: renderProps

```js
// type signature
renderProps: () => {
  theme: Theme
}
```

#### method: getTrackActionMenuItems

```js
// type signature
getTrackActionMenuItems: (config: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<ConfigurationSchemaType<{ name: { description: string; type: string; defaultValue: string; }; ... 8 more ...; formatAbout: ConfigurationSchemaType<...>; }, ConfigurationSchemaOptions<...>>>) => ...
```

### JBrowseWebSessionModel - Actions

#### action: setName

```js
// type signature
setName: (str: string) => void
```

#### action: addSessionPlugin

```js
// type signature
addSessionPlugin: (plugin: JBrowsePlugin) => void
```

#### action: removeSessionPlugin

```js
// type signature
removeSessionPlugin: (pluginDefinition: PluginDefinition) => void
```

#### action: addSavedSession

```js
// type signature
addSavedSession: (sessionSnapshot: ModelCreationType<ExtractCFromProps<{ drawerPosition: IOptionalIType<ISimpleType<string>, [undefined]>; drawerWidth: IOptionalIType<ISimpleType<number>, [undefined]>; widgets: IMapType<...>; activeWidgets: IMapType<...>; minimized: IOptionalIType<...>; } & ... 6 more ... & { ...; }>>) => void
```

#### action: removeSavedSession

```js
// type signature
removeSavedSession: (sessionSnapshot: any) => void
```

#### action: renameCurrentSession

```js
// type signature
renameCurrentSession: (sessionName: string) => Promise<void>
```

#### action: duplicateCurrentSession

```js
// type signature
duplicateCurrentSession: () => void
```

#### action: activateSession

```js
// type signature
activateSession: (sessionName: any) => void
```

#### action: setDefaultSession

```js
// type signature
setDefaultSession: () => void
```

#### action: saveSessionToLocalStorage

```js
// type signature
saveSessionToLocalStorage: () => void
```

#### action: loadAutosaveSession

```js
// type signature
loadAutosaveSession: () => void
```

#### action: setSession

```js
// type signature
setSession: (sessionSnapshot: ModelCreationType<ExtractCFromProps<{ drawerPosition: IOptionalIType<ISimpleType<string>, [undefined]>; drawerWidth: IOptionalIType<ISimpleType<number>, [undefined]>; widgets: IMapType<...>; activeWidgets: IMapType<...>; minimized: IOptionalIType<...>; } & ... 6 more ... & { ...; }>>) => void
```

#### action: editTrackConfiguration

```js
// type signature
editTrackConfiguration: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```
