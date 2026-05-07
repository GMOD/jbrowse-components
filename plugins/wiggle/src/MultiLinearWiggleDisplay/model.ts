import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { set1 as overlayColors } from '@jbrowse/core/ui/colors'
import {
  SimpleFeature,
  getContainingTrack,
  getContainingView,
  getEnv,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import { TreeSidebarMixin, clusterLayout } from '@jbrowse/tree-sidebar'
import EqualizerIcon from '@mui/icons-material/Equalizer'
import PaletteIcon from '@mui/icons-material/Palette'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { observable } from 'mobx'

import { WiggleCommonMixin } from '../shared/WiggleCommonMixin.ts'
import { installPerRegionWiggleLifecycle } from '../shared/installPerRegionWiggleLifecycle.ts'
import { makeWigglePreProcessSnapshot } from '../shared/makeWigglePreProcessSnapshot.ts'
import {
  getRowHeight,
  isOverlayMode,
  makeRenderState,
} from '../shared/wiggleComponentUtils.ts'
import {
  makeAutoscaleTypeSubMenu,
  makeResolutionAndSummarySubMenus,
  makeScaleTypeSubMenu,
} from '../shared/wiggleMenuItems.ts'
import { computeAutoscaleDomain, getNiceDomain, getScale } from '../util.ts'
import { buildMultiSourceRenderData } from './components/buildMultiSourceRenderData.ts'

import type { MultiWiggleDataResult } from '../RenderMultiWiggleDataRPC/types.ts'
import type { WiggleBackend } from '../shared/wiggleBackendTypes.ts'
import type { Source, SourceInfo } from '../util.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  FetchContext,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const MultiWiggleComponent = lazy(
  () => import('./components/MultiWiggleComponent.tsx'),
)
const SetMinMaxDialog = lazy(() => import('../shared/SetMinMaxDialog.tsx'))
const SetColorDialog = lazy(() => import('./components/SetColorDialog.tsx'))
const WiggleClusterDialog = lazy(
  () => import('./components/WiggleClusterDialog/WiggleClusterDialog.tsx'),
)

