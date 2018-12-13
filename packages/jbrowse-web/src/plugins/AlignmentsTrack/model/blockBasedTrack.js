import { types, getParent } from 'mobx-state-tree'

import { autorun } from 'mobx'

import { BaseTrack as LinearGenomeTrack } from '../../LinearGenomeView/model'

import BlockState from './ssrBlock'

export default types.compose(
  'BlockBasedTrackState',
  LinearGenomeTrack,
  types
    .model({
      blockState: types.map(BlockState),
    })
    .views(self => ({
      get renderProps() {
        // view -> [tracks] -> [blocks]
        const view = getParent(self, 2)
        return {
          bpPerPx: view.bpPerPx,
        }
      },
    }))
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
        beforeDetach: disposeBlockWatch,
        beforeDestroy: disposeBlockWatch,
      }
    }),
)
