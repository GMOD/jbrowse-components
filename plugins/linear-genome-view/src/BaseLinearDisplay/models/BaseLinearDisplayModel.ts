import type React from 'react'
import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isFeature,
  isSelectionContainer,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import CompositeMap from '@jbrowse/core/util/compositeMap'
import {
  getParentRenderProps,
  getRpcSessionId,
} from '@jbrowse/core/util/tracks'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import copy from 'copy-to-clipboard'
import { autorun } from 'mobx'
import { addDisposer, isAlive, types } from 'mobx-state-tree'

import FeatureDensityMixin from './FeatureDensityMixin'
import TrackHeightMixin from './TrackHeightMixin'
import configSchema from './configSchema'
import BlockState from './serverSideRenderedBlock'

import type { LinearGenomeViewModel } from '../../LinearGenomeView'
import type { ExportSvgOptions } from '../../LinearGenomeView/types'
import type { MenuItem } from '@jbrowse/core/ui'
import type { AnyReactComponentType, Feature } from '@jbrowse/core/util'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'
import type { ThemeOptions } from '@mui/material'
import type { Instance } from 'mobx-state-tree'

// lazies
const Tooltip = lazy(() => import('../components/Tooltip'))

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
      /**
       * #volatile
       */
      featureIdUnderMouse: undefined as undefined | string,
      /**
       * #volatile
       */
      contextMenuFeature: undefined as undefined | Feature,
    }))
    .views(self => ({
      /**
       * #getter
       * if a display-level message should be displayed instead of the blocks,
       * make this return a react component
       */
      get DisplayMessageComponent(): undefined | React.FC<any> {
        return undefined
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
      get TooltipComponent(): AnyReactComponentType {
        return Tooltip as AnyReactComponentType
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
       * #method
       */
      copyInfoToClipboard(feature: Feature) {
        const { uniqueId, ...rest } = feature.toJSON()
        const session = getSession(self)
        copy(JSON.stringify(rest, null, 4))
        session.notify('Copied to clipboard', 'success')
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
          if (block.features) {
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
        let ret: LayoutRecord | undefined
        for (const block of self.blockState.values()) {
          const val = block.layout?.getByID(id)
          if (val) {
            ret = val
          }
        }
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
          const { rpcManager } = session
          const sessionId = getRpcSessionId(self)
          const track = getContainingTrack(self)
          const view = getContainingView(self)
          const adapterConfig = getConf(track, 'adapter')

          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          ;(async () => {
            try {
              const descriptions = await rpcManager.call(
                sessionId,
                'CoreGetMetadata',
                {
                  adapterConfig,
                },
              )
              session.showWidget(
                session.addWidget('BaseFeatureWidget', 'baseFeature', {
                  featureData: feature.toJSON(),
                  view,
                  track,
                  descriptions,
                }),
              )
            } catch (e) {
              console.error(e)
              getSession(e).notifyError(`${e}`, e)
            }
          })()
        }

        if (isSelectionContainer(session)) {
          session.setSelection(feature)
        }
      },

      /**
       * #action
       */
      navToFeature(feature: Feature) {
        const view = getContainingView(self) as LGV
        view.navTo({
          refName: feature.get('refName'),
          start: feature.get('start'),
          end: feature.get('end'),
        })
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
          for (const val of self.blockState.values()) {
            val.doReload()
          }
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
        const feat = self.contextMenuFeature
        return feat
          ? [
              {
                label: 'Open feature details',
                icon: MenuOpenIcon,
                onClick: () => {
                  self.selectFeature(feat)
                },
              },
              {
                label: 'Zoom to feature',
                icon: CenterFocusStrongIcon,
                onClick: () => {
                  self.navToFeature(feat)
                },
              },
              {
                label: 'Copy info to clipboard',
                icon: ContentCopyIcon,
                onClick: () => {
                  self.copyInfoToClipboard(feat)
                },
              },
            ]
          : []
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
        // watch the parent's blocks to update our block state when they
        // change, then we recreate the blocks on our own model (creating and
        // deleting to match the parent blocks)
        addDisposer(
          self,
          autorun(() => {
            const blocksPresent: Record<string, boolean> = {}
            const view = getContainingView(self) as LGV
            if (!view.initialized) {
              return
            }
            for (const block of self.blockDefinitions.contentBlocks) {
              blocksPresent[block.key] = true
              if (!self.blockState.has(block.key)) {
                self.addBlock(block.key, block)
              }
            }
            for (const key of self.blockState.keys()) {
              if (!blocksPresent[key]) {
                self.deleteBlock(key)
              }
            }
          }),
        )
      },
    }))
    .preProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      // rewrite "height" from older snapshots to "heightPreConfig", this allows
      // us to maintain a height "getter" going forward
      // @ts-expect-error
      const { height, ...rest } = snap
      return { heightPreConfig: height, ...rest }
    })
    .postProcessSnapshot(snap => {
      // xref https://github.com/mobxjs/mobx-state-tree/issues/1524 for Omit
      const r = snap as Omit<typeof snap, symbol>
      const { blockState, ...rest } = r
      return rest
    })
}

export const BaseLinearDisplay = stateModelFactory()

export type BaseLinearDisplayStateModel = typeof BaseLinearDisplay
export type BaseLinearDisplayModel = Instance<BaseLinearDisplayStateModel>
