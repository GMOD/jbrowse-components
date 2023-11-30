---
id: ucsctrackhubconnection
title: UCSCTrackHubConnection
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/data-management/src/ucsc-trackhub/model.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/ucsc-trackhub/model.ts)

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
