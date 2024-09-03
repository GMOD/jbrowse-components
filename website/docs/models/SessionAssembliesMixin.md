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
IArrayType<ConfigurationSchemaType<{ aliases: { type: string; defaultValue: any[]; description: string; }; sequence: AnyConfigurationSchemaType; refNameColors: { type: string; defaultValue: any[]; description: string; }; refNameAliases: ConfigurationSchemaType<...>; cytobands: ConfigurationSchemaType<...>; displayNa...
// code
sessionAssemblies: types.array(assemblyConfigSchemasType)
```

### SessionAssembliesMixin - Actions

#### action: addSessionAssembly

```js
// type signature
addSessionAssembly: (conf: AnyConfiguration) => { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<...> | ({ ...; } & ... 2 more ... & IStateTreeNode<...>); } & IStateTreeNode<...>
```

#### action: removeSessionAssembly

```js
// type signature
removeSessionAssembly: (assemblyName: string) => void
```
