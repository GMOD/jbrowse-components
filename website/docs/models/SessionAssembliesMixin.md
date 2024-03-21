---
id: sessionassembliesmixin
title: SessionAssembliesMixin
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[packages/app-core/src/Assemblies/SessionAssembliesMixin.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/Assemblies/SessionAssembliesMixin.ts)

### SessionAssembliesMixin - Properties

#### property: sessionAssemblies

```js
// type signature
IArrayType<ConfigurationSchemaType<{ aliases: { defaultValue: any[]; description: string; type: string; }; cytobands: ConfigurationSchemaType<{ adapter: IAnyModelType; }, ConfigurationSchemaOptions<undefined, undefined>>; displayName: { ...; }; refNameAliases: ConfigurationSchemaType<...>; refNameColors: { ...; }; s...
// code
sessionAssemblies: types.array(assemblyConfigSchemasType)
```

### SessionAssembliesMixin - Actions

#### action: addSessionAssembly

```js
// type signature
addSessionAssembly: (conf: AnyConfiguration) => { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<ConfigurationSchemaType<{ aliases: { defaultValue: any[]; description: string; type: string; }; ... 4 more ...; sequence: AnyConfigurationSchemaType; }, ConfigurationSchemaOpt...
```

#### action: removeSessionAssembly

```js
// type signature
removeSessionAssembly: (assemblyName: string) => void
```
