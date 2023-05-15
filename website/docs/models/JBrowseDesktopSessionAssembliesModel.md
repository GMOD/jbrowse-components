---
id: jbrowsedesktopsessionassembliesmodel
title: JBrowseDesktopSessionAssembliesModel
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[products/jbrowse-desktop/src/sessionModel/Assemblies.ts](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-desktop/src/sessionModel/Assemblies.ts)

### JBrowseDesktopSessionAssembliesModel - Properties

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

### JBrowseDesktopSessionAssembliesModel - Getters

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

### JBrowseDesktopSessionAssembliesModel - Actions

#### action: addAssembly

```js
// type signature
addAssembly: (assemblyConfig: any) => void
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

#### action: addTemporaryAssembly

used for read vs ref type assemblies

```js
// type signature
addTemporaryAssembly: (
  assemblyConfig: { [x: string]: any } & NonEmptyObject & {
      setSubschema(slotName: string, data: unknown): any,
    } & IStateTreeNode<AnyConfigurationSchemaType>,
) => any
```

#### action: addAssemblyConf

```js
// type signature
addAssemblyConf: (
  assemblyConf: { [x: string]: any } & NonEmptyObject & {
      setSubschema(slotName: string, data: unknown): any,
    } & IStateTreeNode<AnyConfigurationSchemaType>,
) => any
```
