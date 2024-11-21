---
id: assemblymanager
title: AssemblyManager
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[packages/core/assemblyManager/assemblyManager.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/assemblyManager/assemblyManager.ts)

### AssemblyManager - Properties

#### property: assemblies

this is automatically managed by an autorun which looks in the parent
session.assemblies, session.sessionAssemblies, and session.temporaryAssemblies

```js
// type signature
IArrayType<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: unknown; loadingP: Promise<void> | undefined; volatileRegions: BasicRegion[] | undefined; refNameAliases: RefNameAliases | undefined; lowerCaseRefNameAliases: RefNameAliases | undefined; cytobands: Feature[] | undefined; } & ... 5 m...
// code
assemblies: types.array(assemblyFactory(conf, pm))
```

### AssemblyManager - Getters

#### getter: assemblyNamesList

```js
// type
any
```

#### getter: assemblyList

looks at jbrowse.assemblies, session.sessionAssemblies, and
session.temporaryAssemblies to load from

```js
// type
({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>)[]
```

### AssemblyManager - Methods

#### method: get

```js
// type signature
get: (asmName: string) => { configuration: any; } & NonEmptyObject & { error: unknown; loadingP: Promise<void> | undefined; volatileRegions: BasicRegion[] | undefined; refNameAliases: RefNameAliases | undefined; lowerCaseRefNameAliases: RefNameAliases | undefined; cytobands: Feature[] | undefined; } & ... 6 more ... & IS...
```

#### method: waitForAssembly

use this method instead of assemblyManager.get(assemblyName) to get an assembly
with regions loaded

```js
// type signature
waitForAssembly: (assemblyName: string) => Promise<{ configuration: any; } & NonEmptyObject & { error: unknown; loadingP: Promise<void> | undefined; volatileRegions: BasicRegion[] | undefined; refNameAliases: RefNameAliases | undefined; lowerCaseRefNameAliases: RefNameAliases | undefined; cytobands: Feature[] | undefined; } & ... 6 ...
```

#### method: getRefNameMapForAdapter

```js
// type signature
getRefNameMapForAdapter: (adapterConf: AdapterConf, assemblyName: string, opts: { signal?: AbortSignal; sessionId: string; }) => Promise<any>
```

#### method: getReverseRefNameMapForAdapter

```js
// type signature
getReverseRefNameMapForAdapter: (adapterConf: AdapterConf, assemblyName: string, opts: { signal?: AbortSignal; sessionId: string; }) => Promise<any>
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
removeAssembly: (asm: { configuration: any; } & NonEmptyObject & { error: unknown; loadingP: Promise<void> | undefined; volatileRegions: BasicRegion[] | undefined; refNameAliases: RefNameAliases | undefined; lowerCaseRefNameAliases: RefNameAliases | undefined; cytobands: Feature[] | undefined; } & ... 6 more ... & IStateTreeNode<.....
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
