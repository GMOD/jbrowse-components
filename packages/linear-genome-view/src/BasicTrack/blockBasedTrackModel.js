import CompositeMap from '@gmod/jbrowse-core/util/compositeMap'
import { getContainingView } from '@gmod/jbrowse-core/util/tracks'
import { autorun } from 'mobx'
import { addDisposer, types } from 'mobx-state-tree'
import BlockState from './util/serverSideRenderedBlock'
import baseTrack from './baseTrackModel'
import { ContentBlock } from './util/blockTypes'

export default types.compose(
  'BlockBasedTrackState',
  baseTrack,
  types
    .model({
      blockState: types.map(BlockState),
    })
    .views(self => ({
      get blockType() {
        return 'staticBlocks'
      },

      /**
       * how many milliseconds to wait for the display to
       * "settle" before re-rendering a block
       */
      get renderDelay() {
        return 50
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

      get blockDefinitions() {
        return getContainingView(self)[self.blockType]
      },
    }))
    .actions(self => ({
      afterAttach() {
        // watch the parent's blocks to update our block state when they change
        const blockWatchDisposer = autorun(() => {
          // create any blocks that we need to create
          const blocksPresent = {}
          self.blockDefinitions.forEach(block => {
            if (!(block instanceof ContentBlock)) return
            blocksPresent[block.key] = true
            if (!self.blockState.has(block.key)) {
              self.addBlock(block.key, block)
            }
          })
          // delete any blocks we need to delete
          self.blockState.forEach((value, key) => {
            if (!blocksPresent[key]) self.deleteBlock(key)
          })
        })

        addDisposer(self, blockWatchDisposer)
      },

      addBlock(key, block) {
        self.blockState.set(
          key,
          BlockState.create({
            key,
            region: block.toRegion(),
          }),
        )
      },

      deleteBlock(key) {
        self.blockState.delete(key)
      },
    }))
    .postProcessSnapshot(self => {
      const { blockState, ...rest } = self
      return rest
    }),
)
