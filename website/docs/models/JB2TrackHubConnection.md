---
id: jb2trackhubconnection
title: JB2TrackHubConnection
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/JB2TrackHubConnection/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/JB2TrackHubConnection.md)

## Docs

extends BaseConnectionModel

### JB2TrackHubConnection - Properties

#### property: configuration

```js
// type signature
ConfigurationSchemaType<{ configJsonLocation: { type: string; defaultValue: { uri: string; locationType: string; }; description: string; }; assemblyNames: { type: string; defaultValue: any[]; description: string; }; }, ConfigurationSchemaOptions<...>>
// code
configuration: ConfigurationReference(configSchema)
```

#### property: type

```js
// type signature
ISimpleType<"JB2TrackHubConnection">
// code
type: types.literal('JB2TrackHubConnection')
```

### JB2TrackHubConnection - Actions

#### action: connect

```js
// type signature
connect: () => Promise<void>
```
