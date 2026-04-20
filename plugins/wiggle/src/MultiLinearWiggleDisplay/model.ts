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
  measureText,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  ConfigOverrideMixin,
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import { TreeSidebarMixin, computeHierarchyLayout } from '@jbrowse/tree-sidebar'
import EqualizerIcon from '@mui/icons-material/Equalizer'
import PaletteIcon from '@mui/icons-material/Palette'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { observable } from 'mobx'

import axisPropsFromTickScale from '../shared/axisPropsFromTickScale.ts'
import { migrateWiggleSnapshot } from '../shared/migrateWiggleSnapshot.ts'
import {
  getRowHeight,
  isOverlayMode,
  makeRenderState,
} from '../shared/wiggleComponentUtils.ts'
import { computeAutoscaleDomain, getNiceDomain, getScale } from '../util.ts'
import { buildMultiSourceRenderData } from './components/buildMultiSourceRenderData.ts'

import type { MultiWiggleDataResult } from '../RenderMultiWiggleDataRPC/types.ts'
import type {
  WiggleBackend,
  WiggleGPURenderState,
} from '../shared/wiggleBackendTypes.ts'
import type { Source, SourceInfo } from '../util.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { Region } from '@jbrowse/core/util'
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
      ConfigOverrideMixin(),
      TreeSidebarMixin<Source>(),
      types.model({
        type: types.literal('MultiLinearWiggleDisplay'),
        configuration: ConfigurationReference(configSchema),
        resolution: types.optional(types.number, 1),
        displayCrossHatches: types.optional(types.boolean, false),
      }),
    )
    .preProcessSnapshot(
      // @ts-expect-error - MST's preProcessSnapshot typing can't verify the
      // return type against the model creation type
      (snap: Record<string, unknown> | null | undefined) => {
        if (!snap) {
          return snap
        }

        // Strip properties from old BaseLinearDisplay snapshots
        const { blockState, showLegend, showTooltips, ...withoutLegacy } = snap

        // Rewrite "height" from older snapshots to "heightPreConfig"
        if (
          withoutLegacy.height !== undefined &&
          withoutLegacy.heightPreConfig === undefined
        ) {
          const { height, ...rest } = withoutLegacy
          return migrateWiggleSnapshot(
            { ...rest, heightPreConfig: height },
            { multiWiggle: true },
          )
        }

        return migrateWiggleSnapshot(withoutLegacy, { multiWiggle: true })
      },
    )
    .volatile(() => ({
      rpcDataMap: observable.map<number, MultiWiggleDataResult>(),
      sourcesVolatile: [] as SourceInfo[],
      // See LinearWiggleDisplay.loadedBpPerPx and adr-008.
      loadedBpPerPx: undefined as number | undefined,
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
      get scalebarOverlapLeft() {
        const view = getContainingView(self) as { trackLabelsSetting?: string }
        if (view.trackLabelsSetting === 'overlapping') {
          const track = getContainingTrack(self)
          return measureText(getConf(track, 'name'), 12.8) + 100
        }
        return 0
      },

      get DisplayMessageComponent() {
        return MultiWiggleComponent
      },

      get sourcesWithoutLayout() {
        return self.sourcesVolatile.map((s, i) => ({
          source: s.name,
          ...s,
          color: resolveOverlayColor(i, this.isOverlay, s.color),
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
            this.isOverlay,
            sourceMap.get(s.name)?.color,
            layoutColors.get(s.name),
          ),
        }))
      },

      get adapterConfig() {
        const track = getContainingTrack(self)
        return getConf(track, 'adapter')
      },

      get hasResolution() {
        const adapterConfig = this.adapterConfig as { type: string }
        const { pluginManager } = getEnv(self)
        return (
          pluginManager
            .getAdapterType(adapterConfig.type)
            ?.adapterCapabilities.includes('hasResolution') ?? false
        )
      },

      get posColor() {
        return self.getConfWithOverride<string>('posColor')
      },

      get negColor() {
        return self.getConfWithOverride<string>('negColor')
      },

      get bicolorPivot() {
        return self.getConfWithOverride<number>('bicolorPivot')
      },

      get scaleType() {
        return self.getConfWithOverride<string>('scaleType')
      },

      get autoscaleType() {
        return self.getConfWithOverride<string>('autoscale')
      },

      get summaryScoreMode() {
        return self.getConfWithOverride<string>('summaryScoreMode')
      },

      get renderingType() {
        return self.getConfWithOverride<string>('defaultRendering')
      },

      get isDensityMode() {
        return this.renderingType === 'multirowdensity'
      },

      get isOverlay() {
        return isOverlayMode(this.renderingType)
      },

      get minScore() {
        return self.getConfWithOverride<number>('minScore')
      },

      get maxScore() {
        return self.getConfWithOverride<number>('maxScore')
      },

      get minScoreConfig() {
        const val = this.minScore
        return val === Number.MIN_VALUE ? undefined : val
      },

      get maxScoreConfig() {
        const val = this.maxScore
        return val === Number.MAX_VALUE ? undefined : val
      },

      get visibleScoreRange(): [number, number] | undefined {
        const view = getContainingView(self) as LGV
        if (!view.initialized || self.rpcDataMap.size === 0) {
          return undefined
        }
        const numStdDev = self.getConfWithOverride<number>('numStdDev')
        const visibleEntries = view.visibleRegions.flatMap(vr => {
          const regionData = self.rpcDataMap.get(vr.displayedRegionIndex)
          if (!regionData) {
            return []
          }
          const visStart = Math.floor(vr.start) - regionData.regionStart
          const visEnd = Math.ceil(vr.end) - regionData.regionStart
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
          this.autoscaleType,
          this.summaryScoreMode,
          numStdDev,
          visibleEntries,
          allEntries,
        )
      },

      get domain(): [number, number] | undefined {
        const range = this.visibleScoreRange
        if (!range) {
          return undefined
        }
        return getNiceDomain({
          domain: range,
          bounds: [this.minScoreConfig, this.maxScoreConfig],
          scaleType: this.scaleType,
        })
      },

      get numSources() {
        return this.sources.length
      },

      get rowHeight() {
        return this.isOverlay
          ? self.height
          : getRowHeight(self.height, this.numSources)
      },

      get rowHeightTooSmallForScalebar() {
        return this.rowHeight < 70
      },

      get ticks() {
        const scaleType = this.scaleType
        const domain = this.domain
        const rowHeight = this.rowHeight
        if (!domain) {
          return undefined
        }
        const minimalTicks = self.getConfWithOverride<boolean>('minimalTicks')
        const ticks = axisPropsFromTickScale(
          getScale({
            scaleType,
            domain,
            range: [rowHeight, 0],
            inverted: false,
          }),
          4,
        )
        return rowHeight < 100 || minimalTicks
          ? { ...ticks, values: domain }
          : ticks
      },

      get renderState() {
        const domain = this.domain
        if (!domain || this.sources.length === 0) {
          return undefined
        }
        const view = getContainingView(self) as LGV
        return makeRenderState(
          domain,
          this.scaleType,
          this.renderingType,
          view.trackWidthPx,
          self.height,
        )
      },

      // Settings sent to the worker via RPC.
      get rpcProps() {
        return {
          bicolorPivot: this.bicolorPivot,
          resolution: self.resolution,
        }
      },

      // Settings consumed during main-thread GPU buffer encoding
      // (buildMultiSourceRenderData), not sent to the worker. Includes
      // `sources` because re-ordering / re-coloring sources changes the
      // per-instance buffer (rowIndex, color) without changing what the
      // worker returns. Defined as a method (not a getter) so subclasses
      // can override it via the standard `super` capture pattern. The
      // return shape is enforced structurally by
      // buildMultiSourceRenderData's `MultiWiggleGpuProps` parameter type.
      gpuProps() {
        return {
          sources: this.sources,
          posColor: this.posColor,
          negColor: this.negColor,
          summaryScoreMode: this.summaryScoreMode,
          renderingType: this.renderingType,
          isDensityMode: this.isDensityMode,
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
        return computeHierarchyLayout(r, self.height, self.treeAreaWidth)
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

      setLoadedBpPerPx(bpPerPx: number | undefined) {
        self.loadedBpPerPx = bpPerPx
      },

      clearDisplaySpecificData() {
        self.rpcDataMap.clear()
        self.loadedBpPerPx = undefined
      },

      startGpuBackendLifecycle(backend: WiggleBackend) {
        self.startMultiRegionGpuLifecycle<WiggleBackend, WiggleGPURenderState>({
          backend,
          uploads: [
            {
              getData: () => self.rpcDataMap,
              upload: (b, displayedRegionIndex, data) => {
                b.uploadRegion(
                  displayedRegionIndex,
                  data.regionStart,
                  buildMultiSourceRenderData(data, self.gpuProps()),
                )
              },
              prune: (b, activeDisplayedRegionIndices) => {
                b.pruneRegions(activeDisplayedRegionIndices)
              },
            },
          ],
          renderBlocks: () => self.renderBlocks,
          renderState: () => self.renderState,
          render: (b, blocks, state) => {
            b.renderBlocks(blocks, state)
          },
        })
      },

      reload() {
        self.setError(null)
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
        const prev = self.featureUnderMouse
        if (!feat && !prev) {
          return
        }
        if (
          feat &&
          feat.start === prev?.start &&
          feat.end === prev.end &&
          feat.source === prev.source &&
          feat.score === prev.score
        ) {
          return
        }
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

      setAutoscale(val?: string) {
        self.setOverride('autoscale', val)
      },

      toggleCrossHatches() {
        self.displayCrossHatches = !self.displayCrossHatches
      },

      setScaleType(scaleType: string) {
        self.setOverride('scaleType', scaleType)
      },

      setMinScore(val?: number) {
        self.setOverride('minScore', val)
      },

      setMaxScore(val?: number) {
        self.setOverride('maxScore', val)
      },

      setRenderingType(type: string) {
        self.setOverride('defaultRendering', type)
      },

      setSummaryScoreMode(val: string) {
        self.setOverride('summaryScoreMode', val)
      },

      setResolution(res: number) {
        self.resolution = res
      },
    }))
    .actions(self => {
      const superAfterAttach = self.afterAttach

      return {
        // Strict equality; see adr-008.
        isCacheValid(_displayedRegionIndex: number) {
          if (self.loadedBpPerPx === undefined) {
            return true
          }
          const view = getContainingView(self) as LGV
          return view.bpPerPx === self.loadedBpPerPx
        },

        onFetchNeeded(
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
          self.fetchRegions(needed, async (ctx: FetchContext) => {
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
                    ...self.rpcProps,
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
              ...(self.hasResolution
                ? [
                    {
                      label: 'Resolution',
                      subMenu: [
                        {
                          label: 'Finer resolution',
                          onClick: () => {
                            self.setResolution(self.resolution * 5)
                          },
                        },
                        {
                          label: 'Coarser resolution',
                          onClick: () => {
                            self.setResolution(self.resolution / 5)
                          },
                        },
                      ],
                    },
                    {
                      label: 'Summary score mode',
                      subMenu: (['min', 'max', 'avg', 'whiskers'] as const).map(
                        elt => ({
                          label: elt,
                          type: 'radio' as const,
                          checked: self.summaryScoreMode === elt,
                          onClick: () => {
                            self.setSummaryScoreMode(elt)
                          },
                        }),
                      ),
                    },
                  ]
                : []),
              {
                label: 'Scale type',
                subMenu: [
                  {
                    label: 'Linear scale',
                    type: 'radio',
                    checked: self.scaleType === 'linear',
                    onClick: () => {
                      self.setScaleType('linear')
                    },
                  },
                  {
                    label: 'Log scale',
                    type: 'radio',
                    checked: self.scaleType === 'log',
                    onClick: () => {
                      self.setScaleType('log')
                    },
                  },
                ],
              },
              {
                label: 'Autoscale type',
                subMenu: (
                  [
                    ['local', 'Local'],
                    ['global', 'Global'],
                    ['globalsd', 'Global ± 3σ'],
                    ['localsd', 'Local ± 3σ'],
                  ] as const
                ).map(([val, label]) => ({
                  label,
                  type: 'radio' as const,
                  checked: self.autoscaleType === val,
                  onClick: () => {
                    self.setAutoscale(val)
                  },
                })),
              },
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
