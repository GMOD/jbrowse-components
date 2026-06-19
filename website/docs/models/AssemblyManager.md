---
id: assemblymanager
title: AssemblyManager
sidebar_label: Assembly Management -> AssemblyManager
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

## Overview

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">AssemblyManager - Properties</summary>

#### property: assemblies

this is automatically managed by an autorun which looks in the parent
session.assemblies, session.sessionAssemblies, and session.temporaryAssemblies

```js
// type signature
IArrayType<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: unknown; loadingP: Promise<void> | undefined; adapterLoads: QuickLRU<string, Promise<...>>; ... 5 more ...; allRefNamesWithLowerCase: Set<...> | undefined; } & ... 11 more ... & { ...; }, _NotCustomized, _NotCustomized>>
// code
assemblies: types.array(assemblyFactory(conf, pm))
```

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">AssemblyManager - Getters</summary>

#### getter: assemblyNameMap

```js
// type
Record<string, ModelInstanceTypeProps<{ configuration: IMaybe<IReferenceType<IAnyType>>; }> & { error: unknown; loadingP: Promise<...> | undefined; ... 6 more ...; allRefNamesWithLowerCase: Set<...> | undefined; } & ... 12 more ... & IStateTreeNode<...>>
```

#### getter: assemblyNamesList

```js
// type
any[]
```

#### getter: assemblyList

combined jbrowse.assemblies, session.sessionAssemblies, and
session.temporaryAssemblies

```js
// type
(ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

#### getter: rpcManager

```js
// type
RpcManager
```

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">AssemblyManager - Methods</summary>

#### method: getCanonicalAssemblyName

```js
// type signature
getCanonicalAssemblyName: (asmName: string) => string
```

#### method: getDisplayName

```js
// type signature
getDisplayName: (asmName: string) => string
```

#### method: get

```js
// type signature
get: (asmName: string) => (ModelInstanceTypeProps<{ configuration: IMaybe<IReferenceType<IAnyType>>; }> & { error: unknown; ... 7 more ...; allRefNamesWithLowerCase: Set<...> | undefined; } & ... 12 more ... & IStateTreeNode<...>) | undefined
```

#### method: waitForAssembly

use this method instead of assemblyManager.get(assemblyName) to get an assembly
with regions loaded

```js
// type signature
waitForAssembly: (assemblyName: string) => Promise<(ModelInstanceTypeProps<{ configuration: IMaybe<IReferenceType<IAnyType>>; }> & { ...; } & ... 12 more ... & IStateTreeNode<...>) | undefined>
```

#### method: getRefNameMapForAdapter

```js
// type signature
getRefNameMapForAdapter: (adapterConf: AdapterConf, assemblyName: string | undefined, opts: AssemblyBaseOpts) => Promise<RefNameAliases | undefined>
```

#### method: isValidRefName

```js
// type signature
isValidRefName: (refName: string, assemblyName: string) => boolean
```

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">AssemblyManager - Actions</summary>

#### action: removeAssembly

private: you would generally want to add to manipulate jbrowse.assemblies,
session.sessionAssemblies, or session.temporaryAssemblies instead of using this
directly

```js
// type signature
removeAssembly: (asm: ModelInstanceTypeProps<{ configuration: IMaybe<IReferenceType<IAnyType>>; }> & { error: unknown; loadingP: Promise<void> | undefined; ... 6 more ...; allRefNamesWithLowerCase: Set<...> | undefined; } & ... 12 more ... & IStateTreeNode<...>) => void
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

</details>
