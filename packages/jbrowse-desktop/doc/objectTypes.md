## JBrowse

Main object where plugins and pluggable elements are installed, and configuration is loaded.

## Pluggable Elements

Pluggable elements are types of UI elements that can be registered with the central JBrowse object and then used by JBrowse.

Examples: view types, tracks, data stores,

## Configurations

A configuration is a type of mobx-state-tree model, in which leaf nodes are ConfigSlot types, and other nodes are ConfigurationSchema types.

```
       Schema
    /     |     \
   Slot  Schema  Slot
         |    \
         Slot  Slot
```

Configurations are all descendents of a single root configuration, which is `root.configuration`.

Configuration types should always be created by the `ConfigurationSchema` factory, e.g.

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

## Tracks

A track is a visible element in the UI that shows some data.

It has a certain track configuration schema, and its state model has a reference back to that track configuration.

Each track type needs to list which view types it can be used with in its `compatibleViewTypes` member.

It uses one or more [Renderers] to actually draw the data inside its piece of the UI.

## Renderers

A renderer is a pluggable element that cannot be configured on its own, but is registered with the plugin
manager for use by tracks to draw data. It is a react component that takes some data in its props, and produces some kind of web-compatible rendering of it.
