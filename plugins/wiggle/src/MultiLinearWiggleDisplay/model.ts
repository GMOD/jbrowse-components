import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  getContainingView,
  getSession,
  openFeatureWidget,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
  fetchEachRegion,
} from '@jbrowse/plugin-linear-genome-view'
import { installPerRegionLifecycle } from '@jbrowse/render-core/installPerRegionLifecycle'
import {
  TreeSidebarMixin,
  buildSpatialIndex,
  clusterLayout,
  treeBranchLengthMenuItem,
} from '@jbrowse/tree-sidebar'
import {
  computeYTicks,
  makeCrossHatchItem,
  makeScoreSubMenu,
  resolveRenderState,
} from '@jbrowse/wiggle-core'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import PaletteIcon from '@mui/icons-material/Palette'

import {
  buildEditableSources,
  buildSources,
  withSourceAlias,
} from './sourcesLogic.ts'
import { WiggleCommonMixin } from '../shared/WiggleCommonMixin.ts'
import { buildSourceRenderData } from '../shared/buildSourceRenderData.ts'
import {
  getRowHeight,
  isOverlayMode,
  makeRenderState,
  wiggleFeatureWidgetData,
} from '../shared/wiggleComponentUtils.ts'
import {
  makePointSizeMenuItems,
  makeRenderingTypeSubMenu,
  makeResolutionSubMenu,
  makeShowSubMenu,
  makeSummaryScoreModeSubMenu,
} from '../shared/wiggleMenuItems.tsx'
import { MULTI_WIGGLE_RENDERINGS } from '../util.ts'

import type {
  Source,
  SourceInfo,
  WiggleDataResult,
  WiggleFeatureUnderMouse,
} from '../util.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import type { WiggleRenderingBackend } from '@jbrowse/wiggle-core'

type LGV = LinearGenomeViewModel

const MultiWiggleComponent = lazy(
  () => import('./components/MultiWiggleComponent.tsx'),
)
const SetColorDialog = lazy(() => import('./components/SetColorDialog.tsx'))
const WiggleClusterDialog = lazy(
  () => import('./components/WiggleClusterDialog/WiggleClusterDialog.tsx'),
)

/**
 * #stateModel MultiLinearWiggleDisplay
 * Wiggle display overlaying/stacking multiple quantitative subtracks in one
 * area, with optional clustering and a tree sidebar.
 *
 * #example
 * `runClustering` is a transient declarative launch spec, the same idea as
 * `LinearGenomeView`'s `init`: set it to run the real "Cluster columns" RPC
 * once automatically (no dialog) as soon as subtrack data is available, and
 * it clears itself afterwards so a saved session never re-triggers it.
 * ```js
 * displays: [
 *   {
 *     type: 'MultiLinearWiggleDisplay',
 *     runClustering: true,
 *   },
 * ]
 * ```
 */
