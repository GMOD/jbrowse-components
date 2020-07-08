---
id: developer_creating_track_types
title: Creating custom track types
---

At a high level the track types are just "ReactComponents" that contain
rendered track contents. We generally implement a custom renderer if we want
custom drawing logic, but here are some common reasons to make a custom track
type

- Drawing custom things over the rendered content (e.g. drawing the Y-scale bar
  in the wiggle track)
- Implementing custom track menu items (e.g. Show soft clipping in the
  alignments track)
- Adding custom drawer widgets (e.g. custom VariantFeatureDrawerWidget in
  variant track)

A custom track is a combination of a "stateModel" and a "configSchema"

The state model is often implemented as a composition of the "base track" and
some custom logic

```js

import BlockBasedTrack from '@gmod/jbrowse-plugin-linear-genome-view/src/BasicTrack/components/BlockBasedTrack'


// A component which changes color when you click on it
function BackgroundChangeTrack(props) {
  const {model} = props
  return (
    <div
       style={{ style: model.hasTheBellRung ? 'red' : 'green' }}
       onClick={() => model.ringTheBell()}
    >
      <BlockBasedTrack {...props} />
    </div>
  )
}

// A track state model that implements the logic for changing the background
color on user click
return types.compose('BackgroundChangeTrack',
  BaseTrack,
  types.model({
    hasTheBellRung: false
  }).volatile(() => ({
    ReactComponent: MyComponent
  })).actions(self => ({
    ringTheBell() {
      self.hasTheBellRung = true
    }
  })
)
```

This custom track type is fairly silly, but it shows us that our "track" can
really be any React component that we want it to, and that we can control some
logical state of the track by using mobx-state-tree
