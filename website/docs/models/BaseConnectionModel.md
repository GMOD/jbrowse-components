---
id: baseconnectionmodel
title: BaseConnectionModel
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[packages/core/pluggableElementTypes/models/BaseConnectionModelFactory.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/pluggableElementTypes/models/BaseConnectionModelFactory.ts)

### BaseConnectionModel - Properties

#### property: name

```js
// type signature
ISimpleType<string>
// code
name: types.identifier
```

#### property: tracks

```js
// type signature
IArrayType<IAnyModelType>
// code
tracks: types.array(pluginManager.pluggableConfigSchemaType('track'))
```

#### property: configuration

```js
// type signature
ConfigurationSchemaType<{ name: { type: string; defaultValue: string; description: string; }; assemblyNames: { type: string; defaultValue: any[]; description: string; }; }, ConfigurationSchemaOptions<undefined, "connectionId">>
// code
configuration: ConfigurationReference(configSchema)
```

### BaseConnectionModel - Actions

#### action: addTrackConf

```js
// type signature
addTrackConf: (
  trackConf: { [x: string]: any } & NonEmptyObject & {
      setSubschema(slotName: string, data: unknown): any,
    } & IStateTreeNode<AnyConfigurationSchemaType>,
) => any
```

#### action: addTrackConfs

```js
// type signature
addTrackConfs: (trackConfs: ({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>)[]) => any[]
```

#### action: setTrackConfs

```js
// type signature
setTrackConfs: (trackConfs: ({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>)[]) => IMSTArray<...> & IStateTreeNode<...>
```

#### action: clear

```js
// type signature
clear: () => void
```
