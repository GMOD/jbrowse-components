/* eslint-disable @typescript-eslint/no-explicit-any */
import CompositeMap from '@gmod/jbrowse-core/util/compositeMap'
import {
  getContainingView,
  getParentRenderProps,
} from '@gmod/jbrowse-core/util/tracks'
import { autorun } from 'mobx'
import { getSession } from '@gmod/jbrowse-core/util'
import { addDisposer, types, Instance } from 'mobx-state-tree'
import RBush from 'rbush'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import BlockState, { BlockStateModel } from './util/serverSideRenderedBlock'
import baseTrack from './baseTrackModel'
import { BaseBlock, ContentBlock } from './util/blockTypes'

const blockBasedTrack = types.compose(
  'BlockBasedTrackState',
  baseTrack,
  types
    .model({
      blockState: types.map(BlockState),
    })
    .volatile(() => ({
      rbush: new RBush(),
    }))
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
        return new CompositeMap<string, Feature>(featureMaps)
      },

      /**
       * a CompositeMap of featureId -> feature obj that
       * just looks in all the block data for that feature
       */
      get layoutFeatures() {
        const layoutMaps = []
        for (const block of self.blockState.values()) {
          if (block.data && block.data.layout && block.data.layout.rectangles) {
            layoutMaps.push(block.data.layout.rectangles)
          }
        }
        return new CompositeMap<string, [number, number, number, number]>(
          layoutMaps,
        )
      },

      get rtree() {
        self.rbush.clear()
        for (const [key, item] of this.features) {
          const layout = this.layoutFeatures.get(key) || []
          self.rbush.insert({
            minX: item.get('start'),
            minY: layout[1],
            maxX: item.get('end'),
            maxY: layout[3],
            name: key,
          })
        }
        return self.rbush
      },
      getFeatureOverlapping(x: number, y: number) {
        const rect = { minX: x, minY: y, maxX: x + 1, maxY: y + 1 }
        if (this.rtree.collides(rect)) {
          return this.rtree.search({
            minX: x,
            minY: y,
            maxX: x + 1,
            maxY: y + 1,
          })
        }
        return []
      },

      get blockDefinitions() {
        return getContainingView(self)[this.blockType]
      },
      /**
       * returns a string feature ID if the globally-selected object
       * is probably a feature
       */
      get selectedFeatureId() {
        const session = getSession(self) as any
        if (!session) return undefined
        const { selection } = session
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
    }))

    .actions(self => ({
      afterAttach() {
        // watch the parent's blocks to update our block state when they change
        const blockWatchDisposer = autorun(() => {
          // create any blocks that we need to create
          const blocksPresent: { [key: string]: boolean } = {}
          self.blockDefinitions.forEach((block: Instance<BlockStateModel>) => {
            if (!(block instanceof ContentBlock)) return
            blocksPresent[block.key] = true
            if (!self.blockState.has(block.key)) {
              this.addBlock(block.key, block)
            }
          })
          // delete any blocks we need to delete
          self.blockState.forEach((value, key) => {
            if (!blocksPresent[key]) this.deleteBlock(key)
          })
        })

        addDisposer(self, blockWatchDisposer)
      },

      addBlock(key: string, block: BaseBlock) {
        self.blockState.set(
          key,
          BlockState.create({
            key,
            region: block.toRegion(),
          }),
        )
      },

      deleteBlock(key: string) {
        self.blockState.delete(key)
      },

      selectFeature(feature: Feature) {
        const session = getSession(self) as any
        // TODO: we shouldn't need to have to get this deep into knowing about
        // drawer widgets here, the drawer widget should be a reaction to
        // setting a selected feature...right???
        if (session.drawerWidgets) {
          const featureWidget = session.addDrawerWidget(
            'BaseFeatureDrawerWidget',
            'baseFeature',
            // @ts-ignore
            { featureData: feature.data as any },
          )
          session.showDrawerWidget(featureWidget)
        }
        session.setSelection(feature)
      },
      clearFeatureSelection() {
        const session = getSession(self) as any
        session.clearSelection()
      },
    }))

    .views(self => ({
      get composedRenderProps() {
        return {
          ...getParentRenderProps(self),
          trackModel: self,
          onFeatureClick(event: any, featureId: string | undefined) {
            if (!featureId) self.clearFeatureSelection()
            else {
              const feature = self.features.get(featureId)
              self.selectFeature(feature as Feature)
            }
          },
        }
      },
      get renderProps() {
        return this.composedRenderProps
      },
    }))
    .postProcessSnapshot(self => {
      const { blockState, ...rest } = self
      return rest
    }),
)

export type BlockBasedTrackStateModel = typeof blockBasedTrack
export default blockBasedTrack
