---
id: referencemanagementsessionmixin
title: ReferenceManagementSessionMixin
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

## Source file

[packages/product-core/src/Session/ReferenceManagement.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/Session/ReferenceManagement.ts)

## Docs

### ReferenceManagementSessionMixin - Methods

#### method: getReferring

See if any MST nodes currently have a types.reference to this object.

```js
// type signature
getReferring: (object: IAnyStateTreeNode) => ReferringNode[]
```

### ReferenceManagementSessionMixin - Actions

#### action: removeReferring

```js
// type signature
removeReferring: (referring: ReferringNode[], track: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<ConfigurationSchemaType<{ name: { description: string; type: string; defaultValue: string; }; ... 8 more ...; formatAbout: ConfigurationSchemaType<...>; }, Configurati...
```
