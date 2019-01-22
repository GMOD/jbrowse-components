import React from 'react'
import { types, getRoot, getParent, getSnapshot } from 'mobx-state-tree'
import {
  ConfigurationSchema,
  ConfigurationReference,
  getConf,
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

    /**
     * the react props that are passed to the Renderer when data
     * is rendered in this track
     */
    get renderProps() {
      // view -> [tracks] -> [blocks]
      const view = getParent(self, 2)
      return {
        bpPerPx: view.bpPerPx,
        horizontallyFlipped: view.horizontallyFlipped,
        trackModel: self,
      }
    },

    /**
     * the pluggable element type object for this track's
     * renderer
     */
    get rendererType() {
      const track = getParent(self, 2)
      const rootModel = getRoot(self)
      const RendererType = rootModel.pluginManager.getRendererType(
        self.rendererTypeName,
      )
      if (!RendererType)
        throw new Error(`renderer "${track.rendererTypeName}" not found`)
      if (!RendererType.ReactComponent)
        throw new Error(
          `renderer ${
            track.rendererTypeName
          } has no ReactComponent, it may not be completely implemented yet`,
        )
      return RendererType
    },

    /**
     * the PluggableElementType for the currently defined adapter
     */
    get adapterType() {
      const adapterConfig = getConf(self, 'adapter')
      const rootModel = getRoot(self)
      if (!adapterConfig)
        throw new Error(`no adapter configuration provided for ${self.type}`)
      const adapterType = rootModel.pluginManager.getAdapterType(
        adapterConfig.type,
      )
      if (!adapterType)
        throw new Error(`unknown adapter type ${adapterConfig.type}`)
      return adapterType
    },

    /**
     * the Adapter that this track uses to fetch data
     */
    get adapter() {
      const adapter = new self.adapterType.AdapterClass(
        getSnapshot(self.configuration.adapter),
      )
      return adapter
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
