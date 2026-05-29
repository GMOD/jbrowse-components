---
id: connectionmanagementsessionmixin
title: ConnectionManagementSessionMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/Connections.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/ConnectionManagementSessionMixin.md)

## Docs

### ConnectionManagementSessionMixin - Properties

#### property: connectionInstances

```js
// type signature
IArrayType<IAnyType>
// code
connectionInstances: types.array(
        pluginManager.pluggableMstType('connection', 'stateModel'),
      )
```

### ConnectionManagementSessionMixin - Getters

#### getter: connections

```js
// type
(ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; } & IStateTreeNode<ConfigurationSchemaType<{ name: { type: string; defaultValue: string; description: string; }; assemblyNames: { ...; }; }, ConfigurationSchemaOptions<...>>>)[]
```

### ConnectionManagementSessionMixin - Actions

#### action: makeConnection

```js
// type signature
makeConnection: (configuration: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; } & IStateTreeNode<AnyConfigurationSchemaType>, initialSnapshot?: any) => any
```

#### action: prepareToBreakConnection

```js
// type signature
prepareToBreakConnection: (configuration: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => [...] | undefined
```

#### action: breakConnection

```js
// type signature
breakConnection: (configuration: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```

#### action: deleteConnection

```js
// type signature
deleteConnection: (configuration: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => any
```

#### action: addConnectionConf

```js
// type signature
addConnectionConf: (connectionConf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => any
```

#### action: clearConnections

```js
// type signature
clearConnections: () => void
```
