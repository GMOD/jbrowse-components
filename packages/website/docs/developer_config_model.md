---
id: developer_config_model
title: Configuration model concepts
---

A configuration is a type of mobx-state-tree model, in which leaf nodes are
ConfigSlot types, and other nodes are ConfigurationSchema types.

```
       Schema
    /     |     \
   Slot  Schema  Slot
         |    \
         Slot  Slot
```

Configurations are all descendents of a single root configuration, which is
`root.configuration`.

Configuration types should always be created by the `ConfigurationSchema`
factory, e.g.

```js
import { ConfigurationSchema } from '@gmod/jbrowse-core/utils/configuration'
const ThingStateModel = types.model('MyThingsState', {
  foo: 42,
  configuration: ConfigurationSchema('MyThing', {
    backgroundColor: {
      defaultValue: 'white',
      type: 'string',
    },
  }),
})
```
