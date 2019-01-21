import { types, getParent } from 'mobx-state-tree'

import { autorun } from 'mobx'

import LinearGenomeTrack from './baseTrack'

import BlockState from './serverSideRenderedBlock'

export default types.compose(
  'BlockBasedTrackState',
  LinearGenomeTrack,
  types
    .model({
      blockState: types.map(BlockState),
    })
    .actions(self => {
      let blockWatchDisposer
      function disposeBlockWatch() {
        if (blockWatchDisposer) blockWatchDisposer()
        blockWatchDisposer = undefined
      }
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
                self.addBlock(block.key, block)
            })
            // delete any blocks we need to delete
            self.blockState.forEach((value, key) => {
              if (!blocksPresent[key]) self.deleteBlock(key)
            })
          })
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
        beforeDetach: disposeBlockWatch,
        beforeDestroy: disposeBlockWatch,
      }
    }),
)