function resolveOverlayColor(
  index: number,
  isOverlay: boolean,
  adapterColor?: string,
  layoutColor?: string,
) {
  if (isOverlay) {
    return (
      layoutColor ?? adapterColor ?? overlayColors[index % overlayColors.length]
    )
  }
  return layoutColor ?? adapterColor
}

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
      }),
    )
    .preProcessSnapshot(
      // @ts-expect-error - MST's preProcessSnapshot typing can't verify the
      // return type against the model creation type
      makeWigglePreProcessSnapshot({ multiWiggle: true }),
    )
    .volatile(() => ({
      rpcDataMap: observable.map<number, MultiWiggleDataResult>(),
      sourcesVolatile: [] as SourceInfo[],
      featureUnderMouse: undefined as
        | {
            refName: string
            start: number
            end: number
            score: number
            minScore?: number
            maxScore?: number
            source: string
            summary?: boolean
            allSources?: {
              source: string
              score: number
              minScore?: number
              maxScore?: number
              summary?: boolean
            }[]
          }
        | undefined,
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
      get sourcesWithoutLayout() {
        return self.sourcesVolatile.map((s, i) => ({
          source: s.name,
          ...s,
          color: resolveOverlayColor(i, self.isOverlay, s.color),
        }))
      },

      get sources(): Source[] {
        const sourceMap = new Map(self.sourcesVolatile.map(s => [s.name, s]))
        const layoutColors = new Map(
          (self.layout as Source[])
            .filter(s => s.color)
            .map(s => [s.name, s.color]),
        )
        let iter = self.layout.length ? self.layout : self.sourcesVolatile

        if (self.subtreeFilter?.length) {
          const filterSet = new Set(self.subtreeFilter)
          iter = iter.filter(s => filterSet.has(s.name))
        }

        return iter.map((s, i) => ({
          source: s.name,
          ...sourceMap.get(s.name),
          ...s,
          color: resolveOverlayColor(
            i,
            self.isOverlay,
            sourceMap.get(s.name)?.color,
            layoutColors.get(s.name),
          ),
        }))
      },

      get hasResolution() {
        const adapterConfig = self.adapterConfig as { type: string }
        const { pluginManager } = getEnv(self)
        return (
          pluginManager
            .getAdapterType(adapterConfig.type)
            ?.adapterCapabilities.includes('hasResolution') ?? false
        )
      },

      get visibleScoreRange() {
        const view = getContainingView(self) as LGV
        if (!view.initialized || self.rpcDataMap.size === 0) {
          return undefined
        }
        const numStdDev = self.getConfWithOverride<number>('numStdDev')
        // Use coarseDynamicBlocks (500ms debounced) instead of visibleRegions
        // so autoscale doesn't recompute on every animation frame during zoom.
        const visibleEntries = view.coarseDynamicBlocks.flatMap(block => {
          const regionData = self.rpcDataMap.get(block.displayedRegionIndex!)
          if (!regionData) {
            return []
          }
          const visStart = Math.floor(block.start)
          const visEnd = Math.ceil(block.end)
          return regionData.sources.map(source => ({
            visStart,
            visEnd,
            data: source,
          }))
        })
        const allEntries = [...self.rpcDataMap.values()].flatMap(regionData =>
          regionData.sources.map(source => ({ data: source })),
        )
        return computeAutoscaleDomain(
          self.autoscaleType,
          self.summaryScoreMode,
          numStdDev,
          visibleEntries,
          allEntries,
        )
      },
    }))
    .views(self => ({
      get domain() {
        const range = self.visibleScoreRange
        if (!range) {
          return undefined
        }
        return getNiceDomain({
          domain: range,
          bounds: [self.minScoreConfig, self.maxScoreConfig],
          scaleType: self.scaleType,
        })
      },

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
        const domain = self.domain
        const rowHeight = self.rowHeight
        if (!domain) {
          return undefined
        }
        const scale = getScale({
          scaleType: self.scaleType,
          domain,
          range: [rowHeight, 0],
          inverted: false,
        })
        const minimalTicks = self.getConfWithOverride<boolean>('minimalTicks')
        const values =
          rowHeight < 100 || minimalTicks
            ? (domain as number[])
            : scale.ticks(4)
        return {
          ticks: values.map(v => ({ value: v, y: scale(v) })),
          yTop: 0,
          yBottom: rowHeight,
        }
      },

      get renderState() {
        const domain = self.domain
        if (!domain || self.sources.length === 0) {
          return undefined
        }
        const view = getContainingView(self) as LGV
        return makeRenderState(
          domain,
          self.scaleType,
          self.renderingType,
          view.trackWidthPx,
          self.height,
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
        return clusterLayout(r, self.height, self.treeAreaWidth)
      },
    }))
    .actions(self => ({
      setRpcData(displayedRegionIndex: number, data: MultiWiggleDataResult) {
        self.rpcDataMap.set(displayedRegionIndex, data)
        if (self.sourcesVolatile.length === 0 && data.sources.length > 0) {
          self.sourcesVolatile = data.sources.map(s => ({
            name: s.name,
            color: s.color,
          }))
        }
      },

      clearDisplaySpecificData() {
        self.rpcDataMap.clear()
        self.setLoadedBpPerPx(undefined)
      },

      startGpuBackendLifecycle(backend: WiggleBackend) {
        installPerRegionWiggleLifecycle(self, self.rpcDataMap, backend, data =>
          buildMultiSourceRenderData(data, self.gpuProps()),
        )
      },

      reload() {
        self.clearAllRpcData()
      },

      setSources(sources: SourceInfo[]) {
        self.sourcesVolatile = sources
      },

      setShowTree(arg: boolean) {
        self.setOverride('showTree', arg)
      },

      setShowRowSeparators(arg: boolean) {
        self.setOverride('showRowSeparators', arg)
      },

      setFeatureUnderMouse(feat?: typeof self.featureUnderMouse) {
        self.featureUnderMouse = feat
      },

      selectFeature(feat: NonNullable<typeof self.featureUnderMouse>) {
        const session = getSession(self)
        if (!isSessionModelWithWidgets(session)) {
          return
        }
        const track = getContainingTrack(self)
        const view = getContainingView(self)
        const sources = feat.allSources
          ? Object.fromEntries(feat.allSources.map(s => [s.source, s.score]))
          : { [feat.source]: feat.score }
        const feature = new SimpleFeature({
          uniqueId: `wiggle-${feat.refName}-${feat.start}-${feat.end}`,
          refName: feat.refName,
          start: feat.start,
          end: feat.end,
          sources,
        })
        session.showWidget(
          session.addWidget('BaseFeatureWidget', 'baseFeature', {
            featureData: feature.toJSON(),
            view,
            track,
          }),
        )
      },
    }))
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
          {
            label: 'Score',
            icon: EqualizerIcon,
            subMenu: [
              ...makeResolutionAndSummarySubMenus(self),
              makeScaleTypeSubMenu(self),
              makeAutoscaleTypeSubMenu(self),
              {
                label: 'Set min/max score',
                onClick: () => {
                  getSession(self).queueDialog(handleClose => [
                    SetMinMaxDialog,
                    {
                      model: self,
                      handleClose,
                    },
                  ])
                },
              },
            ],
          },
          {
            label: 'Rendering type',
            subMenu: (
              [
                ['multirowxy', 'Multi-row XY plot'],
                ['multirowdensity', 'Multi-row density'],
                ['multirowline', 'Multi-row line'],
                ['multirowscatter', 'Multi-row scatter'],
                ['multixyplot', 'Overlapping XY plot'],
                ['multiline', 'Overlapping lines'],
                ['multiscatter', 'Overlapping scatter'],
              ] as const
            ).map(([value, label]) => ({
              label,
              type: 'radio' as const,
              checked: self.renderingType === value,
              onClick: () => {
                self.setRenderingType(value)
              },
            })),
          },
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
            label: 'Edit colors/arrangement...',
            icon: PaletteIcon,
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
          {
            label: 'Draw cross hatches',
            type: 'checkbox',
            checked: self.displayCrossHatches,
            onClick: () => {
              self.toggleCrossHatches()
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
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const { layout, clusterTree, treeAreaWidth, subtreeFilter, ...rest } =
        snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(layout.length > 0 ? { layout } : {}),
        ...(clusterTree !== undefined ? { clusterTree } : {}),
        ...(treeAreaWidth !== 80 ? { treeAreaWidth } : {}),
        ...(subtreeFilter?.length ? { subtreeFilter } : {}),
      } as typeof snap
    })
}

export type MultiLinearWiggleDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type MultiLinearWiggleDisplayModel =
  Instance<MultiLinearWiggleDisplayStateModel>
