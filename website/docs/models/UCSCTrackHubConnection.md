---
id: ucsctrackhubconnection
title: UCSCTrackHubConnection
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/UCSCTrackHubConnection/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/UCSCTrackHubConnection.md)

## Docs

extends BaseConnectionModel

### UCSCTrackHubConnection - Properties

#### property: configuration

```js
// type signature
ConfigurationSchemaType<{ hubTxtLocation: { type: string; defaultValue: { uri: string; locationType: string; }; description: string; }; assemblyNames: { type: string; defaultValue: any[]; description: string; }; }, ConfigurationSchemaOptions<ConfigurationSchemaType<{ ...; }, ConfigurationSchemaOptions<...>>, undefin...
// code
configuration: ConfigurationReference(configSchema)
```

#### property: type

```js
// type signature
ISimpleType<"UCSCTrackHubConnection">
// code
type: types.literal('UCSCTrackHubConnection')
```

### UCSCTrackHubConnection - Actions

#### action: connect

```js
// type signature
connect: () => Promise<void>
```
