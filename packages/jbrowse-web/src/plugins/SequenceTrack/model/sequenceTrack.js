import { types, getSnapshot, getParent, getRoot } from 'mobx-state-tree'

import { ConfigurationReference, getConf } from '../../../configuration'

import SequenceTrack from '../components/SequenceTrack'

import BlockBasedTrack from '../../LinearGenomeView/models/blockBasedTrack'

import CompositeMap from '../../../util/compositeMap'
import TrackControls from '../components/TrackControls'

// using a map because it preserves order
const rendererTypes = new Map([['div', 'DivSequenceRenderer']])

export default (pluginManager, configSchema) =>
  types.compose(
    'SequenceTrack',
    BlockBasedTrack,
    types
      .model({
        type: types.literal('SequenceTrack'),
        configuration: ConfigurationReference(configSchema),
        // the renderer that the user has selected in the UI, empty string
        // if they have not made any selection
        selectedRendering: types.optional(types.string, ''),
        height: types.optional(types.integer, 100),
      })
      .volatile(() => ({
        reactComponent: SequenceTrack,
        rendererTypeChoices: Array.from(rendererTypes.keys()),
      }))
      .views(self => ({
        /**
         * the renderer type name is based on the "view"
         * selected in the UI: pileup, coverage, etc
         */
        get rendererTypeName() {
          const defaultRendering = getConf(self, 'defaultRendering')
          const viewName = self.selectedRendering || defaultRendering
          const rendererType = rendererTypes.get(viewName)
          if (!rendererType)
            throw new Error(`unknown alignments view name ${viewName}`)
          return rendererType
        },

        get ControlsComponent() {
          return TrackControls
        },

        /**
         * returns a string feature ID if the globally-selected object
         * is probably a feature
         */
        get selectedFeatureId() {
          const root = getRoot(self)
          if (!root) return undefined
          const { selection } = root
          // does it quack like a feature?
          if (
            selection &&
            typeof selection.get === 'function' &&
            typeof selection.id === 'function'
          ) {
            // probably is a feature
            return selection.id()
          }
          return undefined
        },
        /**
         * the pluggable element type object for this track's
         * renderer
         */
        get rendererType() {
          const track = getParent(self, 2)
          const RendererType = pluginManager.getRendererType(
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
         * the react props that are passed to the Renderer when data
         * is rendered in this track
         */
        get renderProps() {
          // view -> [tracks] -> [blocks]
          const view = getParent(self, 2)
          const config = self.rendererType.configSchema.create(
            getConf(self, ['renderers', self.rendererTypeName]) || {},
          )
          return {
            bpPerPx: view.bpPerPx,
            config,
            trackModel: self,
            onFeatureClick(event, featureId) {
              // try to find the feature in our layout
              const feature = self.features.get(featureId)
              self.selectFeature(feature)
            },
            onClick() {
              self.clearFeatureSelection()
            },
          }
        },

        /**
         * a CompositeMap of featureId -> feature obj that
         * just looks in all the block data for that feature
         */
        get features() {
          const featureMaps = []
          for (const block of self.blockState.values()) {
            if (block.data && block.data.features)
              featureMaps.push(block.data.features)
          }
          return new CompositeMap(featureMaps)
        },

        /**
         * the PluggableElementType for the currently defined adapter
         */
        get adapterType() {
          const adapterConfig = getConf(self, 'adapter')
          if (!adapterConfig)
            throw new Error(
              `no adapter configuration provided for ${self.type}`,
            )
          const adapterType = pluginManager.getAdapterType(adapterConfig.type)
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
      })),
  )
