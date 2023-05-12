---
id: jbrowsewebsessionassembliesmixin
title: JBrowseWebSessionAssembliesMixin
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[products/jbrowse-web/src/sessionModel/Assemblies.ts](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-web/src/sessionModel/Assemblies.ts)

### JBrowseWebSessionAssembliesMixin - Properties

#### property: sessionAssemblies

```js
// type signature
IArrayType<IType<any, any, any>>
// code
sessionAssemblies: types.array(assemblyConfigSchemasType)
```

#### property: temporaryAssemblies

```js
// type signature
IArrayType<IType<any, any, any>>
// code
temporaryAssemblies: types.array(assemblyConfigSchemasType)
```

### JBrowseWebSessionAssembliesMixin - Getters

#### getter: assemblies

```js
// type
({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>)[]
```

#### getter: assemblyNames

```js
// type
string[]
```

#### getter: assemblyManager

```js
// type
{ assemblies: IMSTArray<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: unknown; loaded: boolean; loadingP: Promise<void>; volatileRegions: BasicRegion[]; refNameAliases: RefNameAliases; lowerCaseRefNameAliases: RefNameAliases; cytobands: Feature[]; } & ... 4 more ... & { ...; }, _NotCustom...
```

### JBrowseWebSessionAssembliesMixin - Actions

#### action: addAssembly

```js
// type signature
addAssembly: (conf: AnyConfiguration) => any
```

#### action: addTemporaryAssembly

used for read vs ref type assemblies.

```js
// type signature
addTemporaryAssembly: (conf: AnyConfiguration) => any
```

#### action: addAssemblyConf

```js
// type signature
addAssemblyConf: (assemblyConf: AnyConfiguration) => any
```

#### action: removeAssembly

```js
// type signature
removeAssembly: (assemblyName: string) => void
```

#### action: removeTemporaryAssembly

```js
// type signature
removeTemporaryAssembly: (assemblyName: string) => void
```
