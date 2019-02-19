import { types, addDisposer } from 'mobx-state-tree'

import { autorun } from 'mobx'

import baseTrack from './baseTrack'

import BlockState from './serverSideRenderedBlock'
import CompositeMap from '../../../util/compositeMap'
import { getContainingView } from '../../../util/tracks'

export default types.compose(
  'BlockBasedTrackState',
  baseTrack,
  types
    .model({
      blockState: types.map(BlockState),
    })
    .views(self => ({
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
    }))
    .actions(self => ({
      afterAttach() {
        const view = getContainingView(self)
        // watch the parent's blocks to update our block state when they change
        const blockWatchDisposer = autorun(() => {
          // create any blocks that we need to create
          const blocksPresent = {}
          view.blocks.forEach(block => {
            blocksPresent[block.key] = true
            if (!self.blockState.has(block.key)) self.addBlock(block.key, block)
          })
          // delete any blocks we need to delete
          self.blockState.forEach((value, key) => {
            if (!blocksPresent[key]) self.deleteBlock(key)
          })
        })

        addDisposer(self, blockWatchDisposer)
      },
      addBlock(key, region) {
        self.blockState.set(
          key,
          BlockState.create({
            key,
            region,
          }),
        )
      },
      deleteBlock(key) {
        self.blockState.delete(key)
      },
    })),
)
