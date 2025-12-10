---
id: temporaryassembliesmixin
title: TemporaryAssembliesMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/Assemblies/TemporaryAssembliesMixin.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/TemporaryAssembliesMixin.md)

## Docs

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
