---
id: baseconnectionmodel
title: BaseConnectionModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/pluggableElementTypes/models/BaseConnectionModelFactory.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/BaseConnectionModel.md)

## Docs

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

#### action: connect

```js
// type signature
connect: (_arg: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>) => void
```

#### action: addTrackConf

```js
// type signature
addTrackConf: (trackConf: TrackConf) => any
```

#### action: addTrackConfs

```js
// type signature
addTrackConfs: (trackConfs: TrackConf[]) => void
```

#### action: setTrackConfs

```js
// type signature
setTrackConfs: (trackConfs: ({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>)[]) => void
```

#### action: clear

```js
// type signature
clear: () => void
```
