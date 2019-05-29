import { getRoot, types, addDisposer } from 'mobx-state-tree'

import { autorun } from 'mobx'

import CompositeMap from '@gmod/jbrowse-core/util/compositeMap'
import { getContainingView } from '@gmod/jbrowse-core/util/tracks'
import baseTrack from './baseTrack'

import BlockState from './serverSideRenderedBlock'

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
        return self.blockType === 'dynamicBlocks' ? 500 : 50
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
    }))
    .volatile(() => ({
      blockDefinitions: [],
    }))
    .actions(self => ({
      afterAttach() {
        // watch the parent's blocks to update our block state when they change
        const blockWatchDisposer = autorun(() => {
          // create any blocks that we need to create
          const blocksPresent = {}
          self.blockDefinitions.forEach(block => {
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
        const blockDefinitionDisposer = autorun(
          async function getRefNamesAutorrun() {
            let blockDefinitions = getContainingView(self)[self.blockType]
            try {
              const { assemblyManager } = getRoot(self)

              const refNameMap = await assemblyManager.getRefNameMapForTrack(
                self.configuration,
              )
              if (!refNameMap) return

              // push to refname mapping to the blocks
              // todo: do elsewhere?
              blockDefinitions = blockDefinitions.map(blockDefinition => {
                const { refName } = blockDefinition
                if (refName && refNameMap.get(refName)) {
                  return blockDefinition.renameReference(
                    refNameMap.get(refName),
                  )
                }
                return blockDefinition
              })
            } catch (e) {
              self.setError(e)
            } finally {
              self.setBlockDefinitions(blockDefinitions)
            }
          },
        )

        addDisposer(self, blockWatchDisposer)
        addDisposer(self, blockDefinitionDisposer)
      },
      setBlockDefinitions(blockDefinitions) {
        self.blockDefinitions = blockDefinitions
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
    })),
)
