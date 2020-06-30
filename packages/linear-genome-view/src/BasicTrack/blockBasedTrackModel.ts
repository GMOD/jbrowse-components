import CompositeMap from '@gmod/jbrowse-core/util/compositeMap'
import { getParentRenderProps } from '@gmod/jbrowse-core/util/tracks'
import { autorun } from 'mobx'
import {
  getSession,
  getContainingView,
  isSessionModelWithDrawerWidgets,
  isSelectionContainer,
} from '@gmod/jbrowse-core/util'
import { Region } from '@gmod/jbrowse-core/util/types'
import { addDisposer, types, Instance, isAlive } from 'mobx-state-tree'
import RBush from 'rbush'
import { Feature, isFeature } from '@gmod/jbrowse-core/util/simpleFeature'
import MenuOpenIcon from '@material-ui/icons/MenuOpen'
import BlockState from './util/serverSideRenderedBlock'
import baseTrack from './baseTrackModel'
import { BaseBlock } from './util/blockTypes'
import BlockBasedTrack, { Tooltip } from './components/BlockBasedTrack'
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
        ReactComponent: (BlockBasedTrack as unknown) as React.FC, // avoid circular reference
        contextMenuFeature: undefined as undefined | Feature,
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      get TooltipComponent(): React.FC<any> {
        return (Tooltip as unknown) as React.FC
      },

      /**
       * a CompositeMap of `featureId -> feature obj` that
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

      get featureUnderMouse() {
        return self.featureIdUnderMouse
          ? this.features.get(self.featureIdUnderMouse)
          : undefined
      },

      /**
       * returns per-base block layouts as the data structure
       * `Map<blockKey, Map<featureId, LayoutRecord>>`
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
        const m: { [key: string]: Region } = {}
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
       * a CompositeMap of `featureId -> feature obj` that
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
        if (isAlive(self)) {
          const session = getSession(self)
          const { selection } = session
          // does it quack like a feature?
          if (isFeature(selection)) {
            return selection.id()
          }
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
        self.blockDefinitions.contentBlocks.forEach(block => {
          blocksPresent[block.key] = true
          if (!self.blockState.has(block.key)) {
            this.addBlock(block.key, block)
          }
        })
        // delete any blocks we need go delete
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
    reload() {
      const temp = JSON.parse(JSON.stringify(self.blockState))
      Object.keys(temp).forEach(blockState => {
        temp[blockState].key += '-reload'
      })
      self.blockState = temp
    },
  }))
  .actions(self => ({
    setContextMenuFeature(feature?: Feature) {
      self.contextMenuFeature = feature
    },
  }))

  .views(self => ({
    get contextMenuOptions() {
      return self.contextMenuFeature
        ? [
            {
              label: 'Open feature details',
              icon: MenuOpenIcon,
              onClick: () => {
                if (self.contextMenuFeature) {
                  self.selectFeature(self.contextMenuFeature)
                }
              },
            },
          ]
        : []
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
        // similar to click but opens a menu with further options
        onFeatureContextMenu(event: unknown, featureId: string | undefined) {
          const f = featureId || self.featureIdUnderMouse
          if (!f) {
            self.clearFeatureSelection()
          } else {
            // feature id under mouse passed to context menu
            self.setContextMenuFeature(self.features.get(f))
          }
        },

        onMouseMove(event: unknown, featureId: string | undefined) {
          self.setFeatureIdUnderMouse(featureId)
        },

        onMouseLeave(event: unknown) {
          self.setFeatureIdUnderMouse(undefined)
        },

        onContextMenu() {
          self.setContextMenuFeature(undefined)
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
export type BlockBasedTrackModel = Instance<BlockBasedTrackStateModel>
export default blockBasedTrack
