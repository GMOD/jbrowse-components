---
id: websessionconnectionsmixin
title: WebSessionConnectionsMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/web-core/src/SessionConnections.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/WebSessionConnectionsMixin.md)

## Overview

### WebSessionConnectionsMixin - Properties

#### property: sessionConnections

```js
// type signature
IArrayType<IAnyModelType>
// code
sessionConnections: types.array(
          pluginManager.pluggableConfigSchemaType('connection'),
        )
```

### WebSessionConnectionsMixin - Actions

#### action: addConnectionConf

```js
// type signature
addConnectionConf: (connectionConf: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any
```

#### action: deleteConnection

```js
// type signature
deleteConnection: (configuration: ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>) => any
```
