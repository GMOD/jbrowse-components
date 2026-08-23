---
title: Custom connections
description:
  Add many tracks at once, or dynamically query a remote resource, with a
  connection type
guide_category: Plugins
---

**TL;DR:** A connection adds data to a JBrowse session in bulk. At its simplest
it adds a pre-configured set of tracks; more powerfully, it dynamically creates
tracks by querying a remote resource, such as a UCSC Track Hub.

## Adding a connection type

Connections are a pluggable element, installed with the plugin manager via
`addConnectionType`:

<!-- include: plugins/data-management/src/JB2TrackHubConnection/index.ts -->

```ts
import { ConnectionType } from '@jbrowse/core/pluggableElementTypes'

import configSchema from './configSchema.ts'
import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function JB2TrackHubConnectionF(pluginManager: PluginManager) {
  pluginManager.addConnectionType(() => {
    return new ConnectionType({
      name: 'JB2TrackHubConnection',
      configSchema,
      stateModel: stateModelFactory(pluginManager),
      displayName: 'JB2 Track Hub',
      description: 'A JBrowse 2 config file based trackhub',
      url: 'https://jbrowse.org/jb2/',
    })
  })
}
```

### Required items

`ConnectionType` requires three:

- `name`: the name JBrowse uses internally and in configuration files to refer
  to this type of connection
- `configSchema`: a
  [configuration schema](/docs/developer_guides/configuration_schema) for the
  connection. It defines the options a user can configure when adding the
  connection, and must at least have a `name` slot.
- `stateModel`: the `@jbrowse/mobx-state-tree` model that does the queries and
  creates tracks (see below).

### Optional items

The first three furnish the "Add connection" dialog. None is enforced, and every
connection in the tree sets all three.

- `displayName`: what the connection-type dropdown lists, falling back to `name`
  as it does on every pluggable element. Worth setting to something readable,
  since `name` is an identifier.
- `description`: a sentence about what the connection connects to, shown as
  helper text under that dropdown once the type is selected.
- `url`: a link to more information about the resource or its format, rendered
  as an external link after the description.
- `configEditorComponent`: by default the user configures the connection with
  the built-in config editor. A custom React component can be supplied instead;
  it receives a `model` prop whose `target` is the connection config. Set a slot
  with `model.target.setSlot('name', 'someNewName')`. No session prop is passed
  — reach it with `getSession(model.target)`.

## State model

The state model composes `BaseConnectionModelFactory` and implements
`connect()`. Keep the model itself thin: `connect()` hands off to a lazily
imported module:

<!-- include: plugins/data-management/src/JB2TrackHubConnection/model.ts -->

```ts
import { ConfigurationReference } from '@jbrowse/core/configuration'
import { BaseConnectionModelFactory } from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'

import { lazyConnect } from '../lazyConnect.ts'
import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #stateModel JB2TrackHubConnection
 */
export default function JB2TrackHubConnection(pluginManager: PluginManager) {
  return types
    .compose(
      'JB2TrackHubConnection',
      BaseConnectionModelFactory(pluginManager),
      types.model({
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         */
        type: types.literal('JB2TrackHubConnection'),
      }),
    )
    .actions(self => ({
      /**
       * #action
       */
      connect() {
        return lazyConnect(self, () => import('./doConnect.ts'))
      },
    }))
}
```

`lazyConnect` keeps a connection's parsing code out of the startup bundle until
someone actually connects, and it owns the failure policy — it logs, notifies,
and breaks the connection — so each `doConnect` is only the happy path. It also
re-checks `isAlive(self)` after the dynamic import, since `doConnect` walks up
to the session and a StrictMode double-mount can dispose the node mid-import.

The `doConnect` module is where the configuration is read and the tracks are
added:

<!-- include: plugins/data-management/src/JB2TrackHubConnection/doConnect.ts -->

```ts
import { getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'
import { openLocation } from '@jbrowse/core/util/io'

import { resolve } from './util.ts'

import type { ConnectionDoConnectArg } from '../lazyConnect.ts'
import type { UriLocation } from '@jbrowse/core/util'

// lazyConnect wraps this in the shared connect-failure handler
export async function doConnect(self: ConnectionDoConnectArg) {
  const session = getSession(self)
  const configJsonLocation = getConf(self, 'configJsonLocation') as UriLocation

  const configJson = JSON.parse(
    await openLocation(configJsonLocation).readFile('utf8'),
  )
  const configUri = resolve(configJsonLocation.uri, configJsonLocation.baseUri)
  addRelativeUris(configJson, new URL(configUri))
  if (configJson.assemblies) {
    for (const assembly of configJson.assemblies) {
      if (!session.assemblyManager.has(assembly.name)) {
        session.addSessionAssembly?.(assembly)
      }
    }
  }

  if (configJson.tracks) {
    self.addTrackConfs(configJson.tracks)
  }
  if (!self.silent) {
    session.notify('Successfully loaded', 'success')
  }
}
```

`BaseConnectionModelFactory` provides `addTrackConf`, `addTrackConfs`, and
`setTrackConfs` for adding tracks incrementally or all at once. Note `silent`:
it is set when a session is restored and the connection reconnects on load, and
it suppresses the first-connect side effects (the success snackbar, launching a
view) that would otherwise fire on every page load.

## See also

- [](/docs/developer_guides/creating_addtrack_workflow)
- [](/docs/developer_guides/configuration_schema)
- [](/docs/developer_guides/mst_patterns)
- [](/docs/developer_guides/pluggable_elements)
