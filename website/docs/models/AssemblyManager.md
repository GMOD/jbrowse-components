---
id: assemblymanager
title: AssemblyManager
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/assemblyManager/assemblyManager.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/AssemblyManager.md)

## Docs

### AssemblyManager - Properties

#### property: assemblies

this is automatically managed by an autorun which looks in the parent
session.assemblies, session.sessionAssemblies, and session.temporaryAssemblies

```js
// type signature
IArrayType<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: unknown; loadingP: Promise<void>; volatileRegions: BasicRegion[]; refNameAliases: RefNameAliases; canonicalToSeqAdapterRefNames: Record<...>; cytobands: Feature[]; } & ... 5 more ... & { ...; }, _NotCustomized, _NotCustomized>>
// code
assemblies: types.array(assemblyFactory(conf, pm))
```

### AssemblyManager - Getters

#### getter: assemblyNameMap

```js
// type
Record<string, { configuration: any; } & NonEmptyObject & { error: unknown; loadingP: Promise<void>; volatileRegions: BasicRegion[]; refNameAliases: RefNameAliases; canonicalToSeqAdapterRefNames: Record<...>; cytobands: Feature[]; } & ... 6 more ... & IStateTreeNode<...>>
```

#### getter: assemblyNamesList

```js
// type
any
```

#### getter: assemblyList

combined jbrowse.assemblies, session.sessionAssemblies, and
session.temporaryAssemblies

```js
// type
({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>)[]
```

### AssemblyManager - Methods

#### method: getCanonicalAssemblyName

```js
// type signature
getCanonicalAssemblyName: (asmName: string) => string
```

#### method: getCanonicalAssemblyName2

```js
// type signature
getCanonicalAssemblyName2: (asmName: string) => string
```

#### method: get

```js
// type signature
get: (asmName: string) => { configuration: any; } & NonEmptyObject & { error: unknown; loadingP: Promise<void>; volatileRegions: BasicRegion[]; refNameAliases: RefNameAliases; canonicalToSeqAdapterRefNames: Record<...>; cytobands: Feature[]; } & ... 6 more ... & IStateTreeNode<...>
```

#### method: waitForAssembly

use this method instead of assemblyManager.get(assemblyName) to get an assembly
with regions loaded

```js
// type signature
waitForAssembly: (assemblyName: string) => Promise<{ configuration: any; } & NonEmptyObject & { error: unknown; loadingP: Promise<void>; volatileRegions: BasicRegion[]; refNameAliases: RefNameAliases; canonicalToSeqAdapterRefNames: Record<...>; cytobands: Feature[]; } & ... 6 more ... & IStateTreeNode<...>>
```

#### method: getRefNameMapForAdapter

```js
// type signature
getRefNameMapForAdapter: (adapterConf: AdapterConf, assemblyName: string, opts: AssemblyBaseOpts) => Promise<any>
```

#### method: getReverseRefNameMapForAdapter

```js
// type signature
getReverseRefNameMapForAdapter: (adapterConf: AdapterConf, assemblyName: string, opts: AssemblyBaseOpts) => Promise<any>
```

#### method: isValidRefName

```js
// type signature
isValidRefName: (refName: string, assemblyName: string) => boolean
```

### AssemblyManager - Actions

#### action: removeAssembly

private: you would generally want to add to manipulate jbrowse.assemblies,
session.sessionAssemblies, or session.temporaryAssemblies instead of using this
directly

```js
// type signature
removeAssembly: (asm: { configuration: any; } & NonEmptyObject & { error: unknown; loadingP: Promise<void>; volatileRegions: BasicRegion[]; refNameAliases: RefNameAliases; canonicalToSeqAdapterRefNames: Record<...>; cytobands: Feature[]; } & ... 6 more ... & IStateTreeNode<...>) => void
```

#### action: addAssembly

private: you would generally want to add to manipulate jbrowse.assemblies,
session.sessionAssemblies, or session.temporaryAssemblies instead of using this
directly

this can take an active instance of an assembly, in which case it is referred
to, or it can take an identifier e.g. assembly name, which is used as a
reference. snapshots cannot be used

```js
// type signature
addAssembly: (configuration: any) => void
```
