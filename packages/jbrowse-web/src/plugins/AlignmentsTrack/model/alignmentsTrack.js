import { types, getSnapshot, getParent, getRoot } from 'mobx-state-tree'

import { ConfigurationReference, getConf } from '../../../configuration'

import AlignmentsTrack from '../components/AlignmentsTrack'

import BlockBasedTrack from './blockBasedTrack'

import CompositeMap from '../../../util/compositeMap'

export default (pluginManager, configSchema) =>
  types.compose(
    'AlignmentsTrack',
    BlockBasedTrack,
    types
      .model({
        type: types.literal('AlignmentsTrack'),
        configuration: ConfigurationReference(configSchema),
        // the renderer that the user has selected in the UI, empty string
        // if they have not made any selection
        selectedRendering: types.optional(types.string, ''),
        height: types.optional(types.integer, 100),
      })
      .volatile(() => ({
        reactComponent: AlignmentsTrack,
      }))
      // .actions(self => ({
      //   afterAttach() {
      //     onPatch(self, patch => {
      //       console.log('patch', self.name, patch)
      //     })
      //   },
      // }))
      .views(self => ({
        // the renderer type name is based on the "view"
        // selected in the UI: pileup, coverage, etc
        get rendererTypeName() {
          const defaultRendering = getConf(self, 'defaultRendering')
          const viewName = self.selectedRendering || defaultRendering
          const rendererType = { pileup: 'PileupRenderer' }[viewName]
          if (!rendererType)
            throw new Error(`unknown alignments view name ${viewName}`)
          return rendererType
        },

        // gets the actual renderer type object
        get rendererType() {
          const track = getParent(self, 2)
          const RendererType = pluginManager.getRendererType(
            self.rendererTypeName,
          )
          if (!RendererType)
            throw new Error(`renderer "${track.rendererTypeName} not found`)
          if (!RendererType.ReactComponent)
            throw new Error(
              `renderer ${
                track.rendererTypeName
              } has no ReactComponent, it may not be completely implemented yet`,
            )
          return RendererType
        },

        get renderProps() {
          // view -> [tracks] -> [blocks]
          const view = getParent(self, 2)
          const config = getConf(self, ['renderers', self.rendererTypeName])
          return {
            bpPerPx: view.bpPerPx,
            config,
            onFeatureClick(featureId) {
              console.log('clicked', featureId)
              // try to find the feature in our layout
              console.log(self.features.get(featureId))
            },
          }
        },

        get features() {
          // a composite map of featureId -> feature obj that
          // just looks in all the block data for that feature
          const featureMaps = []
          for (const block of self.blockState.values()) {
            if (block.data && block.data.features)
              featureMaps.push(block.data.features)
          }
          return new CompositeMap(featureMaps)
        },

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

        get adapter() {
          const adapter = new self.adapterType.AdapterClass(
            getSnapshot(self.configuration.adapter),
          )
          return adapter
        },
      })),
  )
