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
import { addDisposer, flow, isAlive, types } from '@jbrowse/mobx-state-tree'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import { autorun } from 'mobx'

import { calculateSvgLegendWidth } from './calculateSvgLegendWidth.ts'
import { deduplicateFeatureLabels } from './components/util.ts'
import FeatureDensityMixin from './models/FeatureDensityMixin.tsx'
import TrackHeightMixin from './models/TrackHeightMixin.tsx'
import configSchema from './models/configSchema.ts'
import BlockState from './models/serverSideRenderedBlock.ts'
import {
  fetchFeatureByIdRpc,
  findSubfeatureById,
  getTranscripts,
  hasIntrons,
} from './util.ts'

import type { LinearGenomeViewModel } from '../LinearGenomeView/index.ts'
import type { LegendItem } from './components/FloatingLegend.tsx'
import type { ExportSvgDisplayOptions, LayoutRecord } from './types.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { AnyReactComponentType, Feature } from '@jbrowse/core/util'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { Theme } from '@mui/material'

// lazies
const Tooltip = lazy(() => import('./components/Tooltip.tsx'))
const CollapseIntronsDialog = lazy(
  () => import('./components/CollapseIntronsDialog/CollapseIntronsDialog.tsx'),
)

type LGV = LinearGenomeViewModel

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
        /**
         * #property
         */
        showLegend: types.maybe(types.boolean),
        /**
         * #property
         */
        showTooltips: types.maybe(types.boolean),
      }),
    )
    .volatile(() => ({
      mouseoverExtraInformation: undefined as string | undefined,
      /**
       * #volatile
       */
      featureIdUnderMouse: undefined as undefined | string,
      /**
       * #volatile
       */
      subfeatureIdUnderMouse: undefined as undefined | string,
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
       * #method
       * Override in subclasses to provide legend items for the display
       * @param _theme - MUI theme for accessing palette colors
       */
      legendItems(_theme?: Theme): LegendItem[] {
        return []
      },

      /**
       * #method
       * Returns the width needed for the SVG legend if showLegend is enabled.
       * Used by SVG export to add extra width for the legend area.
       * @param theme - MUI theme for accessing palette colors
       */
      svgLegendWidth(theme?: Theme): number {
        return self.showLegend
          ? calculateSvgLegendWidth(this.legendItems(theme))
          : 0
      },

      /**
       * #getter
       * returns a string feature ID if the globally-selected object
       * is probably a feature
       */
      get selectedFeatureId() {
        if (isAlive(self)) {
          const { selection } = getSession(self)
          if (isFeature(selection)) {
            return selection.id()
          }
        }
        return undefined
      },

      /**
       * #getter
       * Override in subclasses to use a different feature widget
       */
      get featureWidgetType() {
        return {
          type: 'BaseFeatureWidget',
          id: 'baseFeature',
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * whether to show tooltips on mouseover, defaults to true
       */
      get showTooltipsEnabled() {
        return self.showTooltips ?? true
      },

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
       * #method
       * Finds a feature by ID, checking both top-level features and
       * subfeatures if parentFeatureId is provided
       */
      getFeatureById(featureId: string, parentFeatureId?: string) {
        const feature = this.features.get(featureId)
        if (feature) {
          return feature
        }
        if (parentFeatureId) {
          const parent = this.features.get(parentFeatureId)
          if (parent) {
            return findSubfeatureById(parent, featureId)
          }
        }
        return undefined
      },

      /**
       * #getter
       */
      get layoutFeatures() {
        const featureMaps = []
        for (const block of self.blockState.values()) {
          if (block.layout?.getRectangles) {
            // Use getRectangles() to get consistent tuple format [left, top, right, bottom, data]
            // This works for both GranularRectLayout (raw) and PrecomputedLayout (serialized)
            featureMaps.push(block.layout.getRectangles())
          }
        }
        return new CompositeMap<string, LayoutRecord>(featureMaps)
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
        for (const block of self.blockState.values()) {
          const val = block.layout?.getByID(id)
          if (val) {
            return val
          }
        }
        return undefined
      },

      /**
       * #getter
       * Deduplicated floating label data, computed and cached by MobX
       */
      get floatingLabelData() {
        const view = getContainingView(self) as LGV
        const { assemblyManager } = getSession(self)
        const assemblyName = view.assemblyNames[0]
        const assembly = assemblyName
          ? assemblyManager.get(assemblyName)
          : undefined
        return deduplicateFeatureLabels(
          this.layoutFeatures,
          view,
          assembly,
          view.bpPerPx,
        )
      },
    }))

    .actions(self => ({
      /**
       * #action
       */
      addBlock(key: string, block: BaseBlock) {
        const blockInstance = BlockState.create({
          key,
          region: block.toRegion(),
        })
        // Set cached display BEFORE adding to map - afterAttach fires when
        // the block is added, so cachedDisplay must be set first
        blockInstance.setCachedDisplay(self)
        self.blockState.set(key, blockInstance)
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
        if (isSelectionContainer(session)) {
          session.setSelection(feature)
        }
        if (isSessionModelWithWidgets(session)) {
          const { rpcManager } = session
          const sessionId = getRpcSessionId(self)
          const track = getContainingTrack(self)
          const view = getContainingView(self)
          const adapterConfig = getConf(track, 'adapter')
          const { type, id } = self.featureWidgetType
          rpcManager
            .call(sessionId, 'CoreGetMetadata', { adapterConfig })
            .then(descriptions => {
              if (isAlive(self)) {
                session.showWidget(
                  session.addWidget(type, id, {
                    featureData: feature.toJSON(),
                    view,
                    track,
                    descriptions,
                  }),
                )
              }
            })
            .catch((e: unknown) => {
              console.error(e)
              getSession(self).notifyError(`${e}`, e)
            })
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
      setSubfeatureIdUnderMouse(subfeatureId?: string) {
        self.subfeatureIdUnderMouse = subfeatureId
      },

      /**
       * #action
       */
      setContextMenuFeature(feature?: Feature) {
        self.contextMenuFeature = feature
      },
      /**
       * #action
       */
      setMouseoverExtraInformation(extra?: string) {
        self.mouseoverExtraInformation = extra
      },
      /**
       * #action
       */
      setShowLegend(s: boolean) {
        self.showLegend = s
      },
      /**
       * #action
       */
      setShowTooltips(arg: boolean) {
        self.showTooltips = arg
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

    .actions(self => ({
      /**
       * #action
       * Select a feature by ID, looking up in features map and subfeatures.
       * Falls back to RPC if not found locally (e.g., for canvas renderer).
       * @param featureId - The ID of the feature to select
       * @param parentFeatureId - The immediate parent's ID for subfeature lookup
       * @param topLevelFeatureId - The top-level feature ID for RPC lookup
       */
      selectFeatureById: flow(function* (
        featureId: string,
        parentFeatureId?: string,
        topLevelFeatureId?: string,
      ) {
        const feature = self.getFeatureById(featureId, parentFeatureId)
        if (feature) {
          self.selectFeature(feature)
          return
        }
        const rpcParentId =
          topLevelFeatureId && topLevelFeatureId !== featureId
            ? topLevelFeatureId
            : parentFeatureId
        try {
          const session = getSession(self)
          const f = yield fetchFeatureByIdRpc({
            rpcManager: session.rpcManager,
            sessionId: getRpcSessionId(self),
            trackId: getContainingTrack(self).id,
            rendererType: self.rendererTypeName,
            featureId,
            parentFeatureId: rpcParentId,
          })
          if (f && isAlive(self)) {
            self.selectFeature(f)
          }
        } catch (e) {
          console.error(e)
          getSession(self).notifyError(`${e}`, e)
        }
      }),
      /**
       * #action
       * Set context menu feature by ID, looking up in features map and subfeatures.
       * Falls back to RPC if not found locally (e.g., for canvas renderer).
       * @param featureId - The ID of the feature to set
       * @param parentFeatureId - The immediate parent's ID for subfeature lookup
       * @param topLevelFeatureId - The top-level feature ID for RPC lookup
       */
      setContextMenuFeatureById: flow(function* (
        featureId: string,
        parentFeatureId?: string,
        topLevelFeatureId?: string,
      ) {
        const feature = self.getFeatureById(featureId, parentFeatureId)
        if (feature) {
          self.setContextMenuFeature(feature)
          return
        }
        const rpcParentId =
          topLevelFeatureId && topLevelFeatureId !== featureId
            ? topLevelFeatureId
            : parentFeatureId
        try {
          const session = getSession(self)
          const f = yield fetchFeatureByIdRpc({
            rpcManager: session.rpcManager,
            sessionId: getRpcSessionId(self),
            trackId: getContainingTrack(self).id,
            rendererType: self.rendererTypeName,
            featureId,
            parentFeatureId: rpcParentId,
          })
          if (f && isAlive(self)) {
            self.setContextMenuFeature(f)
          }
        } catch (e) {
          console.error(e)
          getSession(self).notifyError(`${e}`, e)
        }
      }),
    }))

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
        const transcripts = getTranscripts(feat)

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
                onClick: async () => {
                  const { uniqueId, ...rest } = feat.toJSON()
                  const session = getSession(self)
                  const { default: copy } = await import('copy-to-clipboard')
                  copy(JSON.stringify(rest, null, 4))
                  session.notify('Copied to clipboard', 'success')
                },
              },
              ...(hasIntrons(transcripts)
                ? [
                    {
                      label: 'Collapse introns',
                      icon: CloseFullscreenIcon,
                      onClick: () => {
                        const view = getContainingView(self) as LGV
                        const { assemblyManager } = getSession(self)
                        const assembly = assemblyManager.get(
                          view.assemblyNames[0]!,
                        )
                        if (assembly) {
                          getSession(self).queueDialog(handleClose => [
                            CollapseIntronsDialog,
                            {
                              view,
                              transcripts,
                              handleClose,
                              assembly,
                            },
                          ])
                        }
                      },
                    },
                  ]
                : []),
            ]
          : []
      },
      /**
       * #method
       * props for the renderer's React "Rendering" component - client-side
       * only, never sent to the worker. includes displayModel and callbacks
       */
      renderingProps() {
        return {
          displayModel: self,
          // @deprecated - renderers should call displayModel methods directly
          // e.g. displayModel.setFeatureIdUnderMouse(featureId)
          onMouseMove(_: unknown, featureId?: string) {
            self.setFeatureIdUnderMouse(featureId)
          },
          // @deprecated - renderers should call displayModel methods directly
          // e.g. displayModel.setFeatureIdUnderMouse(undefined)
          onMouseLeave(_: unknown) {
            self.setFeatureIdUnderMouse(undefined)
          },
          // @deprecated - renderers should call displayModel methods directly
          onContextMenu(_: unknown) {
            self.setContextMenuFeature(undefined)
            self.clearFeatureSelection()
          },
        }
      },
      /**
       * #method
       * props sent to the worker for server-side rendering
       */
      renderProps() {
        return {
          ...getParentRenderProps(self),
          notReady: !self.featureDensityStatsReady,
          rpcDriverName: self.effectiveRpcDriverName,
        }
      },
    }))
    .actions(self => ({
      /**
       * #method
       */
      async renderSvg(opts: ExportSvgDisplayOptions) {
        const { renderBaseLinearDisplaySvg } = await import('./renderSvg.tsx')
        return renderBaseLinearDisplaySvg(self as BaseLinearDisplayModel, opts)
      },
      afterAttach() {
        // watch the parent's blocks to update our block state when they
        // change, then we recreate the blocks on our own model (creating and
        // deleting to match the parent blocks)
        addDisposer(
          self,
          autorun(
            function blockDefinitionsAutorun() {
              try {
                if (!isAlive(self) || self.isMinimized) {
                  return
                }
                const view = getContainingView(self) as LGV
                if (!view.initialized) {
                  return
                }
                const contentBlocks = self.blockDefinitions.contentBlocks
                const newKeys = new Set(contentBlocks.map(b => b.key))

                // Add new blocks
                for (const block of contentBlocks) {
                  if (!self.blockState.has(block.key)) {
                    self.addBlock(block.key, block)
                  }
                }

                // Remove old blocks
                for (const key of self.blockState.keys()) {
                  if (!newKeys.has(key)) {
                    self.deleteBlock(key)
                  }
                }
              } catch (e) {
                // catch errors that may occur during test cleanup or when
                // the display is not properly attached to a view
              }
            },
            {
              name: 'BaseLinearDisplayBlockDefinitions',
              delay: 60,
            },
          ),
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
      // xref for Omit https://github.com/mobxjs/mobx-state-tree/issues/1524
      const r = snap as Omit<typeof snap, symbol>
      const { blockState, ...rest } = r
      return rest
    })
}

export const BaseLinearDisplay = stateModelFactory()

export type BaseLinearDisplayStateModel = typeof BaseLinearDisplay
export type BaseLinearDisplayModel = Instance<BaseLinearDisplayStateModel>

export { type LegendItem } from './components/FloatingLegend.tsx'
