/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { ThemeOptions } from '@mui/material'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { MenuItem } from '@jbrowse/core/ui'
import {
  getContainingView,
  getContainingTrack,
  getSession,
  isSelectionContainer,
  isSessionModelWithWidgets,
  isFeature,
  Feature,
} from '@jbrowse/core/util'
import { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter'
import { BaseBlock } from '@jbrowse/core/util/blockTypes'
import { Region } from '@jbrowse/core/util/types'
import CompositeMap from '@jbrowse/core/util/compositeMap'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { autorun } from 'mobx'
import { addDisposer, isAlive, types, Instance } from 'mobx-state-tree'

// icons
import MenuOpenIcon from '@mui/icons-material/MenuOpen'

// locals
import { LinearGenomeViewModel, ExportSvgOptions } from '../../LinearGenomeView'
import { Tooltip } from '../components/BaseLinearDisplay'
import TooLargeMessage from '../components/TooLargeMessage'
import BlockState from './serverSideRenderedBlock'
import { getDisplayStr, getFeatureDensityStatsPre } from './util'
import configSchema from './configSchema'
import autorunFeatureDensityStats from './autorunFeatureDensityStats'
import renderBaseLinearDisplaySvg from './renderSvg'

type LGV = LinearGenomeViewModel

export interface Layout {
  minX: number
  minY: number
  maxX: number
  maxY: number
  name: string
}

type LayoutRecord = [number, number, number, number]

const minDisplayHeight = 20

/**
 * #stateModel BaseLinearDisplay
 * extends `BaseDisplay`
 */
function stateModelFactory() {
  return types
    .compose(
      'BaseLinearDisplay',
      BaseDisplay,
      types.model({
        /**
         * #property
         */
        heightPreConfig: types.maybe(
          types.refinement(
            'displayHeight',
            types.number,
            n => n >= minDisplayHeight,
          ),
        ),
        /**
         * #property
         * updated via autorun
         */
        blockState: types.map(BlockState),
        /**
         * #property
         */
        userBpPerPxLimit: types.maybe(types.number),
        /**
         * #property
         */
        userByteSizeLimit: types.maybe(types.number),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      currBpPerPx: 0,
      scrollTop: 0,
      message: '',
      featureIdUnderMouse: undefined as undefined | string,
      contextMenuFeature: undefined as undefined | Feature,
      featureDensityStatsP: undefined as
        | undefined
        | Promise<FeatureDensityStats>,
      featureDensityStats: undefined as undefined | FeatureDensityStats,
    }))
    .views(self => ({
      get height() {
        return self.heightPreConfig ?? (getConf(self, 'height') as number)
      },
      /**
       * #getter
       */
      get blockType(): 'staticBlocks' | 'dynamicBlocks' {
        return 'staticBlocks'
      },
      /**
       * #getter
       */
      get blockDefinitions() {
        const { blockType } = this
        const view = getContainingView(self) as LGV
        if (!view.initialized) {
          throw new Error('view not initialized yet')
        }
        return view[blockType]
      },
    }))
    .views(self => ({
      /**
       * #getter
       * how many milliseconds to wait for the display to
       * "settle" before re-rendering a block
       */
      get renderDelay() {
        return 50
      },

      /**
       * #getter
       */
      get TooltipComponent(): React.FC<any> {
        return Tooltip as unknown as React.FC
      },

      /**
       * #getter
       * returns a string feature ID if the globally-selected object
       * is probably a feature
       */
      get selectedFeatureId() {
        if (isAlive(self)) {
          const { selection } = getSession(self)
          // does it quack like a feature?
          if (isFeature(selection)) {
            return selection.id()
          }
        }
        return undefined
      },
      /**
       * #getter
       * if a display-level message should be displayed instead of the blocks,
       * make this return a react component
       */
      get DisplayMessageComponent() {
        return undefined as undefined | React.FC<any>
      },
    }))
    .views(self => ({
      /**
       * #getter
       * a CompositeMap of `featureId -> feature obj` that
       * just looks in all the block data for that feature
       */
      get features() {
        const featureMaps = []
        for (const block of self.blockState.values()) {
          if (block?.features) {
            featureMaps.push(block.features)
          }
        }
        return new CompositeMap(featureMaps)
      },

      /**
       * #getter
       */
      get featureUnderMouse() {
        const feat = self.featureIdUnderMouse
        return feat ? this.features.get(feat) : undefined
      },

      /**
       * #getter
       */
      getFeatureOverlapping(
        blockKey: string,
        x: number,
        y: number,
      ): string | undefined {
        return self.blockState.get(blockKey)?.layout?.getByCoord(x, y)
      },

      /**
       * #getter
       */
      getFeatureByID(blockKey: string, id: string): LayoutRecord | undefined {
        return self.blockState.get(blockKey)?.layout?.getByID(id)
      },

      /**
       * #getter
       */
      searchFeatureByID(id: string): LayoutRecord | undefined {
        let ret
        self.blockState.forEach(block => {
          const val = block?.layout?.getByID(id)
          if (val) {
            ret = val
          }
        })
        return ret
      },

      /**
       * #getter
       */
      get currentBytesRequested() {
        return self.featureDensityStats?.bytes || 0
      },

      /**
       * #getter
       */
      get currentFeatureScreenDensity() {
        const view = getContainingView(self) as LGV
        return (self.featureDensityStats?.featureDensity || 0) * view.bpPerPx
      },

      /**
       * #getter
       */
      get maxFeatureScreenDensity() {
        return getConf(self, 'maxFeatureScreenDensity')
      },
      /**
       * #getter
       */
      get featureDensityStatsReady() {
        return !!self.featureDensityStats || !!self.userBpPerPxLimit
      },

      /**
       * #getter
       */
      get maxAllowableBytes() {
        return (
          self.userByteSizeLimit ||
          self.featureDensityStats?.fetchSizeLimit ||
          (getConf(self, 'fetchSizeLimit') as number)
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setMessage(message: string) {
        self.message = message
      },
    }))
    .actions(self => ({
      afterAttach() {
        // watch the parent's blocks to update our block state when they change,
        // then we recreate the blocks on our own model (creating and deleting to
        // match the parent blocks)
        addDisposer(
          self,
          autorun(() => {
            const blocksPresent: { [key: string]: boolean } = {}
            const view = getContainingView(self) as LGV
            if (view.initialized) {
              self.blockDefinitions.contentBlocks.forEach(block => {
                blocksPresent[block.key] = true
                if (!self.blockState.has(block.key)) {
                  this.addBlock(block.key, block)
                }
              })
              self.blockState.forEach((_, key) => {
                if (!blocksPresent[key]) {
                  this.deleteBlock(key)
                }
              })
            }
          }),
        )
      },

      /**
       * #action
       */
      async getFeatureDensityStats() {
        if (!self.featureDensityStatsP) {
          self.featureDensityStatsP = getFeatureDensityStatsPre(self).catch(
            e => {
              this.setFeatureDensityStatsP(undefined)
              throw e
            },
          )
        }
        return self.featureDensityStatsP
      },

      /**
       * #action
       */
      setFeatureDensityStatsP(arg: any) {
        self.featureDensityStatsP = arg
      },

      /**
       * #action
       */
      setFeatureDensityStats(featureDensityStats?: FeatureDensityStats) {
        self.featureDensityStats = featureDensityStats
      },
      /**
       * #action
       */
      clearFeatureDensityStats() {
        self.featureDensityStatsP = undefined
        self.featureDensityStats = undefined
      },
      /**
       * #action
       */
      setHeight(displayHeight: number) {
        self.heightPreConfig = Math.max(displayHeight, minDisplayHeight)
        return self.height
      },
      /**
       * #action
       */
      resizeHeight(distance: number) {
        const oldHeight = self.height
        const newHeight = this.setHeight(self.height + distance)
        return newHeight - oldHeight
      },

      /**
       * #action
       */
      setScrollTop(scrollTop: number) {
        self.scrollTop = scrollTop
      },

      /**
       * #action
       */
      setFeatureDensityStatsLimit(stats?: FeatureDensityStats) {
        const view = getContainingView(self) as LGV
        if (stats?.bytes) {
          self.userByteSizeLimit = stats.bytes
        } else {
          self.userBpPerPxLimit = view.bpPerPx
        }
      },

      /**
       * #action
       */
      addBlock(key: string, block: BaseBlock) {
        self.blockState.set(
          key,
          BlockState.create({
            key,
            region: block.toRegion(),
          }),
        )
      },
      /**
       * #action
       */
      setCurrBpPerPx(n: number) {
        self.currBpPerPx = n
      },
      /**
       * #action
       */
      deleteBlock(key: string) {
        self.blockState.delete(key)
      },
      /**
       * #action
       */
      selectFeature(feature: Feature) {
        const session = getSession(self)
        if (isSessionModelWithWidgets(session)) {
          const featureWidget = session.addWidget(
            'BaseFeatureWidget',
            'baseFeature',
            {
              view: getContainingView(self),
              track: getContainingTrack(self),
              featureData: feature.toJSON(),
            },
          )

          session.showWidget(featureWidget)
        }
        if (isSelectionContainer(session)) {
          session.setSelection(feature)
        }
      },
      /**
       * #action
       */
      clearFeatureSelection() {
        getSession(self).clearSelection()
      },
      /**
       * #action
       */
      setFeatureIdUnderMouse(feature?: string) {
        self.featureIdUnderMouse = feature
      },

      /**
       * #action
       */
      setContextMenuFeature(feature?: Feature) {
        self.contextMenuFeature = feature
      },
    }))
    .views(self => ({
      /**
       * #getter
       * region is too large if:
       * - stats are ready
       * - region is greater than 20kb (don't warn when zoomed in less than that)
       * - and bytes is greater than max allowed bytes or density greater than max
       *   density
       */
      get regionTooLarge() {
        const view = getContainingView(self) as LGV
        if (
          !self.featureDensityStatsReady ||
          view.dynamicBlocks.totalBp < 20_000
        ) {
          return false
        }
        return (
          self.currentBytesRequested > self.maxAllowableBytes ||
          (self.userBpPerPxLimit
            ? view.bpPerPx > self.userBpPerPxLimit
            : self.currentFeatureScreenDensity > self.maxFeatureScreenDensity)
        )
      },

      /**
       * #getter
       * only shows a message of bytes requested is defined, the feature density
       * based stats don't produce any helpful message besides to zoom in
       */
      get regionTooLargeReason() {
        const req = self.currentBytesRequested
        const max = self.maxAllowableBytes

        return req && req > max
          ? `Requested too much data (${getDisplayStr(req)})`
          : ''
      },

      get notReady() {
        const view = getContainingView(self) as LGV
        return (
          self.currBpPerPx !== view.bpPerPx || !self.featureDensityStatsReady
        )
      },
    }))
    .actions(self => {
      const { reload: superReload } = self

      return {
        /**
         * #action
         */
        async reload() {
          self.setError()
          self.setCurrBpPerPx(0)
          self.clearFeatureDensityStats()
          ;[...self.blockState.values()].map(val => val.doReload())
          superReload()
        },
      }
    })
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(() =>
            autorunFeatureDensityStats(self as BaseLinearDisplayModel),
          ),
        )
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      regionCannotBeRenderedText(_region: Region) {
        return self.regionTooLarge ? 'Force load to see features' : ''
      },

      /**
       * #method
       * @param region -
       * @returns falsy if the region is fine to try rendering. Otherwise,
       *  return a react node + string of text.
       *  string of text describes why it cannot be rendered
       *  react node allows user to force load at current setting
       */
      regionCannotBeRendered(_region: Region) {
        return self.regionTooLarge ? <TooLargeMessage model={self} /> : null
      },

      /**
       * #method
       */
      trackMenuItems(): MenuItem[] {
        return []
      },

      /**
       * #method
       */
      contextMenuItems(): MenuItem[] {
        return [
          ...(self.contextMenuFeature
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
            : []),
        ]
      },
      /**
       * #method
       */
      renderProps() {
        return {
          ...getParentRenderProps(self),
          notReady: self.notReady,
          rpcDriverName: self.rpcDriverName,
          displayModel: self,
          onFeatureClick(_: unknown, featureId?: string) {
            const f = featureId || self.featureIdUnderMouse
            if (!f) {
              self.clearFeatureSelection()
            } else {
              const feature = self.features.get(f)
              if (feature) {
                self.selectFeature(feature)
              }
            }
          },
          onClick() {
            self.clearFeatureSelection()
          },
          // similar to click but opens a menu with further options
          onFeatureContextMenu(_: unknown, featureId?: string) {
            const f = featureId || self.featureIdUnderMouse
            if (!f) {
              self.clearFeatureSelection()
            } else {
              // feature id under mouse passed to context menu
              self.setContextMenuFeature(self.features.get(f))
            }
          },

          onMouseMove(_: unknown, featureId?: string) {
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
    }))
    .actions(self => ({
      /**
       * #method
       */
      async renderSvg(
        opts: ExportSvgOptions & {
          overrideHeight: number
          theme: ThemeOptions
        },
      ) {
        return renderBaseLinearDisplaySvg(self as BaseLinearDisplayModel, opts)
      },
    }))
    .preProcessSnapshot(snap => {
      if (!snap) {
        return snap
      }
      // rewrite "height" from older snapshots to "heightPreConfig", this allows
      // us to maintain a height "getter" going forward
      // @ts-expect-error
      const { height, ...rest } = snap
      return { heightPreConfig: height, ...rest }
    })
    .postProcessSnapshot(self => {
      // xref https://github.com/mobxjs/mobx-state-tree/issues/1524 for Omit
      const r = self as Omit<typeof self, symbol>
      const { blockState, ...rest } = r
      return rest
    })
}

export const BaseLinearDisplay = stateModelFactory()

export type BaseLinearDisplayStateModel = typeof BaseLinearDisplay
export type BaseLinearDisplayModel = Instance<BaseLinearDisplayStateModel>
