import React from 'react'
import { types, getSnapshot, getParent, onPatch, flow } from 'mobx-state-tree'

import { autorun } from 'mobx'
import Plugin, { TrackType } from '../../Plugin'
import {
  ConfigurationSchema,
  ConfigurationReference,
  getConf,
} from '../../configuration'
import {
  BaseTrack as LinearGenomeTrack,
  BaseTrackConfig as LinearGenomeTrackConfig,
} from '../LinearGenomeView/models/model'
import AlignmentsTrack from './components/AlignmentsTrack'

import { Region } from '../../mst-types'
import { renderRegion } from '../../render'

function delay(time) {
  return new Promise((resolve, reject) => {
    window.setTimeout(resolve, time)
  })
}

const BlockState = types
  .model('BlockState', {
    key: types.string,
    region: Region,
  })
  .volatile(self => ({
    alive: true,
    filled: false,
  }))
  .actions(self => ({
    afterAttach() {
      self.render()
    },
    render: flow(function* renderBlock() {
      const track = getParent(self, 2)
      const view = getParent(track, 2)
      const root = getParent(view, 2)
      const { features, html } = yield renderRegion(root.pluginManager, {
        region: self.region,
        adapterType: track.adapterType.name,
        adapterConfig: getConf(track, 'adapter'),
        renderType: track.renderType,
        renderProps: {},
      })
      if (!self.alive) return

      self.reactComponent = () => (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      )
    }),
    beforeDetach() {
      self.alive = false
    },
    beforeDestroy() {
      self.alive = false
    },
  }))

const BlockBasedTrackState = types.compose(
  'BlockBasedTrackState',
  LinearGenomeTrack,
  types
    .model({
      blockState: types.map(BlockState),
    })
    .actions(self => {
      let blockWatchDisposer
      return {
        afterAttach() {
          const view = getParent(self, 2)
          // watch the parent's blocks to update our block state when they change
          blockWatchDisposer = autorun(() => {
            // create any blocks that we need to create
            const blocksPresent = {}
            view.blocks.forEach(block => {
              blocksPresent[block.key] = true
              if (!self.blockState.has(block.key))
                self.blockState.set(
                  block.key,
                  BlockState.create({
                    key: block.key,
                    region: block,
                  }),
                )
            })
            // delete any blocks we need to delete
            self.blockState.forEach((value, key) => {
              if (!blocksPresent[key]) self.blockState.delete(key)
            })
          })
        },
        beforeDetach() {
          if (blockWatchDisposer) blockWatchDisposer()
        },
      }
    }),
)

export default class AlignmentsTrackPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addTrackType(() => {
      const configSchema = ConfigurationSchema(
        'AlignmentsTrack',
        {
          adapter: types.union(
            ...pluginManager.getElementTypeMembers('adapter', 'configSchema'),
          ),
          defaultView: {
            type: 'string',
            defaultValue: 'pileup',
          },
        },
        { baseConfiguration: LinearGenomeTrackConfig, explicitlyTyped: true },
      )

      const stateModel = types.compose(
        'AlignmentsTrack',
        BlockBasedTrackState,
        types
          .model({
            type: types.literal('AlignmentsTrack'),
            configuration: ConfigurationReference(configSchema),
          })
          .volatile(self => ({
            reactComponent: AlignmentsTrack,
            renderType: '',
          }))
          // .actions(self => ({
          //   afterAttach() {
          //     onPatch(self, patch => {
          //       console.log('patch', self.name, patch)
          //     })
          //   },
          // }))
          .views(self => ({
            get adapterType() {
              const adapterConfig = getConf(self, 'adapter')
              console.log(adapterConfig)
              if (!adapterConfig)
                throw new Error(
                  `no adapter configuration provided for ${self.type}`,
                )
              const adapterType = pluginManager.getAdapterType(
                adapterConfig.type,
              )
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

      return new TrackType({
        name: 'AlignmentsTrack',
        configSchema,
        stateModel,
        RenderingComponent: AlignmentsTrack,
      })
    })
  }
}
