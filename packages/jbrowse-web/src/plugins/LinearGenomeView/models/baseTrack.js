import React from 'react'
import { types, getRoot, getParent } from 'mobx-state-tree'
import {
  ConfigurationSchema,
  ConfigurationReference,
} from '../../../configuration'
import { ElementId } from '../../../mst-types'

import TrackControls from '../components/TrackControls'

export const BaseTrackConfig = ConfigurationSchema('BaseTrack', {
  viewType: 'LinearGenomeView',
  name: {
    description: 'descriptive name of the track',
    type: 'string',
    defaultValue: 'Track',
  },
  description: {
    description: 'a description of the track',
    type: 'string',
    defaultValue: '',
  },
  category: {
    description: 'the category and sub-categories of a track',
    type: 'stringArray',
    defaultValue: [],
  },
})

// these MST models only exist for tracks that are *shown*.
// they should contain only UI state for the track, and have
// a reference to a track configuration (stored under root.configuration.tracks).

// note that multiple displayed tracks could use the same configuration.

// note that multiple displayed tracks could use the same configuration.
const minTrackHeight = 20
const BaseTrack = types
  .model('BaseTrack', {
    id: ElementId,
    type: types.string,
    height: types.optional(
      types.refinement('trackHeight', types.number, n => n >= minTrackHeight),
      minTrackHeight,
    ),
    subtracks: types.literal(undefined),
    configuration: ConfigurationReference(BaseTrackConfig),
  })
  .views(self => ({
    get ControlsComponent() {
      return TrackControls
    },

    get RenderingComponent() {
      return (
        self.reactComponent ||
        (() => (
          <div className="TrackRenderingNotImplemented">
            Rendering not implemented for {self.type} tracks
          </div>
        ))
      )
    },

    get renderProps() {
      // view -> [tracks] -> [blocks]
      const view = getParent(self, 2)
      return {
        bpPerPx: view.bpPerPx,
        horizontallyFlipped: view.horizontallyFlipped,
      }
    },
  }))
  .actions(self => ({
    setHeight(trackHeight) {
      if (trackHeight >= minTrackHeight) self.height = trackHeight
    },

    activateConfigurationUI() {
      getRoot(self).editConfiguration(self.configuration)
    },
  }))

export default BaseTrack
