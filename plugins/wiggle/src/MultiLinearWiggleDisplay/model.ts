import { lazy } from 'react'

import { ConfigurationReference } from '@jbrowse/core/configuration'
import { installPerRegionLifecycle } from '@jbrowse/core/gpu/installPerRegionLifecycle'
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
} from '@jbrowse/plugin-linear-genome-view'
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
import PaletteIcon from '@mui/icons-material/Palette'
import VisibilityIcon from '@mui/icons-material/Visibility'

import { buildEditableSources, buildSources } from './sourcesLogic.ts'
import { WiggleCommonMixin } from '../shared/WiggleCommonMixin.ts'
import { buildSourceRenderData } from '../shared/buildSourceRenderData.ts'
import { makeWigglePreProcessSnapshot } from '../shared/makeWigglePreProcessSnapshot.ts'
import {
  getRowHeight,
  isOverlayMode,
  makeRenderState,
  wiggleFeatureWidgetData,
} from '../shared/wiggleComponentUtils.ts'
import {
  makeRenderingTypeSubMenu,
  makeResolutionAndSummarySubMenus,
} from '../shared/wiggleMenuItems.ts'
import { MULTI_WIGGLE_RENDERINGS } from '../util.ts'

import type {
  Source,
  SourceInfo,
  WiggleDataResult,
  WiggleFeatureUnderMouse,
} from '../util.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  FetchContext,
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

export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'MultiLinearWiggleDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      WiggleCommonMixin([
        'minimalTicks',
        'showTree',
        'showBranchLength',
        'showRowSeparators',
      ]),
      TreeSidebarMixin<Source>(),
      types.model({
        type: types.literal('MultiLinearWiggleDisplay'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .preProcessSnapshot(makeWigglePreProcessSnapshot({ multiWiggle: true }))
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
        return self.sourcesVolatile.map(s => ({ ...s, source: s.name }))
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
          minimalTicks: self.getOverride<boolean>('minimalTicks') ?? false,
          offset: 0,
        })
      },

      get renderState() {
        if (self.sources.length === 0) {
          return undefined
        }
        const view = getContainingView(self) as LGV
        const width = view.trackWidthPx
        const height = self.height
        return resolveRenderState(
          self.domain,
          self.rpcDataMap.size > 0,
          domain =>
            makeRenderState(
              domain,
              self.scaleType,
              self.renderingType,
              width,
              height,
              self.isOverlay ? 1 : self.numSources,
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
        return self.getOverride<boolean>('showTree') ?? true
      },

      get showBranchLength() {
        return self.getOverride<boolean>('showBranchLength') ?? false
      },

      get showRowSeparators() {
        return self.getOverride<boolean>('showRowSeparators') ?? false
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
              const state = self.renderState
              if (!state) {
                return false
              }
              b.renderBlocks(self.renderBlocks, encoded, state)
              return true
            },
          )
        },

        setShowTree(arg: boolean) {
          self.setOverride('showTree', arg)
        },

        setShowBranchLength(arg: boolean) {
          self.setOverride('showBranchLength', arg)
        },

        setShowRowSeparators(arg: boolean) {
          self.setOverride('showRowSeparators', arg)
        },

        setFeatureUnderMouse(feat?: typeof self.featureUnderMouse) {
          self.featureUnderMouse = feat
        },

        selectFeature(feat: NonNullable<typeof self.featureUnderMouse>) {
          openFeatureWidget(self, wiggleFeatureWidgetData(feat))
        },
      }
    })
    .actions(self => {
      const superAfterAttach = self.afterAttach

      return {
        async fetchNeeded(
          needed: { region: Region; displayedRegionIndex: number }[],
        ) {
          const view = getContainingView(self) as LGV
          const { adapterConfig, sources } = self
          if (!adapterConfig) {
            return
          }
          const { bpPerPx } = view
          const sessionId = getRpcSessionId(self)
          const { rpcManager } = getSession(self)
          await self.fetchRegions(needed, async (ctx: FetchContext) => {
            await Promise.all(
              needed.map(async r => {
                const result = await rpcManager.call(
                  sessionId,
                  'RenderMultiWiggleData',
                  {
                    sessionId,
                    adapterConfig,
                    region: r.region,
                    sources,
                    ...self.rpcProps(),
                    stopToken: ctx.stopToken,
                    bpPerPx,
                    statusCallback: (msg: string) => {
                      if (isAlive(self)) {
                        self.setStatusMessage(msg)
                      }
                    },
                  },
                )
                if (!ctx.isStale()) {
                  self.setRpcData(r.displayedRegionIndex, result)
                }
              }),
            )
            if (!ctx.isStale()) {
              self.setLoadedBpPerPx(bpPerPx)
            }
          })
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
        },
      }
    })
    .views(self => ({
      trackMenuItems() {
        return [
          {
            label: 'Show...',
            icon: VisibilityIcon,
            subMenu: [
              {
                label: `Show tree${!self.clusterTree ? ' (run clustering first)' : ''}`,
                type: 'checkbox',
                checked: self.showTree,
                disabled: !self.clusterTree,
                onClick: () => {
                  self.setShowTree(!self.showTree)
                },
              },
              treeBranchLengthMenuItem(self),
              {
                label: 'Show row separators',
                type: 'checkbox',
                checked: self.showRowSeparators,
                onClick: () => {
                  self.setShowRowSeparators(!self.showRowSeparators)
                },
              },
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
          makeScoreSubMenu(self, {
            scaleType: true,
            leadingItems: makeResolutionAndSummarySubMenus(self),
          }),
          makeRenderingTypeSubMenu(self, MULTI_WIGGLE_RENDERINGS),
          {
            label: 'Cluster rows by score',
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
            label: self.sourcesVolatile.length
              ? 'Edit colors/arrangement...'
              : 'Edit colors/arrangement... (loading...)',
            icon: PaletteIcon,
            disabled: !self.sourcesVolatile.length,
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
          makeCrossHatchItem(self),
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
