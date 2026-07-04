---
id: assembliesmixin
title: AssembliesMixin
sidebar_label: Mixin -> AssembliesMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/Assemblies/AssembliesMixin.ts).

## Overview

Adds `sessionAssemblies` (admin-aware, persisted-with-session assemblies) and
`temporaryAssemblies` (used for ad-hoc read-vs-ref style assemblies).

<details>
<summary>AssembliesMixin - Properties</summary>

#### property: sessionAssemblies

```ts
// type signature
type sessionAssemblies = IOptionalIType<IArrayType<ConfigurationSchemaType<{ aliases: { type: string; defaultValue: never[]; description: string; }; sequence: AnyConfigurationSchemaType; refNameColors: { type: string; defaultValue: never[]; description: string; }; ... 4 more ...; displayName: { ...; }; }, ConfigurationSchemaOptions<...>>>, ...
// code
sessionAssemblies: types.stripDefault(
        types.array(assemblyConfigSchemasType),
        [],
      )
```

#### property: temporaryAssemblies

```ts
// type signature
type temporaryAssemblies = IOptionalIType<IArrayType<ConfigurationSchemaType<{ aliases: { type: string; defaultValue: never[]; description: string; }; sequence: AnyConfigurationSchemaType; refNameColors: { type: string; defaultValue: never[]; description: string; }; ... 4 more ...; displayName: { ...; }; }, ConfigurationSchemaOptions<...>>>, ...
// code
temporaryAssemblies: types.stripDefault(
        types.array(assemblyConfigSchemasType),
        [],
      )
```

</details>

<details open>
<summary>AssembliesMixin - Getters</summary>

#### getter: assemblies

sessionAssemblies plus jbrowse config assemblies. Does not include
temporaryAssemblies; this is the list shown in the AssemblySelector dropdown.

```ts
type assemblies = (ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>)[]
```

#### getter: assemblyNames

names of the assemblies returned by the `assemblies` getter

```ts
type assemblyNames = string[]
```

</details>

<details open>
<summary>AssembliesMixin - Actions</summary>

#### action: addTemporaryAssembly

used for read vs ref type assemblies.

```ts
type addTemporaryAssembly = (conf: AnyConfiguration) => ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>
```

</details>

<details>
<summary>AssembliesMixin - Actions (other undocumented members)</summary>

#### action: addSessionAssembly

```ts
type addSessionAssembly = (conf: AnyConfiguration) => ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>
```

#### action: addAssembly

```ts
type addAssembly = (conf: AnyConfiguration) => void
```

#### action: removeAssembly

```ts
type removeAssembly = (name: string) => void
```

#### action: removeSessionAssembly

```ts
type removeSessionAssembly = (assemblyName: string) => void
```

#### action: removeTemporaryAssembly

```ts
type removeTemporaryAssembly = (name: string) => void
```

</details>