export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'MultiLinearWiggleDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      WiggleCommonMixin(),
      TreeSidebarMixin<Source>(),
      types.model({
        type: types.literal('MultiLinearWiggleDisplay'),
        configuration: ConfigurationReference(configSchema),
        // Transient declarative launch spec, same idea as LinearGenomeView's
        // `init`: session/config sets this to run the real "Cluster columns"
        // RPC once automatically (no dialog), applied by
        // getWiggleClusterAutorun and cleared afterwards so a saved session
        // never re-triggers it.
        runClustering: types.maybe(types.boolean),
      }),
    )
    .volatile(() => ({
      sourcesVolatile: [] as SourceInfo[],
      featureUnderMouse: undefined as WiggleFeatureUnderMouse | undefined,
    }))
    .views(self => ({
      get DisplayMessageComponent() {
        return MultiWiggleComponent
      },

      get isDensityMode() {
        return self.renderingType === 'multirowdensity'
      },

      get isOverlay() {
        return isOverlayMode(self.renderingType)
      },
    }))
    .views(self => ({
      // Raw adapter sources, in adapter order. Used as input to clustering:
      // cluster RPC reads `name` and `buildClusteredLayout` maps order
      // indices into this list.
      get sourcesWithoutLayout(): Source[] {
        return self.sourcesVolatile.map(withSourceAlias)
      },

      get editableSources(): Source[] {
        return buildEditableSources(self.sourcesVolatile, self.layout)
      },
    }))
    .views(self => ({
      get sources(): Source[] {
        return buildSources(
          self.editableSources,
          self.subtreeFilter,
          self.isOverlay,
        )
      },
    }))
    .views(self => ({
      get numSources() {
        return self.sources.length
      },

      // Restrict the shared autoscale domain to the currently-visible sources
      // (a subtree filter hides some), so hidden sources don't stretch the axis.
      get autoscaleSourceNames() {
        return new Set(self.sources.map(s => s.name))
      },
    }))
    .views(self => ({
      get rowHeight() {
        return self.isOverlay
          ? self.height
          : getRowHeight(self.height, self.numSources)
      },
    }))
    .views(self => ({
      get rowHeightTooSmallForScalebar() {
        return self.rowHeight < 70
      },

      get ticks() {
        return computeYTicks({
          height: self.rowHeight,
          domain: self.domain,
          scaleType: self.scaleType,
          minimalTicks: getConf(self, 'minimalTicks'),
          offset: 0,
        })
      },

      get renderState() {
        const view = getContainingView(self) as LGV
        const width = view.trackWidthPx
        // Full height, no YSCALEBAR_LABEL_OFFSET inset (unlike single-wiggle):
        // rows stack edge-to-edge for maximum density. Don't "unify" with
        // LinearWiggleDisplay's inset — the divergence is intentional.
        const height = self.height
        // Always defined: until autoscale resolves a domain, resolveRenderState
        // returns a [0,1] stub so an uncovered region still renders (clears the
        // canvas, flips canvasDrawn, resolves the overlay to the NoDataMessage
        // instead of spinning forever). "Still loading" is expressed separately
        // by the render callback's `rpcDataMap.size === 0` first-paint gate.
        return resolveRenderState(self.domain, domain =>
          makeRenderState(
            domain,
            self.scaleType,
            self.renderingType,
            width,
            height,
            self.isOverlay ? 1 : self.numSources,
            self.scatterPointSize,
          ),
        )
      },

      // bicolorPivot is unconditional here: Multi has no global `color`
      // setting, only posColor/negColor.
      rpcProps() {
        return {
          bicolorPivot: self.bicolorPivot,
          resolution: self.resolution,
        }
      },

      gpuProps() {
        return {
          sources: self.sources,
          posColor: self.posColor,
          negColor: self.negColor,
          summaryScoreMode: self.summaryScoreMode,
          renderingType: self.renderingType,
          isDensityMode: self.isDensityMode,
        }
      },
    }))
    .views(self => ({
      get showTree() {
        return getConf(self, 'showTree')
      },

      get showBranchLength() {
        return getConf(self, 'showBranchLength')
      },

      get showRowSeparators() {
        return getConf(self, 'showRowSeparators')
      },

      /**
       * #getter
       * Offset the track label above the visualization so the stacked
       * per-source rows aren't hidden behind an overlapping label.
       */
      get prefersOffset() {
        return true
      },
    }))
    .views(self => ({
      get hierarchy() {
        const r = self.root
        if (!r || !self.sources.length) {
          return undefined
        }
        return clusterLayout(
          r,
          self.height,
          self.treeAreaWidth,
          self.showBranchLength,
        )
      },
    }))
    .views(self => ({
      get spatialIndex() {
        return self.hierarchy ? buildSpatialIndex(self.hierarchy) : undefined
      },
    }))
    .actions(self => {
      const { clearDisplaySpecificData: superClearDisplaySpecificData } = self
      return {
        // sourcesVolatile is piggy-backed on each region's data — wipe it
        // whenever we wipe the data, so the next fetch's first region
        // repopulates with current adapter metadata (handles adapter
        // reconfigure / chromosome navigation).
        clearDisplaySpecificData() {
          superClearDisplaySpecificData()
          self.sourcesVolatile = []
        },
        setRpcData(displayedRegionIndex: number, data: WiggleDataResult) {
          self.rpcDataMap.set(displayedRegionIndex, data)
          if (self.sourcesVolatile.length === 0 && data.sources.length > 0) {
            self.sourcesVolatile = data.sources.map(
              ({ name, color, labelColor, label, group, baseUri }) => ({
                name,
                color,
                labelColor,
                label,
                group,
                baseUri,
              }),
            )
          }
        },

        startRenderingBackend(backend: WiggleRenderingBackend) {
          installPerRegionLifecycle(
            self,
            self.rpcDataMap,
            backend,
            data => buildSourceRenderData(data, self.gpuProps()),
            (b, encoded) => {
              // size === 0 gates first paint until data lands (keep the loading
              // overlay up); once loaded, renderState is always a real-or-stub
              // state, so an uncovered region paints a cleared canvas.
              if (self.rpcDataMap.size === 0) {
                return false
              }
              b.renderBlocks(self.renderBlocks, encoded, self.renderState)
              return true
            },
          )
        },

        setShowTree(arg: boolean) {
          self.configuration.setSlot('showTree', arg)
        },

        setShowBranchLength(arg: boolean) {
          self.configuration.setSlot('showBranchLength', arg)
        },

        setShowRowSeparators(arg: boolean) {
          self.configuration.setSlot('showRowSeparators', arg)
        },

        setFeatureUnderMouse(feat?: typeof self.featureUnderMouse) {
          self.featureUnderMouse = feat
        },

        selectFeature(feat: NonNullable<typeof self.featureUnderMouse>) {
          openFeatureWidget(self, wiggleFeatureWidgetData(feat))
        },

        setRunClustering(arg?: boolean) {
          self.runClustering = arg
        },
      }
    })
    .actions(self => {
      const superAfterAttach = self.afterAttach

      return {
        fetchNeeded(
          needed: { region: Region; displayedRegionIndex: number }[],
        ) {
          const view = getContainingView(self) as LGV
          // Always fetch the full (unfiltered, un-reordered) source list. A
          // subtree filter or reorder only affects client-side rendering
          // (gpuProps re-upload) and the autoscale domain — never what's
          // fetched — so every region's payload stays complete and consistent.
          // Filtering here instead would leave regions fetched under a stale
          // filter missing sources when the filter is later widened.
          const { adapterConfig, sourcesWithoutLayout } = self
          if (adapterConfig) {
            const { bpPerPx } = view
            const sessionId = getRpcSessionId(self)
            const { rpcManager } = getSession(self)
            return fetchEachRegion(self, needed, {
              call: (region, ctx, displayedRegionIndex) =>
                rpcManager.call(sessionId, 'RenderMultiWiggleData', {
                  adapterConfig,
                  region,
                  sources: sourcesWithoutLayout,
                  ...self.rpcProps(),
                  stopToken: ctx.stopToken,
                  bpPerPx,
                  statusCallback:
                    self.makeRegionStatusCallback(displayedRegionIndex),
                }),
              onResult: (idx, result) => {
                self.setRpcData(idx, result)
              },
              onComplete: () => {
                self.setLoadedBpPerPx(bpPerPx)
              },
            })
          }
          return undefined
        },

        async afterAttach() {
          superAfterAttach()

          try {
            const { setupTreeDrawingAutorun } =
              await import('@jbrowse/tree-sidebar')
            if (isAlive(self)) {
              setupTreeDrawingAutorun(self)
            }
          } catch (e) {
            console.error(e)
          }

          try {
            const { getWiggleClusterAutorun } =
              await import('./getWiggleClusterAutorun.ts')
            if (isAlive(self)) {
              getWiggleClusterAutorun(self)
            }
          } catch (e) {
            console.error(e)
          }
        },
      }
    })
    .views(self => ({
      trackMenuItems() {
        const showItems: MenuItem[] = [
          // row separators only render in multi-row modes, not overlays
          ...(self.isOverlay
            ? []
            : [
                {
                  label: 'Show row separators',
                  type: 'checkbox' as const,
                  checked: self.showRowSeparators,
                  onClick: () => {
                    self.setShowRowSeparators(!self.showRowSeparators)
                  },
                },
              ]),
          // density maps score to color, so score-axis cross hatches are
          // meaningless there
          ...(self.isDensityMode ? [] : [makeCrossHatchItem(self)]),
        ]
        return [
          makeRenderingTypeSubMenu(self, MULTI_WIGGLE_RENDERINGS),
          ...makePointSizeMenuItems(self),
          {
            label: 'Clustering',
            icon: AccountTreeIcon,
            subMenu: [
              {
                label: 'Cluster rows by score...',
                disabled: !self.renderingType.startsWith('multirow'),
                disabledHelpText:
                  'Only available for multi-row rendering types',
                onClick: () => {
                  getSession(self).queueDialog(handleClose => [
                    WiggleClusterDialog,
                    {
                      model: self,
                      handleClose,
                    },
                  ])
                },
              },
              {
                label: 'Show tree',
                type: 'checkbox',
                checked: self.showTree,
                disabled: !self.clusterTree,
                disabledHelpText: 'Run clustering first',
                onClick: () => {
                  self.setShowTree(!self.showTree)
                },
              },
              // Only meaningful with a visible tree that carries merge heights;
              // hidden otherwise rather than shown disabled.
              ...(self.showTree && self.treeHasBranchLengths
                ? [treeBranchLengthMenuItem(self)]
                : []),
              ...(self.subtreeFilter?.length
                ? [
                    {
                      label: 'Clear subtree filter',
                      onClick: () => {
                        self.setSubtreeFilter(undefined)
                      },
                    },
                  ]
                : []),
            ],
          },
          ...makeResolutionSubMenu(self),
          makeScoreSubMenu(self, {
            scaleType: true,
            leadingItems: makeSummaryScoreModeSubMenu(self),
          }),
          ...makeShowSubMenu(showItems),
          {
            label: 'Edit colors/arrangement...',
            icon: PaletteIcon,
            disabled: !self.sourcesVolatile.length,
            disabledHelpText: 'Loading sources...',
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                SetColorDialog,
                {
                  model: self,
                  handleClose,
                },
              ])
            },
          },
        ]
      },
    }))
    .actions(self => ({
      async renderSvg(opts?: ExportSvgDisplayOptions) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self as MultiLinearWiggleDisplayModel, opts)
      },
    }))
}

export type MultiLinearWiggleDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type MultiLinearWiggleDisplayModel =
  Instance<MultiLinearWiggleDisplayStateModel>
