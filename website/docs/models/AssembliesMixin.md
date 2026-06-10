---
id: assembliesmixin
title: AssembliesMixin
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

## Docs

Adds `sessionAssemblies` (admin-aware, persisted-with-session assemblies) and
`temporaryAssemblies` (used for ad-hoc read-vs-ref style assemblies).

### AssembliesMixin - Properties

#### property: sessionAssemblies

```js
// type signature
IArrayType<ConfigurationSchemaType<{ aliases: { type: string; defaultValue: never[]; description: string; }; sequence: AnyConfigurationSchemaType; refNameColors: { type: string; defaultValue: never[]; description: string; }; refNameAliases: ConfigurationSchemaType<...>; cytobands: ConfigurationSchemaType<...>; displ...
// code
sessionAssemblies: types.array(assemblyConfigSchemasType)
```

#### property: temporaryAssemblies

```js
// type signature
IArrayType<ConfigurationSchemaType<{ aliases: { type: string; defaultValue: never[]; description: string; }; sequence: AnyConfigurationSchemaType; refNameColors: { type: string; defaultValue: never[]; description: string; }; refNameAliases: ConfigurationSchemaType<...>; cytobands: ConfigurationSchemaType<...>; displ...
// code
temporaryAssemblies: types.array(assemblyConfigSchemasType)
```

### AssembliesMixin - Actions

#### action: addSessionAssembly

```js
// type signature
addSessionAssembly: (conf: AnyConfiguration) => ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>
```

#### action: addAssembly

```js
// type signature
addAssembly: (conf: AnyConfiguration) => void
```

#### action: removeAssembly

```js
// type signature
removeAssembly: (name: string) => void
```

#### action: removeSessionAssembly

```js
// type signature
removeSessionAssembly: (assemblyName: string) => void
```

#### action: addTemporaryAssembly

used for read vs ref type assemblies.

```js
// type signature
addTemporaryAssembly: (conf: AnyConfiguration) => ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>
```

#### action: removeTemporaryAssembly

```js
// type signature
removeTemporaryAssembly: (name: string) => void
```
