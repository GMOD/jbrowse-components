---
id: jbrowsewebsessionconnectionsmixin
title: JBrowseWebSessionConnectionsMixin
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[products/jbrowse-web/src/sessionModel/SessionConnections.ts](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-web/src/sessionModel/SessionConnections.ts)

### JBrowseWebSessionConnectionsMixin - Properties

#### property: sessionConnections

```js
// type signature
IArrayType<IAnyModelType>
// code
sessionConnections: types.array(
          pluginManager.pluggableConfigSchemaType('connection'),
        )
```
