---
id: websessionconnectionsmixin
title: WebSessionConnectionsMixin
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[packages/web-core/src/SessionConnections.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/web-core/src/SessionConnections.ts)

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
