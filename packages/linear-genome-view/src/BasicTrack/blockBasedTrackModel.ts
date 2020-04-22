import CompositeMap from '@gmod/jbrowse-core/util/compositeMap'
import { getParentRenderProps } from '@gmod/jbrowse-core/util/tracks'
import { autorun } from 'mobx'
import {
  getSession,
  getContainingView,
  isSessionModelWithDrawerWidgets,
  isSelectionContainer,
} from '@gmod/jbrowse-core/util'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import { addDisposer, types, Instance } from 'mobx-state-tree'
import RBush from 'rbush'
import { Feature, isFeature } from '@gmod/jbrowse-core/util/simpleFeature'
import BlockState from './util/serverSideRenderedBlock'
import baseTrack from './baseTrackModel'
import { BaseBlock, ContentBlock } from './util/blockTypes'
import BlockBasedTrack from './components/BlockBasedTrack'
import { LinearGenomeViewStateModel } from '../LinearGenomeView'

type LayoutRecord = [number, number, number, number]
const blockBasedTrack = types
  .compose(
    'BlockBasedTrackState',
    baseTrack,
    types
      .model({
        blockState: types.map(BlockState),
      })
      .volatile(() => ({
        featureIdUnderMouse: undefined as undefined | string,
        ReactComponent: BlockBasedTrack,
      })),
  )
  .views(self => {
    let stale = false // used to make rtree refresh, the mobx reactivity fails for some reason
    let rbush: { [key: string]: typeof RBush | undefined } = {}

    return {
      get blockType(): 'staticBlocks' | 'dynamicBlocks' {
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
        stale = true
        return new CompositeMap<string, Feature>(featureMaps)
      },

      /**
       * returns per-base block layouts as the data structure
       * Map<blockKey, Map<featureId, LayoutRecord>>
       *
       * this per-block is needed to avoid cross-contamination of
       * layouts across blocks especially when building the rtree
       */
      get blockLayoutFeatures() {
        const layoutMaps = new Map<string, Map<string, LayoutRecord>>()
        for (const block of self.blockState.values()) {
          if (block.data && block.data.layout && block.data.layout.rectangles) {
            layoutMaps.set(block.key, block.data.layout.rectangles)
          }
        }
        stale = true
        return layoutMaps
      },

      get featToBlock() {
        const m: { [key: string]: IRegion } = {}
        for (const block of self.blockState.values()) {
          if (block.data && block.data.features) {
            for (const [featId] of block.data.features) {
              m[featId] = block.region
            }
          }
        }
        return m
      },

      /**
       * a CompositeMap of featureId -> feature obj that
       * just looks in all the block data for that feature
       *
       * when you are not using the rtree you can use this
       * method because it still provides a stable reference
       * of a featureId to a layout record (when using the
       * rtree, you cross contaminate the coordinates)
       */
      get layoutFeatures() {
        const layoutMaps = []
        for (const block of self.blockState.values()) {
          if (block.data && block.data.layout && block.data.layout.rectangles) {
            layoutMaps.push(block.data.layout.rectangles)
          }
        }
        stale = true // make rtree refresh
        return new CompositeMap<string, LayoutRecord>(layoutMaps)
      },

      get rtree() {
        if (stale) {
          rbush = {}
          for (const [blockKey, layoutFeatures] of this.blockLayoutFeatures) {
            rbush[blockKey] = new RBush()
            const r = rbush[blockKey]
            for (const [key, layout] of layoutFeatures) {
              r.insert({
                minX: layout[0],
                minY: layout[1],
                maxX: layout[2],
                maxY: layout[3],
                name: key,
              })
            }
          }
          stale = false
        }
        return rbush
      },

      getFeatureOverlapping(blockKey: string, x: number, y: number) {
        const rect = { minX: x, minY: y, maxX: x + 1, maxY: y + 1 }
        const rtree = this.rtree[blockKey]
        return rtree && rtree.collides(rect) ? rtree.search(rect) : []
      },

      get blockDefinitions() {
        const { blockType } = this
        const view = getContainingView(self) as Instance<
          LinearGenomeViewStateModel
        >
        return view[blockType]
      },

      /**
       * returns a string feature ID if the globally-selected object
       * is probably a feature
       */
      get selectedFeatureId() {
        const session = getSession(self)
        if (!session) throw new Error('no session found in state tree!')
        const { selection } = session
        // does it quack like a feature?
        if (isFeature(selection)) {
          return selection.id()
        }
        return undefined
      },
    }
  })

  .actions(self => ({
    afterAttach() {
      // watch the parent's blocks to update our block state when they change
      const blockWatchDisposer = autorun(() => {
        // create any blocks that we need to create
        const blocksPresent: { [key: string]: boolean } = {}
        self.blockDefinitions.forEach(block => {
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
      const session = getSession(self)
      if (isSessionModelWithDrawerWidgets(session)) {
        const featureWidget = session.addDrawerWidget(
          'BaseFeatureDrawerWidget',
          'baseFeature',
          { featureData: feature.toJSON() },
        )
        session.showDrawerWidget(featureWidget)
      }
      if (isSelectionContainer(session)) {
        session.setSelection(feature)
      }
    },

    clearFeatureSelection() {
      const session = getSession(self)
      session.clearSelection()
    },

    setFeatureIdUnderMouse(feature: string | undefined) {
      self.featureIdUnderMouse = feature
    },
  }))

  .views(self => ({
    get composedRenderProps() {
      return {
        ...getParentRenderProps(self),
        trackModel: self,
        onFeatureClick(event: unknown, featureId: string | undefined) {
          const f = featureId || self.featureIdUnderMouse
          if (!f) {
            self.clearFeatureSelection()
          } else {
            const feature = self.features.get(f)
            self.selectFeature(feature as Feature)
          }
        },
        onClick() {
          self.clearFeatureSelection()
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
  })

export type BlockBasedTrackStateModel = typeof blockBasedTrack
export default blockBasedTrack
