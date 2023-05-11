---
id: connectionmanagementsessionmixin
title: ConnectionManagementSessionMixin
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

## Source file

[packages/product-core/src/Session/Connections.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/Connections.ts)

## Docs

### ConnectionManagementSessionMixin - Properties

#### property: connectionInstances

```js
// type signature
IArrayType<IModelType<{ name: ISimpleType<string>; tracks: IArrayType<IAnyModelType>; configuration: ConfigurationSchemaType<{ name: { type: string; defaultValue: string; description: string; }; assemblyNames: { ...; }; }, ConfigurationSchemaOptions<...>>; }, { ...; }, _NotCustomized, _NotCustomized>>
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
({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<ConfigurationSchemaType<{ name: { type: string; defaultValue: string; description: string; }; assemblyNames: { ...; }; }, ConfigurationSchemaOptions<...>>>)[]
```

### ConnectionManagementSessionMixin - Actions

#### action: makeConnection

```js
// type signature
makeConnection: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>, initialSnapshot?: {}) => { ...; } & ... 2 more ... & IStateTreeNode<...>
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

#### action: addConnectionConf

```js
// type signature
addConnectionConf: (connectionConf: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<ConfigurationSchemaType<{ name: { type: string; defaultValue: string; description: string; }; assemblyNames: { ...; }; }, ConfigurationSchemaOptions<...>>>) => any
```

#### action: clearConnections

```js
// type signature
clearConnections: () => void
```
