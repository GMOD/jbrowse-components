# Connections

Connections are a way to allow users to easily add data to their JBrowse
session. Connections are flexible and can be used in may ways.

At their most simple, connections are a way to add tracks to JBrowse. You could,
for example, use one to quickly add a pre-configured set of tracks pointing at
some publicly available data. They are likely more useful, though, as a way to
dynamically create tracks by querying some resource. One example of this is
using a connection to allow a user to "import" a UCSC Track Hub into JBrowse.

## Adding a connection

Connections are a "pluggable element" in JBrowse, meaning they are installed
with the plugin manager. There are many examples of how to add pluggable
elements in the `jbrowse-components/packages/` directory. Here is an example of
adding a connection:

```js
pluginManager.addConnectionType(
  () =>
    new ConnectionType({
      name: 'MyConnection',
      configSchema: myConfigSchema,
      configEditorComponent: MyConfigComponent,
      stateModel: myModelFactory(pluginManager),
      displayName: 'My Awesome Connection',
      description:
        'Add tracks to JBrowse from data in the myAwesomeData format',
      url: '//mysite.com/info',
    }),
)
```

### Required items

- `name`: The name JBrowse will use internally and in configuration files to
  refer to this type of connection
- `configSchema`: A [configuration schema](../configuration/README.md) for the
  connection. It defines the options a user can configure when adding the
  connection. It must at least have a "name" slot.
- `stateModel`: The mobx-state-tree model for the connection. This contains the
  code that actually does queries and creates tracks. See below.

### Optional items

These items are used when a user adds a connection via the GUI. If included,
they are displayed in the GUI so a user can better understand the type of
connection they are adding.

- `displayName`: A user-friendly name for the connection type. `name` will be
  used if this is absent.
- `description`: A description of the connection.
- `url`: A link to follow for more information about the connection or the
  resource being connected to.
- `configEditorComponent`: By default the user can use the built-in config
  editor to configure the connection when adding it via the GUI. However, a
  custom editor can be provided. It should be a react component that accepts a
  prop `model`. This can be used to set config items. For example, if you have a
  config slot "name", you can set its value using
  `model.target.name.set('someNewName')`

## State Model

The following is a frame of a basic state model

```js
import {
  ConfigurationReference,
  readConfObject,
} from '@jbrowse/core/configuration'
import { BaseConnectionModelFactory } from '@jbrowse/core/pluggableElementTypes/models'
import { types } from 'mobx-state-tree'
import configSchema from './configSchema'
import { fetchData, transformData } from './myStuff'

function modelFactory(pluginManager) {
  return types.compose(
    'MyConnection',
    BaseConnectionModelFactory(pluginManager),
    types.model().actions(self => ({
      // `connectionConf` contains the configuration defined for this connection
      connect(connectionConf) {
        // Here is an example of how to read data from a configuration
        const dataLocation = readConfObject(connectionConf, 'dataLocation')
        // Now fetch the data.
        fetchData(dataLocation).then(data => {
          // Now do something with the data to convert it to JBrowse tracks
          const tracks = transformData(data)
          // All tracks must be added under an assembly. This assembly might be
          // configured by the user or might be determined by the nature of the
          // connection
          setTrackConfs(tracks)

          // If necessary, the tracks can be added incrementally
          tracks.forEach(track => {
            addTrackConf(track)
          })
        })
      },
    })),
  )
}
```
