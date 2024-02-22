---
id: temporaryassembliesmixin
title: TemporaryAssembliesMixin
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[packages/app-core/src/Assemblies/TemporaryAssembliesMixin.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/Assemblies/TemporaryAssembliesMixin.ts)

### TemporaryAssembliesMixin - Properties

#### property: temporaryAssemblies

```js
// type signature
IArrayType<IType<any, any, any>>
// code
temporaryAssemblies: types.array(assemblyConfigSchemasType)
```

### TemporaryAssembliesMixin - Actions

#### action: addTemporaryAssembly

used for read vs ref type assemblies.

```js
// type signature
addTemporaryAssembly: (conf: AnyConfiguration) => any
```

#### action: removeTemporaryAssembly

```js
// type signature
removeTemporaryAssembly: (name: string) => void
```
