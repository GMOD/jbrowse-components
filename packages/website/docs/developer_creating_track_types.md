---
id: developer_creating_track_types
title: Creating custom track types
---

At a high level the track types are just "ReactComponents" that contain
rendered track contents. Oftentimes, for custom drawing, we create a renderer
instead of a track, but here are some reasons you might want a custom track

- Drawing custom things over the rendered content (e.g. drawing the Y-scale bar
  in the wiggle track)
- Implementing custom track menu items (e.g. Show soft clipping in the
  alignments track)
- Adding custom drawer widgets (e.g. custom VariantFeatureDrawerWidget in
  variant track)
- You want to bundle your renderer and adapter as a specific thing that is
  automatically initialized rather than the BasicTrack (which combines any
  adapter and renderer)

### What does creating a track look like

When you create your plugin, you will add a cCreating a custom track is
basically looks like this

You have your config schema

```js
import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { BasicTrackConfig } from '@gmod/jbrowse-plugin-linear-genome-view'

const configSchema = ConfigurationSchema(
  'MyTrack',
  {
    color: {
      type: 'string',
      description: 'the color to use on my special features',
      defaultValue: 'green',
    },
  },
  { baseConfiguration: BasicTrackConfig, explicitlyTyped: true },
)
```

### What are the details of configSchema and stateModel

- stateModel - a mobx-state-tree object that manages track logic
- configSchema - a a combination of a "stateModel" and a "configSchema"

The state model is often implemented as a composition of the "base track" and
some custom logic

```js
import { observer } from 'mobx-react'
import { types } from 'mobx-state-tree'
import { BlockBasedTrack } from '@gmod/jbrowse-plugin-linear-genome-view'

// A component which changes color when you click on it
// Note that this track is an observer, so it automatically re-renders
// when something inside the track model changes e.g. model.hasTheBellRung
const BackgroundChangeTrack = observer(props => {
  const { model } = props
  return (
    <div
      style={{ backgroundColor: model.hasTheBellRung ? 'red' : 'green' }}
      onClick={() => model.ringTheBell()}
    >
      <BlockBasedTrack {...props} />
    </div>
  )
})

// A track state model that implements the logic for changing the
// background color on user click
return types.compose(
  'BackgroundChangeTrack',
  BaseTrack,
  types
    .model({
      hasTheBellRung: false,
    })
    .volatile(() => ({
      ReactComponent: MyComponent,
    }))
    .actions(self => ({
      ringTheBell() {
        self.hasTheBellRung = true
      },
    })),
)
```

This custom track type is fairly silly, but it shows us that our "track" can
really be any React component that we want it to, and that we can control some
logical state of the track by using mobx-state-tree

### Putting it all together

Here is a complete plugin that creates it's ReactComponent, configSchema,
stateModel, and Plugin class in a single file. You are of course welcome to
split things up into different files in your own plugins :)

src/index.js

```js
import { observer } from 'mobx-react'
import { types } from 'mobx-state-tree'
import { BlockBasedTrack } from '@gmod/jbrowse-plugin-linear-genome-view'
import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { BasicTrackConfig } from '@gmod/jbrowse-plugin-linear-genome-view'
import Plugin from '@gmod/jbrowse-core/Plugin'

const BackgroundChangeTrack = observer(props => {
  const { model } = props
  return (
    <div
      style={{ backgroundColor: model.hasTheBellRung ? 'red' : 'green' }}
      onClick={() => model.ringTheBell()}
    >
      <BlockBasedTrack {...props} />
    </div>
  )
})

const stateModel = types.compose(
  'BackgroundChangeTrack',
  BaseTrack,
  types
    .model({
      hasTheBellRung: false,
    })
    .volatile(() => ({
      ReactComponent: MyComponent,
    }))
    .actions(self => ({
      ringTheBell() {
        self.hasTheBellRung = true
      },
    })),
)

const configSchema = ConfigurationSchema(
  'MyTrack',
  {
    color: {
      type: 'string',
      description: 'the color to use on my special features',
      defaultValue: 'green',
    },
  },
  { baseConfiguration: BasicTrackConfig, explicitlyTyped: true },
)

export default class MyPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addTrackType(() => {
      return new TrackType({
        name: 'MyTrack',
        compatibleView: 'LinearGenomeView', // this is the default
        configSchema,
        stateModel,
      })
    })
  }
}
```
