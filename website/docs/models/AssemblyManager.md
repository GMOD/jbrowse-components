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
<summary>AssemblyManager - Properties</summary>

#### property: assemblies

this is automatically managed by an autorun which looks in the parent
session.assemblies, session.sessionAssemblies, and session.temporaryAssemblies

```ts
// type signature
type assemblies = IArrayType<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: unknown; loadingP: Promise<void> | undefined; adapterLoads: QuickLRU<string, Promise<...>>; ... 6 more ...; allRefNamesWithLowerCase: Set<...> | undefined; } & ... 11 more ... & { ...; }, _NotCustomized, _NotCustomized>>
// code
assemblies: types.array(assemblyFactory(conf, pm))
```

</details>

<details open>
<summary>AssemblyManager - Getters</summary>

#### getter: assemblyNameMap

```ts
type assemblyNameMap = Record<string, ModelInstanceTypeProps<{ configuration: IMaybe<IReferenceType<IAnyType>>; }> & { error: unknown; loadingP: Promise<...> | undefined; ... 7 more ...; allRefNamesWithLowerCase: Set<...> | undefined; } & ... 12 more ... & IStateTreeNode<...>>
```

#### getter: assemblyNamesList

```ts
type assemblyNamesList = any[]
```

#### getter: assemblyList

combined jbrowse.assemblies, session.sessionAssemblies, and
session.temporaryAssemblies

```ts
type assemblyList = (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

#### getter: rpcManager

```ts
type rpcManager = RpcManager
```

</details>

<details open>
<summary>AssemblyManager - Methods</summary>

#### method: getCanonicalAssemblyName

```ts
type getCanonicalAssemblyName = (asmName: string) => string
```

#### method: getDisplayName

```ts
type getDisplayName = (asmName: string) => string
```

#### method: get

```ts
type get = (asmName: string) => (ModelInstanceTypeProps<{ configuration: IMaybe<IReferenceType<IAnyType>>; }> & { error: unknown; ... 8 more ...; allRefNamesWithLowerCase: Set<...> | undefined; } & ... 12 more ... & IStateTreeNode<...>) | undefined
```

#### method: waitForAssembly

use this method instead of assemblyManager.get(assemblyName) to get an assembly
with regions loaded

```ts
type waitForAssembly = (assemblyName: string) => Promise<(ModelInstanceTypeProps<{ configuration: IMaybe<IReferenceType<IAnyType>>; }> & { ...; } & ... 12 more ... & IStateTreeNode<...>) | undefined>
```

#### method: getRefNameMapForAdapter

```ts
type getRefNameMapForAdapter = (
  adapterConf: AdapterConf,
  assemblyName: string | undefined,
  opts: AssemblyBaseOpts,
) => Promise<RefNameAliases | undefined>
```

#### method: isValidRefName

```ts
type isValidRefName = (refName: string, assemblyName: string) => boolean
```

</details>

<details open>
<summary>AssemblyManager - Actions</summary>

#### action: removeAssembly

private: you would generally want to add to manipulate jbrowse.assemblies,
session.sessionAssemblies, or session.temporaryAssemblies instead of using this
directly

```ts
type removeAssembly = (asm: ModelInstanceTypeProps<{ configuration: IMaybe<IReferenceType<IAnyType>>; }> & { error: unknown; loadingP: Promise<void> | undefined; ... 7 more ...; allRefNamesWithLowerCase: Set<...> | undefined; } & ... 12 more ... & IStateTreeNode<...>) => void
```

#### action: addAssembly

private: you would generally want to add to manipulate jbrowse.assemblies,
session.sessionAssemblies, or session.temporaryAssemblies instead of using this
directly

this can take an active instance of an assembly, in which case it is referred
to, or it can take an identifier e.g. assembly name, which is used as a
reference. snapshots cannot be used

```ts
type addAssembly = (configuration: any) => void
```

</details>
