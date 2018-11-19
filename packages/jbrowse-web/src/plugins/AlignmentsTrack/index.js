import React from 'react'
import { types, getSnapshot, getParent, onPatch } from 'mobx-state-tree'

import { autorun } from 'mobx'
import Plugin, { TrackType } from '../../Plugin'
import { ConfigurationSchema } from '../../configuration'
import { BaseTrack as LinearGenomeTrack } from '../LinearGenomeView/models/model'
import AlignmentsTrack from './components/AlignmentsTrack'

const BlockState = types
  .model({
    key: types.string,
    data: types.frozen(),
    contentString: '<span style="color: red">oh hi</span>',
  })
  .views(self => ({
    get content() {
      return <div dangerouslySetInnerHTML={{ __html: self.contentString }} />
    },
  }))

const BlockBasedTrackState = types.compose(
  'BlockBasedTrackState',
  LinearGenomeTrack,
  types
    .model({
      blockState: types.map(BlockState),
    })
    .actions(self => ({
      afterAttach() {
        const view = getParent(self, 2)
        // listen to the parent's blocks to update our block state when they change
        autorun(() => {
          // create any blocks that we need to create
          const blocksPresent = {}
          view.blocks.forEach(block => {
            blocksPresent[block.key] = true
            if (!self.blockState.has(block.key))
              self.blockState.set(
                block.key,
                BlockState.create({
                  key: block.key,
                  data: [],
                  contentString: '<div class="loading">Loading...</div>',
                }),
              )
          })
          // delete any blocks we need to delete
          self.blockState.forEach((value, key) => {
            if (!blocksPresent[key]) self.blockState.delete(key)
          })
        })
      },
    })),
)

export default class AlignmentsTrackPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addTrackType(() => {
      const stateModel = types.compose(
        'AlignmentsTrack',
        BlockBasedTrackState,
        types
          .model({
            type: types.literal('AlignmentsTrack'),
          })
          // .actions(self => ({
          //   afterAttach() {
          //     onPatch(self, patch => {
          //       console.log('patch', self.name, patch)
          //     })
          //   },
          // }))
          .views(self => ({
            get RenderingComponent() {
              return AlignmentsTrack
            },
            get adapter() {
              // TODO: refactor this someplace else to make this code shareable
              const adapterConfig = self.configuration.adapter
              const adapterType = pluginManager.getAdapterType(
                adapterConfig.type,
              )
              if (!adapterType)
                throw new Error(`unknown adapter type ${adapterConfig.type}`)
              const adapter = new adapterType.AdapterClass(
                getSnapshot(adapterConfig),
              )
              return adapter
            },
          })),
      )

      const configSchema = ConfigurationSchema('AlignmentsTrack', {
        adapter: types.union(
          ...pluginManager.getElementTypeMembers('adapter', 'configSchema'),
        ),
        defaultView: {
          type: 'string',
          defaultValue: 'pileup',
        },
      })

      return new TrackType({
        name: 'Alignments',
        configSchema,
        stateModel,
        RenderingComponent: AlignmentsTrack,
      })
    })
  }
}
