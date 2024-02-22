/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { ThemeOptions } from '@mui/material'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { ConfigurationReference } from '@jbrowse/core/configuration'
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
import { BaseBlock } from '@jbrowse/core/util/blockTypes'
import CompositeMap from '@jbrowse/core/util/compositeMap'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { autorun } from 'mobx'
import { addDisposer, isAlive, types, Instance } from 'mobx-state-tree'

// icons
import MenuOpenIcon from '@mui/icons-material/MenuOpen'

// locals
import { LinearGenomeViewModel, ExportSvgOptions } from '../../LinearGenomeView'
import { Tooltip } from '../components/BaseLinearDisplay'
import BlockState from './serverSideRenderedBlock'
import configSchema from './configSchema'
import TrackHeightMixin from './TrackHeightMixin'
import FeatureDensityMixin from './FeatureDensityMixin'

type LGV = LinearGenomeViewModel

export interface Layout {
  minX: number
  minY: number
  maxX: number
  maxY: number
  name: string
}

type LayoutRecord = [number, number, number, number]

export interface ExportSvgDisplayOptions extends ExportSvgOptions {
  overrideHeight: number
  theme: ThemeOptions
}

/**
 * #stateModel BaseLinearDisplay
 * #category display
 *
 * BaseLinearDisplay is used as the basis for many linear genome view tracks.
 * It is block based, and can use 'static blocks' or 'dynamic blocks'
 *
 * extends
 * - [BaseDisplay](../basedisplay)
 * - [TrackHeightMixin](../trackheightmixin)
 * - [FeatureDensityMixin](../featuredensitymixin)
 */
function stateModelFactory() {
  return types
    .compose(
      'BaseLinearDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      FeatureDensityMixin(),
      types.model({
        /**
         * #property
         * updated via autorun
         */
        blockState: types.map(BlockState),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      featureIdUnderMouse: undefined as undefined | string,
      contextMenuFeature: undefined as undefined | Feature,
    }))
    .views(self => ({
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
        const view = getContainingView(self) as LGV
        if (!view.initialized) {
          throw new Error('view not initialized yet')
        }
        return view[this.blockType]
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
    }))

    .actions(self => ({
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

    .actions(self => {
      const { reload: superReload } = self

      return {
        /**
         * #action
         */
        async reload() {
          self.setError()
          self.setCurrStatsBpPerPx(0)
          self.clearFeatureDensityStats()
          ;[...self.blockState.values()].map(val => val.doReload())
          superReload()
        },
      }
    })

    .views(self => ({
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
          notReady: !self.featureDensityStatsReady,
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
      async renderSvg(opts: ExportSvgDisplayOptions) {
        const { renderBaseLinearDisplaySvg } = await import('./renderSvg')
        return renderBaseLinearDisplaySvg(self as BaseLinearDisplayModel, opts)
      },
      afterAttach() {
        // watch the parent's blocks to update our block state when they change,
        // then we recreate the blocks on our own model (creating and deleting to
        // match the parent blocks)
        addDisposer(
          self,
          autorun(() => {
            const blocksPresent: Record<string, boolean> = {}
            const view = getContainingView(self) as LGV
            if (!view.initialized) {
              return
            }
            self.blockDefinitions.contentBlocks.forEach(block => {
              blocksPresent[block.key] = true
              if (!self.blockState.has(block.key)) {
                self.addBlock(block.key, block)
              }
            })
            self.blockState.forEach((_, key) => {
              if (!blocksPresent[key]) {
                self.deleteBlock(key as string)
              }
            })
          }),
        )
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
