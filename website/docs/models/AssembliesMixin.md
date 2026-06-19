---
id: assembliesmixin
title: AssembliesMixin
sidebar_label: Mixin -> AssembliesMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/Assemblies/AssembliesMixin.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/AssembliesMixin.md)

## Overview

Adds `sessionAssemblies` (admin-aware, persisted-with-session assemblies) and
`temporaryAssemblies` (used for ad-hoc read-vs-ref style assemblies).

<details open>
<summary>AssembliesMixin - Properties</summary>

#### property: sessionAssemblies

```ts
// type signature
type sessionAssemblies = IOptionalIType<IArrayType<ConfigurationSchemaType<{ aliases: { type: string; defaultValue: never[]; description: string; }; sequence: AnyConfigurationSchemaType; refNameColors: { type: string; defaultValue: never[]; description: string; }; refNameAliases: ConfigurationSchemaType<...>; cytobands: ConfigurationSchemaT...
// code
sessionAssemblies: types.stripDefault(
        types.array(assemblyConfigSchemasType),
        [],
      )
```

#### property: temporaryAssemblies

```ts
// type signature
type temporaryAssemblies = IOptionalIType<IArrayType<ConfigurationSchemaType<{ aliases: { type: string; defaultValue: never[]; description: string; }; sequence: AnyConfigurationSchemaType; refNameColors: { type: string; defaultValue: never[]; description: string; }; refNameAliases: ConfigurationSchemaType<...>; cytobands: ConfigurationSchemaT...
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

#### action: addTemporaryAssembly

used for read vs ref type assemblies.

```ts
type addTemporaryAssembly = (conf: AnyConfiguration) => ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>
```

#### action: removeTemporaryAssembly

```ts
type removeTemporaryAssembly = (name: string) => void
```

</details>
