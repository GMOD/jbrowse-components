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
import { addDisposer, cast, isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  ConfigOverrideMixin,
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import { computeHierarchyLayout, parseClusterTree } from '@jbrowse/tree-sidebar'
import EqualizerIcon from '@mui/icons-material/Equalizer'
import PaletteIcon from '@mui/icons-material/Palette'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { autorun, untracked } from 'mobx'

import axisPropsFromTickScale from '../shared/axisPropsFromTickScale.ts'
import { migrateWiggleSnapshot } from '../shared/migrateWiggleSnapshot.ts'
import { getRowHeight, isOverlayMode } from '../shared/wiggleComponentUtils.ts'
import { computeAutoscaleDomain, getNiceDomain, getScale } from '../util.ts'

import type { MultiWiggleDataResult } from '../RenderMultiWiggleDataRPC/types.ts'
import type { Source, SourceInfo } from '../util.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  FetchContext,
  LinearGenomeViewModel,
  MultiRegionRegionWithNumber as RegionWithNumber,
} from '@jbrowse/plugin-linear-genome-view'
import type { HoveredTreeNode } from '@jbrowse/tree-sidebar'

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
      types.model({
        type: types.literal('MultiLinearWiggleDisplay'),
        configuration: ConfigurationReference(configSchema),
        resolution: types.optional(types.number, 1),
        layout: types.frozen([] as Source[]),
        clusterTree: types.maybe(types.string),
        treeAreaWidth: types.optional(types.number, 80),
        subtreeFilter: types.maybe(types.array(types.string)),
        displayCrossHatches: types.optional(types.boolean, false),
      }),
    )
    .preProcessSnapshot((snap: any) => {
      if (!snap) {
        return snap
      }

      // Strip properties from old BaseLinearDisplay snapshots
      const { blockState, showLegend, showTooltips, ...cleaned } = snap
      snap = cleaned

      // Rewrite "height" from older snapshots to "heightPreConfig"
      if (snap.height !== undefined && snap.heightPreConfig === undefined) {
        const { height, ...rest } = snap
        snap = { ...rest, heightPreConfig: height }
      }

      return migrateWiggleSnapshot(snap, { multiWiggle: true })
    })
    .volatile(() => ({
      rpcDataMap: new Map<number, MultiWiggleDataResult>(),
      sourcesVolatile: [] as SourceInfo[],
      visibleScoreRange: undefined as [number, number] | undefined,
      loadedBpPerPx: new Map<number, number>(),
      hoveredTreeNode: undefined as HoveredTreeNode | undefined,
      treeCanvas: undefined as HTMLCanvasElement | undefined,
      mouseoverCanvas: undefined as HTMLCanvasElement | undefined,
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

      renderProps() {
        return { notReady: true }
      },

      get sourcesWithoutLayout() {
        return self.sourcesVolatile.map((s, i) => ({
          source: s.name,
          ...s,
          color: resolveOverlayColor(i, this.isOverlay, s.color),
        }))
      },

      get sources(): Source[] {
        const sourceMap = Object.fromEntries(
          self.sourcesVolatile.map(s => [s.name, s]),
        )
        const layoutColors = Object.fromEntries(
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
          ...sourceMap[s.name],
          ...s,
          color: resolveOverlayColor(
            i,
            this.isOverlay,
            sourceMap[s.name]?.color,
            layoutColors[s.name],
          ),
        }))
      },

      get adapterConfig() {
        const track = getContainingTrack(self)
        return getConf(track, 'adapter')
      },

      get hasResolution() {
        const track = getContainingTrack(self)
        const adapterConfig = getConf(track, 'adapter') as { type: string }
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

      get domain(): [number, number] | undefined {
        if (self.rpcDataMap.size === 0) {
          return undefined
        }
        const range = self.visibleScoreRange
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
    }))
    .views(self => ({
      get showTree() {
        return self.getOverride<boolean>('showTree') ?? true
      },

      get showRowSeparators() {
        return self.getOverride<boolean>('showRowSeparators') ?? false
      },

      get root() {
        const newick = self.clusterTree
        if (!newick) {
          return undefined
        }
        return parseClusterTree(newick, self.subtreeFilter?.slice())
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
      setRpcDataForRegion(regionNumber: number, data: MultiWiggleDataResult) {
        const next = new Map(self.rpcDataMap)
        next.set(regionNumber, data)
        self.rpcDataMap = next
        if (self.sourcesVolatile.length === 0 && data.sources.length > 0) {
          self.sourcesVolatile = data.sources.map(s => ({
            name: s.name,
            color: s.color,
          }))
        }
      },

      setVisibleScoreRange(range: [number, number]) {
        self.visibleScoreRange = range
      },

      setLoadedBpPerPxForRegion(regionNumber: number, bpPerPx: number) {
        const next = new Map(self.loadedBpPerPx)
        next.set(regionNumber, bpPerPx)
        self.loadedBpPerPx = next
      },

      clearDisplaySpecificData() {
        self.rpcDataMap = new Map()
        self.visibleScoreRange = undefined
        self.loadedBpPerPx = new Map()
      },

      reload() {
        self.setError(null)
        self.clearAllRpcData()
      },

      setSources(sources: SourceInfo[]) {
        self.sourcesVolatile = sources
      },

      setLayout(layout: Source[], clearTree = true) {
        const orderChanged =
          clearTree &&
          self.clusterTree &&
          self.layout.length === layout.length &&
          (self.layout as Source[]).some(
            (source: Source, idx: number) => source.name !== layout[idx]?.name,
          )

        self.layout = layout
        if (orderChanged) {
          self.clusterTree = undefined
        }
      },

      clearLayout() {
        self.layout = []
        self.clusterTree = undefined
      },

      setClusterTree(tree?: string) {
        self.clusterTree = tree
      },

      setTreeAreaWidth(width: number) {
        self.treeAreaWidth = width
      },

      setShowTree(arg: boolean) {
        self.setOverride('showTree', arg)
      },

      setShowRowSeparators(arg: boolean) {
        self.setOverride('showRowSeparators', arg)
      },

      setSubtreeFilter(names?: string[]) {
        self.subtreeFilter = names ? cast(names) : undefined
      },

      setHoveredTreeNode(node?: HoveredTreeNode) {
        self.hoveredTreeNode = node
      },

      setTreeCanvasRef(ref: HTMLCanvasElement | null) {
        self.treeCanvas = ref || undefined
      },

      setMouseoverCanvasRef(ref: HTMLCanvasElement | null) {
        self.mouseoverCanvas = ref || undefined
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
      async function fetchFeaturesForRegion(
        region: RegionWithNumber,
        stopToken: StopToken,
        bpPerPx: number,
        resolution: number,
        generation: number,
      ) {
        const session = getSession(self)
        const { rpcManager } = session
        const track = getContainingTrack(self)
        const adapterConfig = getConf(track, 'adapter')

        if (!adapterConfig) {
          return
        }

        const result = await rpcManager.call(
          getRpcSessionId(self),
          'RenderMultiWiggleData',
          {
            adapterConfig,
            region: region.region,
            sources: self.sources,
            bicolorPivot: self.bicolorPivot,
            stopToken,
            bpPerPx,
            resolution,
            statusCallback: (msg: string) => {
              if (isAlive(self)) {
                self.setStatusMessage(msg)
              }
            },
          },
        )

        if (isAlive(self) && generation === self.fetchGeneration) {
          self.setRpcDataForRegion(region.regionNumber, result)
          self.setLoadedBpPerPxForRegion(region.regionNumber, bpPerPx)
        }
      }

      const superAfterAttach = self.afterAttach

      let prevPivot: number | undefined
      let prevResolution: number | undefined

      return {
        isCacheValid(regionNumber: number) {
          const view = getContainingView(self) as LGV
          const regionBpPerPx = untracked(() =>
            self.loadedBpPerPx.get(regionNumber),
          )
          return (
            regionBpPerPx === undefined || view.bpPerPx >= regionBpPerPx / 2
          )
        },

        onFetchNeeded(needed: RegionWithNumber[]) {
          const view = getContainingView(self) as LGV
          const { bpPerPx } = view
          const { resolution } = self
          self.withFetchLifecycle(needed, async (ctx: FetchContext) => {
            const promises = needed.map(region =>
              fetchFeaturesForRegion(
                region,
                ctx.stopToken,
                bpPerPx,
                resolution,
                ctx.generation,
              ),
            )
            await Promise.all(promises)
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

          addDisposer(
            self,
            autorun(
              () => {
                const pivot = self.bicolorPivot
                if (prevPivot !== undefined && pivot !== prevPivot) {
                  self.clearAllRpcData()
                }
                prevPivot = pivot
              },
              { name: 'BicolorPivotChange' },
            ),
          )

          addDisposer(
            self,
            autorun(
              () => {
                const { resolution } = self
                if (
                  prevResolution !== undefined &&
                  resolution !== prevResolution
                ) {
                  self.clearAllRpcData()
                }
                prevResolution = resolution
              },
              { name: 'ResolutionChange' },
            ),
          )

          addDisposer(
            self,
            autorun(
              () => {
                try {
                  if (!isAlive(self)) {
                    return
                  }
                  const view = getContainingView(self) as LGV
                  if (!view.initialized) {
                    return
                  }
                  const numStdDev =
                    self.getConfWithOverride<number>('numStdDev')
                  const visibleEntries = view.dynamicBlocks.contentBlocks
                    .filter(block => block.regionNumber !== undefined)
                    .flatMap(block => {
                      const regionData = self.rpcDataMap.get(
                        block.regionNumber!,
                      )
                      if (!regionData) {
                        return []
                      }
                      const visStart = block.start - regionData.regionStart
                      const visEnd = block.end - regionData.regionStart
                      return regionData.sources.map(source => ({
                        visStart,
                        visEnd,
                        data: source,
                      }))
                    })
                  const allEntries = [...self.rpcDataMap.values()].flatMap(
                    regionData =>
                      regionData.sources.map(source => ({ data: source })),
                  )
                  const range = computeAutoscaleDomain(
                    self.autoscaleType,
                    self.summaryScoreMode,
                    numStdDev,
                    visibleEntries,
                    allEntries,
                  )
                  if (
                    range &&
                    (range[0] !== self.visibleScoreRange?.[0] ||
                      range[1] !== self.visibleScoreRange[1])
                  ) {
                    self.setVisibleScoreRange(range)
                  }
                } catch (e) {
                  if (isAlive(self)) {
                    console.error(
                      '[MultiWiggle] VisibleScoreRange autorun error',
                      e,
                    )
                  }
                }
              },
              { delay: 400, name: 'VisibleScoreRange' },
            ),
          )
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
