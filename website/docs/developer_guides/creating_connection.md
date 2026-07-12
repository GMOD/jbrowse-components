---
title: Custom connections
description:
  Add many tracks at once, or dynamically query a remote resource, with a
  connection type
guide_category: Creating pluggable elements
---

A connection is a way to add data to a JBrowse session in bulk. At its simplest
a connection adds a pre-configured set of tracks pointing at some publicly
available data. More powerfully, it can dynamically create tracks by querying a
remote resource, for example importing a UCSC Track Hub.

## Adding a connection type

Connections are a pluggable element, installed with the plugin manager via
`addConnectionType`:

```js
pluginManager.addConnectionType(
  () =>
    new ConnectionType({
      name: 'MyConnection',
      configSchema: myConfigSchema,
      stateModel: myModelFactory(pluginManager),
      displayName: 'My Awesome Connection',
      description:
        'Add tracks to JBrowse from data in the myAwesomeData format',
      url: '//mysite.com/info',
    }),
)
```

### Required items

- `name`: the name JBrowse uses internally and in configuration files to refer
  to this type of connection
- `configSchema`: a
  [configuration schema](/docs/developer_guides/configuration_schema) for the
  connection. It defines the options a user can configure when adding the
  connection, and must at least have a `name` slot.
- `stateModel`: the `@jbrowse/mobx-state-tree` model that does the queries and
  creates tracks (see below).

### Optional items

These are shown in the GUI when a user adds a connection, so they can better
understand the connection they are adding:

- `displayName`: a user-friendly name for the connection type; `name` is used if
  absent.
- `description`: a description of the connection.
- `url`: a link to more information about the connection or the resource being
  connected to.
- `configEditorComponent`: by default the user configures the connection with
  the built-in config editor. A custom React component can be supplied instead;
  it receives a `model` prop whose `target` is the connection config. Set a slot
  with `model.target.setSlot('name', 'someNewName')`.

## State model

The state model composes `BaseConnectionModelFactory` and implements
`connect()`, which reads the connection's configuration, fetches the data, and
adds the resulting tracks:

```js
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseConnectionModelFactory } from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'

import configSchema from './configSchema'
import { fetchData, transformData } from './myStuff'

export default function modelFactory(pluginManager) {
  return types
    .compose(
      'MyConnection',
      BaseConnectionModelFactory(pluginManager),
      types.model({
        configuration: ConfigurationReference(configSchema),
        type: types.literal('MyConnection'),
      }),
    )
    .actions(self => ({
      async connect() {
        const dataLocation = getConf(self, 'dataLocation')
        const data = await fetchData(dataLocation)
        // convert the fetched data into JBrowse track configs. All tracks are
        // added under an assembly, which may be user-configured or determined by
        // the connection itself.
        self.addTrackConfs(transformData(data))
      },
    }))
}
```

`BaseConnectionModelFactory` provides `addTrackConf`, `addTrackConfs`, and
`setTrackConfs` for adding tracks incrementally or all at once.

## See also

- [Creating custom add-track workflows](/docs/developer_guides/creating_addtrack_workflow)
  - another way to add tracks with custom UI
- [Configuration schema](/docs/developer_guides/configuration_schema) - define
  the connection's config slots
- [MST patterns](/docs/developer_guides/mst_patterns) - `types.compose` and
  model factories
- [Pluggable elements](/docs/developer_guides/pluggable_elements) - overview of
  all element types a plugin can register, including connections
