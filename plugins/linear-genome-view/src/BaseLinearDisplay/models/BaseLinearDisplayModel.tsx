<<<<<<< HEAD:plugins/linear-genome-view/src/BaseLinearDisplay/blockBasedTrackModel.tsx
import React from 'react'
import CompositeMap from '@gmod/jbrowse-core/util/compositeMap'
import { getParentRenderProps } from '@gmod/jbrowse-core/util/tracks'
import { autorun } from 'mobx'
=======
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getConf } from '@jbrowse/core/configuration'
import { MenuItem } from '@jbrowse/core/ui'
>>>>>>> origin/master:plugins/linear-genome-view/src/BaseLinearDisplay/models/BaseLinearDisplayModel.tsx
import {
  getContainingView,
  getSession,
  isSelectionContainer,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { BaseBlock } from '@jbrowse/core/util/blockTypes'
import CompositeMap from '@jbrowse/core/util/compositeMap'
import { Feature, isFeature } from '@jbrowse/core/util/simpleFeature'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import Button from '@material-ui/core/Button'
import Typography from '@material-ui/core/Typography'
import MenuOpenIcon from '@material-ui/icons/MenuOpen'
<<<<<<< HEAD:plugins/linear-genome-view/src/BaseLinearDisplay/blockBasedTrackModel.tsx
import BlockState, { renderBlockData } from './util/serverSideRenderedBlock'
import baseTrack from './baseTrackModel'
import BlockBasedTrack, { Tooltip } from './components/BlockBasedTrack'
import { LinearGenomeViewModel } from '../LinearGenomeView'
=======
import { autorun } from 'mobx'
import { addDisposer, Instance, isAlive, types } from 'mobx-state-tree'
import RBush from 'rbush'
import React from 'react'
import { Tooltip } from '../components/BaseLinearDisplay'
import BlockState from './serverSideRenderedBlock'
import { LinearGenomeViewModel } from '../../LinearGenomeView'
>>>>>>> origin/master:plugins/linear-genome-view/src/BaseLinearDisplay/models/BaseLinearDisplayModel.tsx

export interface Layout {
  minX: number
  minY: number
  maxX: number
  maxY: number
  name: string
}
type LayoutRecord = [number, number, number, number]

const minDisplayHeight = 20
const defaultDisplayHeight = 100
export const BaseLinearDisplay = types
  .compose(
    'BaseLinearDisplay',
    BaseDisplay,
    types.model({
      height: types.optional(
        types.refinement(
          'displayHeight',
          types.number,
          n => n >= minDisplayHeight,
        ),
        defaultDisplayHeight,
      ),
      blockState: types.map(BlockState),
    }),
  )
<<<<<<< HEAD:plugins/linear-genome-view/src/BaseLinearDisplay/blockBasedTrackModel.tsx
  .views(self => ({
    get blockType(): 'staticBlocks' | 'dynamicBlocks' {
      return 'staticBlocks'
    },
    get blockDefinitions() {
      const { blockType } = this
      const view = getContainingView(self) as LinearGenomeViewModel
      return view[blockType]
    },
  }))
  .views(self => {
    let stale = false // used to make rtree refresh, the mobx reactivity fails for some reason
    let rbush: { [key: string]: typeof RBush | undefined } = {}

    return {
      /**
       * how many milliseconds to wait for the display to
       * "settle" before re-rendering a block
       */
      get renderDelay() {
        return 50
      },
=======
  .volatile(() => ({
    message: '',
    featureIdUnderMouse: undefined as undefined | string,
    contextMenuFeature: undefined as undefined | Feature,
    additionalContextMenuItemCallbacks: [] as Function[],

    scrollTop: 0,
    userBpPerPxLimit: undefined as undefined | number,
  }))
  .views(self => ({
    /**
     * set limit to config amount, or user amount if they force load,
     */
    get maxViewBpPerPx() {
      return self.userBpPerPxLimit || getConf(self, 'maxDisplayedBpPerPx')
    },
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
>>>>>>> origin/master:plugins/linear-genome-view/src/BaseLinearDisplay/models/BaseLinearDisplayModel.tsx

    get TooltipComponent(): React.FC<any> {
      return (Tooltip as unknown) as React.FC
    },

    get blockDefinitions() {
      const { blockType } = this
      const view = getContainingView(self) as LinearGenomeViewModel
      if (!view.initialized) {
        throw new Error('view not initialized yet')
      }
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
    /**
     * if a display-level message should be displayed instead of the blocks,
     * make this return a react component
     */
    get DisplayMessageComponent() {
      return undefined as undefined | React.FC<any>
    },
  }))
  .views(self => {
    let stale = false // used to make rtree refresh, the mobx reactivity fails for some reason
    let rbush: Record<string, RBush<Layout>> = {}
    return {
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
          rbush = {} as Record<string, RBush<Layout>>
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
<<<<<<< HEAD:plugins/linear-genome-view/src/BaseLinearDisplay/blockBasedTrackModel.tsx

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
=======
>>>>>>> origin/master:plugins/linear-genome-view/src/BaseLinearDisplay/models/BaseLinearDisplayModel.tsx
    }
  })
  .actions(self => ({
    afterAttach() {
      // watch the parent's blocks to update our block state when they change
      const blockWatchDisposer = autorun(() => {
        // create any blocks that we need to create
        const blocksPresent: { [key: string]: boolean } = {}
        const view = getContainingView(self) as LinearGenomeViewModel
        if (view.initialized) {
          self.blockDefinitions.contentBlocks.forEach(block => {
            blocksPresent[block.key] = true
            if (!self.blockState.has(block.key)) {
              this.addBlock(block.key, block)
            }
          })
          // delete any blocks we need go delete
          self.blockState.forEach((_, key) => {
            if (!blocksPresent[key]) this.deleteBlock(key)
          })
        }
      })

      addDisposer(self, blockWatchDisposer)
    },
    setHeight(displayHeight: number) {
      if (displayHeight > minDisplayHeight) self.height = displayHeight
      else self.height = minDisplayHeight
      return self.height
    },
    resizeHeight(distance: number) {
      const oldHeight = self.height
      const newHeight = this.setHeight(self.height + distance)
      return newHeight - oldHeight
    },
    setScrollTop(scrollTop: number) {
      self.scrollTop = scrollTop
    },
    // sets the new bpPerPxLimit if user chooses to force load
    setUserBpPerPxLimit(limit: number) {
      self.userBpPerPxLimit = limit
    },
    // base display reload does nothing, see specialized displays for details
    setMessage(message: string) {
      self.message = message
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
      if (isSessionModelWithWidgets(session)) {
        const featureWidget = session.addWidget(
          'BaseFeatureWidget',
          'baseFeature',
          { featureData: feature.toJSON() },
        )
        session.showWidget(featureWidget)
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
    addAdditionalContextMenuItemCallback(callback: Function) {
      self.additionalContextMenuItemCallbacks.push(callback)
    },
<<<<<<< HEAD:plugins/linear-genome-view/src/BaseLinearDisplay/blockBasedTrackModel.tsx
    async renderSvg() {
      const view = getContainingView(self) as LinearGenomeViewModel
      const viewOffset = view.offsetPx
      const { dynamicBlocks } = view
      const renderings = await Promise.all(
        dynamicBlocks.contentBlocks.map(block => {
          const blockState = BlockState.create({
            key: block.key,
            region: block.toRegion(),
          })
          const {
            rpcManager,
            renderArgs = { renderProps: {} },
            rendererType,
          } = renderBlockData(blockState, self)

          return rendererType.renderInClient(rpcManager, {
            ...renderArgs,
            renderProps: {
              ...renderArgs.renderProps,
              forceSvg: true,
            },
          })
        }),
      )
      return (
        <>
          {renderings.map((rendering, index) => {
            const { offsetPx, key } = dynamicBlocks.contentBlocks[index]
            return (
              <g
                key={key}
                transform={`translate(${offsetPx - viewOffset} 0)`}
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: rendering.html }}
              />
            )
          })}
        </>
      )
    },
  }))
  .actions(self => ({
=======
>>>>>>> origin/master:plugins/linear-genome-view/src/BaseLinearDisplay/models/BaseLinearDisplayModel.tsx
    setContextMenuFeature(feature?: Feature) {
      self.contextMenuFeature = feature
    },
  }))
  .views(self => ({
    /**
     * @param region -
     * @returns falsy if the region is fine to try rendering. Otherwise,
     *  return a react node + string of text.
     *  string of text describes why it cannot be rendered
     *  react node allows user to force load at current setting
     */
    regionCannotBeRendered(/* region */) {
      const view = getContainingView(self) as LinearGenomeViewModel
      if (view && view.bpPerPx > self.maxViewBpPerPx) {
        return (
          <>
            <Typography component="span" variant="body2">
              Zoom in to see features or{' '}
            </Typography>
            <Button
              data-testid="reload_button"
              onClick={() => {
                self.setUserBpPerPxLimit(view.bpPerPx)
                self.reload()
              }}
              variant="outlined"
            >
              Force Load
            </Button>
            <Typography component="span" variant="body2">
              (force load may be slow)
            </Typography>
          </>
        )
      }
      return undefined
    },

    get trackMenuItems(): MenuItem[] {
      return []
    },
    // distinct set of display items that are particular to this display type. for
    // base, there are none
    //
    // note: this attribute is helpful when composing together multiple
    // subdisplays so that you don't repeat the "about this track" from each
    // child display
    get composedTrackMenuItems(): MenuItem[] {
      return []
    },
    get contextMenuItems() {
      const { pluginManager } = getSession(self)
      const contextMenuItems = self.contextMenuFeature
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

      self.additionalContextMenuItemCallbacks.forEach(callback => {
        const menuItems = callback(self.contextMenuFeature, self, pluginManager)
        contextMenuItems.push(...menuItems)
      })
      return contextMenuItems
    },
    get composedRenderProps() {
      return {
        ...getParentRenderProps(self),
        displayModel: self,
        onFeatureClick(_: unknown, featureId: string | undefined) {
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
        onFeatureContextMenu(_: unknown, featureId: string | undefined) {
          const f = featureId || self.featureIdUnderMouse
          if (!f) {
            self.clearFeatureSelection()
          } else {
            // feature id under mouse passed to context menu
            self.setContextMenuFeature(self.features.get(f))
          }
        },

        onMouseMove(_: unknown, featureId: string | undefined) {
          self.setFeatureIdUnderMouse(featureId)
        },

        onMouseLeave(_: unknown) {
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

export type BaseLinearDisplayStateModel = typeof BaseLinearDisplay
export type BaseLinearDisplayModel = Instance<BaseLinearDisplayStateModel>
