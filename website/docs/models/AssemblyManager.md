---
id: assemblymanager
title: AssemblyManager
sidebar_label: Assembly Management -> AssemblyManager
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/assemblyManager/assemblyManager.ts).

## Overview

## Members

| Member                                                       | Kind       | Defined by      | Description                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------ | ---------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [assemblies](#property-assemblies)                           | Properties | AssemblyManager | this is automatically managed by an autorun which looks in the parent session.assemblies, session.sessionAssemblies, and session.temporaryAssemblies                                                                                                                                                                                                          |
| [assemblyNameMap](#getter-assemblynamemap)                   | Getters    | AssemblyManager |                                                                                                                                                                                                                                                                                                                                                               |
| [assemblyNamesList](#getter-assemblynameslist)               | Getters    | AssemblyManager |                                                                                                                                                                                                                                                                                                                                                               |
| [assemblyList](#getter-assemblylist)                         | Getters    | AssemblyManager | combined jbrowse.assemblies, session.sessionAssemblies, and session.temporaryAssemblies                                                                                                                                                                                                                                                                       |
| [rpcManager](#getter-rpcmanager)                             | Getters    | AssemblyManager |                                                                                                                                                                                                                                                                                                                                                               |
| [getCanonicalAssemblyName](#method-getcanonicalassemblyname) | Methods    | AssemblyManager |                                                                                                                                                                                                                                                                                                                                                               |
| [getDisplayName](#method-getdisplayname)                     | Methods    | AssemblyManager |                                                                                                                                                                                                                                                                                                                                                               |
| [get](#method-get)                                           | Methods    | AssemblyManager |                                                                                                                                                                                                                                                                                                                                                               |
| [waitForAssembly](#method-waitforassembly)                   | Methods    | AssemblyManager | use this method instead of assemblyManager.get(assemblyName) to get an assembly with regions loaded                                                                                                                                                                                                                                                           |
| [getRefNameMapForAdapter](#method-getrefnamemapforadapter)   | Methods    | AssemblyManager |                                                                                                                                                                                                                                                                                                                                                               |
| [isValidRefName](#method-isvalidrefname)                     | Methods    | AssemblyManager |                                                                                                                                                                                                                                                                                                                                                               |
| [removeAssembly](#action-removeassembly)                     | Actions    | AssemblyManager | private: you would generally want to add to manipulate jbrowse.assemblies, session.sessionAssemblies, or session.temporaryAssemblies instead of using this directly                                                                                                                                                                                           |
| [addAssembly](#action-addassembly)                           | Actions    | AssemblyManager | private: you would generally want to add to manipulate jbrowse.assemblies, session.sessionAssemblies, or session.temporaryAssemblies instead of using this directly this can take an active instance of an assembly, in which case it is referred to, or it can take an identifier e.g. assembly name, which is used as a reference. snapshots cannot be used |

<details>
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

<details>
<summary>AssemblyManager - Getters</summary>

#### getter: assemblyList

combined jbrowse.assemblies, session.sessionAssemblies, and
session.temporaryAssemblies

```ts
type assemblyList = (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

</details>

<details>
<summary>AssemblyManager - Getters (other undocumented members)</summary>

#### getter: assemblyNameMap

```ts
type assemblyNameMap = Record<string, ModelInstanceTypeProps<{ configuration: IMaybe<IReferenceType<IAnyType>>; }> & { error: unknown; loadingP: Promise<...> | undefined; ... 7 more ...; allRefNamesWithLowerCase: Set<...> | undefined; } & ... 12 more ... & IStateTreeNode<...>>
```

#### getter: assemblyNamesList

```ts
type assemblyNamesList = any[]
```

#### getter: rpcManager

```ts
type rpcManager = RpcManager
```

</details>

<details>
<summary>AssemblyManager - Methods</summary>

#### method: waitForAssembly

use this method instead of assemblyManager.get(assemblyName) to get an assembly
with regions loaded

```ts
type waitForAssembly = (assemblyName: string) => Promise<(ModelInstanceTypeProps<{ configuration: IMaybe<IReferenceType<IAnyType>>; }> & { ...; } & ... 12 more ... & IStateTreeNode<...>) | undefined>
```

</details>

<details>
<summary>AssemblyManager - Methods (other undocumented members)</summary>

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

#### method: getRefNameMapForAdapter

```ts
type getRefNameMapForAdapter = (
  adapterConf: AdapterConf,
  assemblyName: string | undefined,
  opts: AssemblyBaseOpts,
) => Promise<RefNameAliases>
```

#### method: isValidRefName

```ts
type isValidRefName = (refName: string, assemblyName: string) => boolean
```

</details>

<details>
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
