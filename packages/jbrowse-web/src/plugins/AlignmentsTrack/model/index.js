import { types, getSnapshot } from 'mobx-state-tree'

import { ConfigurationReference, getConf } from '../../../configuration'

import AlignmentsTrack from '../components/AlignmentsTrack'

import BlockBasedTrackState from './blockBasedTrack'

export default (pluginManager, configSchema) =>
  types.compose(
    'AlignmentsTrack',
    BlockBasedTrackState,
    types
      .model({
        type: types.literal('AlignmentsTrack'),
        configuration: ConfigurationReference(configSchema),
        // the renderer that the user has selected in the UI, empty string
        // if they have not made any selection
        selectedView: types.optional(types.string, ''),
        height: types.optional(types.integer, 100),
      })
      .volatile(self => ({
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
        // the renderer type is based on the "view" selected in the UI: pileup, coverage, etc
        get rendererType() {
          const defaultView = getConf(self, 'defaultView')
          const viewName = self.selectedView || defaultView
          const rendererType = { pileup: 'PileupRenderer' }[viewName]
          if (!rendererType)
            throw new Error(`unknown alignments view name ${viewName}`)
          return rendererType
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
          // TODO: refactor this someplace else to make this code shareable
          const adapter = new self.adapterType.AdapterClass(
            getSnapshot(self.configuration.adapter),
          )
          return adapter
        },
      })),
  )
