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

| Member                                                       | Kind       | Defined by      | Description                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------ | ---------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [assemblies](#property-assemblies)                           | Properties | AssemblyManager | this is automatically managed by an autorun which looks in the parent session.assemblies, session.sessionAssemblies, and session.temporaryAssemblies                                                                                                                                                                                 |
| [assemblyNameMap](#getter-assemblynamemap)                   | Getters    | AssemblyManager |                                                                                                                                                                                                                                                                                                                                      |
| [assemblyNamesList](#getter-assemblynameslist)               | Getters    | AssemblyManager | read via readConfObject, matching how the afterAttach autorun names the assemblies it creates: get() treats a name found here as "a config exists, its model is just not built yet", so the two must agree                                                                                                                           |
| [assemblyList](#getter-assemblylist)                         | Getters    | AssemblyManager | combined jbrowse.assemblies, session.sessionAssemblies, and session.temporaryAssemblies                                                                                                                                                                                                                                              |
| [rpcManager](#getter-rpcmanager)                             | Getters    | AssemblyManager |                                                                                                                                                                                                                                                                                                                                      |
| [getCanonicalAssemblyName](#method-getcanonicalassemblyname) | Methods    | AssemblyManager |                                                                                                                                                                                                                                                                                                                                      |
| [getDisplayName](#method-getdisplayname)                     | Methods    | AssemblyManager |                                                                                                                                                                                                                                                                                                                                      |
| [get](#method-get)                                           | Methods    | AssemblyManager |                                                                                                                                                                                                                                                                                                                                      |
| [waitForAssembly](#method-waitforassembly)                   | Methods    | AssemblyManager | use this method instead of assemblyManager.get(assemblyName) to get an assembly with regions loaded                                                                                                                                                                                                                                  |
| [getRefNameMapForAdapter](#method-getrefnamemapforadapter)   | Methods    | AssemblyManager |                                                                                                                                                                                                                                                                                                                                      |
| [isValidRefName](#method-isvalidrefname)                     | Methods    | AssemblyManager |                                                                                                                                                                                                                                                                                                                                      |
| [removeAssembly](#action-removeassembly)                     | Actions    | AssemblyManager | private: you would generally want to add to manipulate jbrowse.assemblies, session.sessionAssemblies, or session.temporaryAssemblies instead of using this directly                                                                                                                                                                  |
| [addAssembly](#action-addassembly)                           | Actions    | AssemblyManager | private: you would generally want to add to manipulate jbrowse.assemblies, session.sessionAssemblies, or session.temporaryAssemblies instead of using this directly this can take an active instance of an assembly, in which case it is referred to, or it can take an identifier e.g. assembly name, which is used as a reference. |

<details>
<summary>AssemblyManager - Properties</summary>

#### property: assemblies

this is automatically managed by an autorun which looks in the parent
session.assemblies, session.sessionAssemblies, and session.temporaryAssemblies

```ts
// type signature
type assemblies = IArrayType<IModelType<…>>
// code
assemblies: types.array(assemblyFactory(conf, pm))
```

</details>

<details>
<summary>AssemblyManager - Getters</summary>

#### getter: assemblyNamesList

read via readConfObject, matching how the afterAttach autorun names the
assemblies it creates: get() treats a name found here as "a config exists, its
model is just not built yet", so the two must agree

```ts
type assemblyNamesList = string[]
```

#### getter: assemblyList

combined jbrowse.assemblies, session.sessionAssemblies, and
session.temporaryAssemblies

```ts
type assemblyList = (ModelInstanceTypeProps<…> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

</details>

<details>
<summary>AssemblyManager - Getters (other undocumented members)</summary>

| Member                                                   | Type         |
| -------------------------------------------------------- | ------------ |
| <span id="getter-assemblynamemap">assemblyNameMap</span> | `Record<…>`  |
| <span id="getter-rpcmanager">rpcManager</span>           | `RpcManager` |

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

| Member                                                                     | Type                                                                                                               |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| <span id="method-getcanonicalassemblyname">getCanonicalAssemblyName</span> | `(asmName: string) => string`                                                                                      |
| <span id="method-getdisplayname">getDisplayName</span>                     | `(asmName: string) => string`                                                                                      |
| <span id="method-get">get</span>                                           | `(asmName: string) => (ModelInstanceTypeProps<…> & {…} & ... 12 more ... & IStateTreeNode<…>) \| undefined`        |
| <span id="method-getrefnamemapforadapter">getRefNameMapForAdapter</span>   | `(adapterConf: AdapterConf, assemblyName: string \| undefined, opts: AssemblyBaseOpts) => Promise<RefNameAliases>` |
| <span id="method-isvalidrefname">isValidRefName</span>                     | `(refName: string, assemblyName: string) => boolean`                                                               |

</details>

<details>
<summary>AssemblyManager - Actions</summary>

#### action: removeAssembly

private: you would generally want to add to manipulate jbrowse.assemblies,
session.sessionAssemblies, or session.temporaryAssemblies instead of using this
directly

```ts
type removeAssembly = (asm: ModelInstanceTypeProps<…> & {…} & ... 12 more ... & IStateTreeNode<…>) => void
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
