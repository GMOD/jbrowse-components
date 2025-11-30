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
({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & { ...; } & IStateTreeNode<...>); } & IStateTreeNode<...>)[]
```

### ConnectionManagementSessionMixin - Actions

#### action: makeConnection

```js
// type signature
makeConnection: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>, initialSnapshot?: {}) => any
```

#### action: prepareToBreakConnection

```js
// type signature
prepareToBreakConnection: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>) => (Record<...> | (() => void))[]
```

#### action: breakConnection

```js
// type signature
breakConnection: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>) => void
```

#### action: deleteConnection

```js
// type signature
deleteConnection: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>) => any
```

#### action: addConnectionConf

```js
// type signature
addConnectionConf: (connectionConf: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>) => any
```

#### action: clearConnections

```js
// type signature
clearConnections: () => void
```
