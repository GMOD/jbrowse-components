---
id: connectionmanagementsessionmixin
title: ConnectionManagementSessionMixin
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[packages/product-core/src/Session/Connections.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/Connections.ts)

### ConnectionManagementSessionMixin - Properties

#### property: connectionInstances

```js
// type signature
IArrayType<IModelType<{ configuration: ConfigurationSchemaType<{ assemblyNames: { defaultValue: any[]; description: string; type: string; }; name: { defaultValue: string; description: string; type: string; }; }, ConfigurationSchemaOptions<undefined, "connectionId">>; name: ISimpleType<...>; tracks: IArrayType<...>; ...
// code
connectionInstances: types.array(
        pluginManager.pluggableMstType(
          'connection',
          'stateModel',
        ) as BaseConnectionModel,
      )
```

### ConnectionManagementSessionMixin - Getters

#### getter: connections

```js
// type
({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<ConfigurationSchemaType<{ assemblyNames: { defaultValue: any[]; description: string; type: string; }; name: { ...; }; }, ConfigurationSchemaOptions<...>>>)[]
```

### ConnectionManagementSessionMixin - Actions

#### action: addConnectionConf

```js
// type signature
addConnectionConf: (connectionConf: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => any
```

#### action: breakConnection

```js
// type signature
breakConnection: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```

#### action: clearConnections

```js
// type signature
clearConnections: () => void
```

#### action: deleteConnection

```js
// type signature
deleteConnection: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => any
```

#### action: makeConnection

```js
// type signature
makeConnection: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>, initialSnapshot?: {}) => { ...; } & ... 3 more ... & IStateTreeNode<...>
```

#### action: prepareToBreakConnection

```js
// type signature
prepareToBreakConnection: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => (Record<...> | (() => void))[]
```
