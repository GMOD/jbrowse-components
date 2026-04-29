import type React from 'react'
import { lazy } from 'react'

import {
  computeCoverageTicks,
  computeVisibleMaxDepth,
} from '@jbrowse/alignments-core'
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import BarChartIcon from '@mui/icons-material/BarChart'
import BubbleChartIcon from '@mui/icons-material/BubbleChart'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import TimelineIcon from '@mui/icons-material/Timeline'
import ViewComfyIcon from '@mui/icons-material/ViewComfy'
import { autorun, observable } from 'mobx'

import { LABEL_WIDTH } from './shared/types.ts'
import { legendItems as legendItemsMap } from './components/multiSyntenyColorUtils.ts'
import { prepareBlockGeometry } from './components/multiSyntenyGpuData.ts'
import { packCoverageForGpu } from './features/coverage/packGpu.ts'
import { packIndicatorsForGpu } from './features/indicator/packGpu.ts'
import { packSnpCoverageForGpu } from './features/snpCoverage/packGpu.ts'
import {
  getGlobalMaxDepth,
  mergeGenomeRows,
} from '../LinearSyntenyRPC/syntenyRegionTypes.ts'

import type { SyntenyRegionData } from '../LinearSyntenyRPC/syntenyRegionTypes.ts'
import type { MultiSyntenyBackend } from './components/rendererTypes.ts'
import type { SyntenyColors } from './shared/types.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature, Region } from '@jbrowse/core/util'
import type {
  FetchContext,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

export interface SyntenyColorPalette {
  coverageColorRgb: [number, number, number]
  coverageColorHex: string
  baseColorGl: {
    A: [number, number, number]
    C: [number, number, number]
    G: [number, number, number]
    T: [number, number, number]
  }
  syntenyColors: SyntenyColors
}

type LGV = LinearGenomeViewModel

const colorByOptions = ['strand', 'syri', 'identity'] as const

function regionFromFeature(feature: Feature, fallbackAssembly: string) {
  const fStart = feature.get('start')
  const fEnd = feature.get('end')
  const padding = Math.max(10, Math.floor((fEnd - fStart) * 0.5))
  return {
    refName: feature.get('refName'),
    assemblyName:
      (feature.get('assemblyName') as string | undefined) ?? fallbackAssembly,
    start: Math.max(0, fStart - padding),
    end: fEnd + padding,
  }
}

function regionFromViewport(view: LGV) {
  const dr = view.displayedRegions[0]
  if (!dr) {
    return undefined
  }
  const rawStart = view.offsetPx * view.bpPerPx
  const rawEnd = (view.offsetPx + view.width) * view.bpPerPx
  return {
    refName: dr.refName,
    assemblyName: dr.assemblyName,
    start: Math.max(0, Math.floor(rawStart)),
    end: Math.floor(rawEnd),
  }
}

const SUBGRAPH_VIEW_TYPES = [
  {
    type: 'GraphGenomeView' as const,
    label: 'Graph genome',
    icon: BubbleChartIcon,
  },
  { type: 'TubeMapView' as const, label: 'Tube map', icon: TimelineIcon },
]

function regionLabel(region: { refName: string; start: number; end: number }) {
  return `${region.refName}:${region.start.toLocaleString()}-${region.end.toLocaleString()}`
}

async function launchSubgraphView(
  session: ReturnType<typeof getSession>,
  sessionId: string,
  adapterConfig: Record<string, unknown>,
  region: { refName: string; assemblyName: string; start: number; end: number },
  viewType: 'GraphGenomeView' | 'TubeMapView',
) {
  const gfaText = await session.rpcManager.call(sessionId, 'GetSubgraph', {
    adapterConfig,
    region,
    sessionId,
  })
  if (!gfaText) {
    session.notify(
      'This adapter does not support graph subgraph extraction',
      'warning',
    )
    return
  }
  const view = session.addView(viewType, {})
  ;(view as { loadGFA?: (gfa: string, label: string) => void }).loadGFA?.(
    gfaText,
    regionLabel(region),
  )
}

const LaunchSyntenyViewDialog = lazy(
  () => import('../LGVSyntenyDisplay/components/LaunchSyntenyViewDialog.tsx'),
)
const GenomeSubsetSelector = lazy(
  () => import('./components/GenomeSubsetSelector.tsx'),
)
const LaunchPairwiseSyntenyDialog = lazy(
  () => import('./components/LaunchPairwiseSyntenyDialog.tsx'),
)
const SetRowHeightDialog = lazy(
  () => import('./components/SetRowHeightDialog.tsx'),
)

// Follows the canonical GPU display architecture (see
// agent-docs/ARCHITECTURE.md): compose MultiRegionDisplayMixin,
// override fetchNeeded, and call self.installGpuDisplay(backend,
// {upload, render}) in startGpuBackendLifecycle. The mixin owns fetch
// invalidation via rpcProps and the upload/render autorun pair via
// installGpuDisplay.

function stateModelFactory(schema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'MultiLGVSyntenyDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      types.model({
        type: types.literal('MultiLGVSyntenyDisplay'),
        configuration: ConfigurationReference(schema),
        colorBy: types.optional(types.string, 'strand'),
        selectedGenomes: types.optional(types.array(types.string), []),
        rowHeightSetting: types.optional(types.number, 0),
        rowSpacing: types.optional(types.boolean, true),
        snpBpPerPxThreshold: types.optional(types.number, 100),
        showCoverage: types.optional(types.boolean, true),
        coverageHeight: types.optional(types.number, 45),
        resolution: types.optional(types.number, 1),
      }),
    )
    .volatile(() => ({
      rpcDataMap: observable.map<number, SyntenyRegionData>(),
      allGenomeNames: [] as string[],
      contextMenuFeature: undefined as Feature | undefined,
      visibleMaxDepth: 0,
      colorPalette: null as SyntenyColorPalette | null,
    }))
    .views(() => ({
      get featureWidgetType() {
        return {
          type: 'SyntenyFeatureWidget',
          id: 'syntenyFeature',
        }
      },
    }))
    .views(self => ({
      get prefersOffset() {
        return true
      },
      get referenceGenomeName() {
        const view = getContainingView(self) as LGV
        return view.displayedRegions[0]?.assemblyName
      },
      get queryGenomeNames() {
        const ref = this.referenceGenomeName
        if (ref) {
          return self.allGenomeNames.filter(n => n !== ref)
        }
        return self.allGenomeNames
      },
      get displayedGenomes() {
        const ref = this.referenceGenomeName
        const names =
          self.selectedGenomes.length > 0
            ? [...self.selectedGenomes]
            : self.allGenomeNames
        if (ref) {
          return names.filter(n => n !== ref)
        }
        return names
      },
      get genomeRows() {
        return mergeGenomeRows(self.rpcDataMap)
      },
      get syntenyCoverageHeight() {
        return self.showCoverage ? self.coverageHeight : 0
      },
      get syntenyAreaHeight() {
        return self.height - this.syntenyCoverageHeight
      },
      get autoRowHeight() {
        const n = this.displayedGenomes.length
        if (n === 0) {
          return this.syntenyAreaHeight
        }
        return this.syntenyAreaHeight / n
      },
      get rowHeight() {
        if (self.rowHeightSetting === 0) {
          return this.autoRowHeight
        }
        return self.rowHeightSetting
      },
      get showSnps() {
        if (self.snpBpPerPxThreshold <= 0) {
          return false
        }
        const view = getContainingView(self) as LGV
        return view.bpPerPx < self.snpBpPerPxThreshold
      },
      get coverageMaxDepth() {
        return self.visibleMaxDepth
      },
      get coverageTicks() {
        if (self.visibleMaxDepth === 0 || this.syntenyCoverageHeight === 0) {
          return undefined
        }
        return computeCoverageTicks(
          self.visibleMaxDepth,
          this.syntenyCoverageHeight,
        )
      },
      legendItems() {
        return legendItemsMap[self.colorBy] ?? []
      },

      // Settings sent to the worker via RPC. Adding a field here propagates
      // both into the RPC payload (via fetchNeeded) and into the
      // mixin-owned SettingsInvalidate autorun (which reads this getter),
      // so refetch happens automatically when any field changes.
      get rpcProps() {
        return {
          resolution: self.resolution,
        }
      },

      // Max coverage depth across all loaded regions; fed into the
      // per-region coverage upload so heights share a common scale.
      get coverageGlobalMax() {
        return getGlobalMaxDepth(self.rpcDataMap)
      },

      // Per-frame render state. Returns undefined to skip render until
      // the palette + view are ready.
      get syntenyRenderState() {
        const view = getContainingView(self) as LGV
        const palette = self.colorPalette
        if (!view.initialized || !palette) {
          return undefined
        }
        return {
          contentBlocks: view.staticBlocks.contentBlocks,
          viewOffsetPx: view.offsetPx,
          width: view.width,
          height: self.height,
          rowHeight: this.rowHeight,
          rowSpacing: self.rowSpacing,
          coverageHeight: this.syntenyCoverageHeight,
          palette,
          displayedGenomes: this.displayedGenomes,
          labelW: this.rowHeight >= 12 ? LABEL_WIDTH : 0,
        }
      },
    }))
    .actions(self => ({
      setRpcData(displayedRegionIndex: number, data: SyntenyRegionData) {
        self.rpcDataMap.set(displayedRegionIndex, data)
      },
      setAllGenomeNames(names: string[]) {
        self.allGenomeNames = names
      },

      setColorBy(value: string) {
        self.colorBy = value
      },
      setRowHeight(h: number) {
        self.rowHeightSetting = h
      },
      setFitToHeight() {
        self.rowHeightSetting = 0
      },
      setRowSpacing(val: boolean) {
        self.rowSpacing = val
      },
      resizeHeight(distance: number) {
        const oldHeight = self.height
        const minHeight = self.syntenyCoverageHeight + 20
        const newHeight = Math.max(self.height + distance, minHeight)
        self.heightPreConfig = newHeight
        if (self.rowHeightSetting > 0) {
          self.rowHeightSetting =
            self.rowHeightSetting * (newHeight / oldHeight)
        }
        return newHeight - oldHeight
      },
      setSnpBpPerPxThreshold(t: number) {
        self.snpBpPerPxThreshold = t
      },
      setShowCoverage(val: boolean) {
        self.showCoverage = val
      },
      setVisibleMaxDepth(depth: number) {
        self.visibleMaxDepth = depth
      },
      setCoverageHeight(h: number) {
        self.coverageHeight = h
      },
      setSelectedGenomes(genomes: string[]) {
        self.selectedGenomes.replace(genomes)
      },
      setResolution(r: number) {
        self.resolution = r
      },
      setColorPalette(palette: SyntenyColorPalette | null) {
        self.colorPalette = palette
      },
      clearDisplaySpecificData() {
        self.rpcDataMap.clear()
      },

      startGpuBackendLifecycle(backend: MultiSyntenyBackend) {
        self.installGpuDisplay<MultiSyntenyBackend>(backend, {
          upload: b => {
            // Geometry + coverage/SNPs/indicators share one autorun; any
            // observable read inside re-fires the whole pass. Backend
            // methods are idempotent against unchanged inputs.
            const palette = self.colorPalette
            const view = getContainingView(self) as LGV
            const activeCount = self.rpcDataMap.size
            for (const [n, data] of self.rpcDataMap) {
              if (palette) {
                const geometry = prepareBlockGeometry(
                  data.genomeFeatures,
                  self.displayedGenomes,
                  self.colorBy,
                  self.showSnps,
                  palette.syntenyColors,
                )
                b.uploadGeometryForBlock(n, {
                  ...geometry,
                  regionStart: data.regionStart,
                })
              }
              if (self.showCoverage && view.initialized) {
                const coverage = packCoverageForGpu(
                  data.coverageDepths,
                  data.coverageStartPos,
                  self.coverageGlobalMax,
                  Math.ceil(view.width),
                )
                b.uploadCoverageForBlock(n, {
                  ...coverage,
                  regionStart: data.regionStart,
                  maxDepth: data.coverageMaxDepth,
                })
                b.uploadSnpCoverageForBlock(
                  n,
                  packSnpCoverageForGpu(
                    data.snpPositions,
                    data.snpYOffsets,
                    data.snpHeights,
                    data.snpColorTypes,
                    data.snpCount,
                  ),
                )
                b.uploadIndicatorsForBlock(
                  n,
                  packIndicatorsForGpu(
                    data.indicatorPositions,
                    data.numIndicators,
                  ),
                )
              }
            }
            if (activeCount === 0) {
              b.clearAllBlocks()
            }
          },
          render: b => {
            const state = self.syntenyRenderState
            if (!state) {
              return false
            }
            b.renderBlocks(state)
            return true
          },
        })
      },

      selectFeature(feature: Feature) {
        const session = getSession(self)
        session.setSelection(feature)
        if (isSessionModelWithWidgets(session)) {
          const { type, id } = self.featureWidgetType
          session.showWidget(
            session.addWidget(type, id, {
              featureData: feature.toJSON(),
              view: getContainingView(self),
              track: getContainingTrack(self),
            }),
          )
        }
      },
    }))
    .actions(self => {
      const superAfterAttach = self.afterAttach

      return {
        fetchNeeded(
          needed: { region: Region; displayedRegionIndex: number }[],
        ) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          self.fetchRegions(needed, async (ctx: FetchContext) => {
            const track = getContainingTrack(self)
            const adapterConfig = getConf(track, 'adapter')
            const session = getSession(self)
            const sessionId = getRpcSessionId(self)
            const { rpcManager } = session
            const view = getContainingView(self) as LGV

            const result = await rpcManager.call(
              sessionId,
              'MultiPairGetFeatures',
              {
                adapterConfig,
                regions: needed,
                bpPerPx: view.bpPerPx,
                ...self.rpcProps,
                sessionId,
                stopToken: ctx.stopToken,
                fetchMetadata: self.allGenomeNames.length === 0,
                statusCallback: (msg: string) => {
                  if (isAlive(self)) {
                    self.setStatusMessage(msg)
                  }
                },
              },
            )

            if (ctx.isStale()) {
              return
            }

            if (result.chromSizes && session.addAssembly) {
              const { assemblyManager } = session
              for (const [genome, chromRegions] of result.chromSizes) {
                if (!assemblyManager.get(genome)) {
                  session.addAssembly({
                    name: genome,
                    sequence: {
                      type: 'ReferenceSequenceTrack',
                      trackId: `${genome.replaceAll('#', '_')}_refseq`,
                      adapter: {
                        type: 'FromConfigRegionsAdapter',
                        features: chromRegions.map((r, i) => ({
                          uniqueId: `${genome}-${r.refName}-${i}`,
                          refName: r.refName,
                          start: 0,
                          end: r.length,
                        })),
                      },
                    },
                  })
                }
              }
            }

            if (result.sources) {
              self.setAllGenomeNames(result.sources.map(s => s.name))
            }

            for (const [displayedRegionIndex, data] of result.regionData) {
              self.setRpcData(displayedRegionIndex, data)
            }
          })
        },

        afterAttach() {
          superAfterAttach()

          // Recompute the visible-region max-depth (debounced) for the
          // coverage track's autoscaled Y axis. Upload / render is
          // driven by startGpuBackendLifecycle via the framework.
          addDisposer(
            self,
            autorun(
              () => {
                if (!self.showCoverage) {
                  return
                }
                const view = getContainingView(self) as LGV
                if (!view.initialized) {
                  return
                }
                const maxDepth = computeVisibleMaxDepth(
                  view.dynamicBlocks.contentBlocks,
                  b =>
                    b.displayedRegionIndex !== undefined
                      ? self.rpcDataMap.get(b.displayedRegionIndex)
                      : undefined,
                )
                self.setVisibleMaxDepth(maxDepth)
              },
              {
                delay: 400,
                name: 'MultiLGVSyntenyDisplay:visibleMaxDepth',
              },
            ),
          )
        },

        async renderSvg(): Promise<React.ReactNode> {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self as MultiLGVSyntenyDisplayModel)
        },
      }
    })
    .views(self => ({
      contextMenuItems() {
        const feature = self.contextMenuFeature
        if (!feature) {
          return [] as MenuItem[]
        }
        const track = getContainingTrack(self)
        const adapterConfig = getConf(track, 'adapter')
        return [
          {
            label: 'Open feature details',
            icon: MenuOpenIcon,
            onClick: () => {
              self.selectFeature(feature)
            },
          },
          {
            label: 'Launch synteny view for this position',
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                LaunchSyntenyViewDialog,
                {
                  view: getContainingView(self) as LGV,
                  trackId: getConf(track, 'trackId'),
                  handleClose,
                  session: getSession(self),
                  feature,
                },
              ])
            },
          },
          ...SUBGRAPH_VIEW_TYPES.map(({ type: viewType, label, icon }) => ({
            label: `${label} view (feature)`,
            icon,
            onClick: async () => {
              const session = getSession(self)
              const fallback =
                (getContainingView(self) as LGV).displayedRegions[0]
                  ?.assemblyName ?? ''
              const region = regionFromFeature(feature, fallback)
              try {
                await launchSubgraphView(
                  session,
                  getRpcSessionId(self),
                  adapterConfig,
                  region,
                  viewType,
                )
              } catch (e) {
                console.error(`[${viewType} launch] Error:`, e)
                session.notify(
                  `Failed to launch ${viewType}: ${e instanceof Error ? e.message : e}`,
                  'error',
                )
              }
            },
          })),
          {
            label: 'Copy info to clipboard',
            icon: ContentCopyIcon,
            onClick: async () => {
              const { uniqueId, ...rest } = feature.toJSON()
              const session = getSession(self)
              const { default: copy } = await import('copy-to-clipboard')
              await copy(JSON.stringify(rest, null, 4))
              session.notify('Copied to clipboard', 'success')
            },
          },
        ]
      },
      trackMenuItems(): MenuItem[] {
        const view = getContainingView(self) as LGV
        const track = getContainingTrack(self)
        const trackId = getConf(track, 'trackId')
        const adapterConfig = getConf(track, 'adapter')
        const refAssembly = view.displayedRegions[0]?.assemblyName
        const loc = view.displayedRegions[0]
          ? `${view.displayedRegions[0].refName}:${Math.floor(view.offsetPx * view.bpPerPx)}-${Math.floor((view.offsetPx + view.width) * view.bpPerPx)}`
          : undefined

        const launchSubMenu: MenuItem[] = []
        if (refAssembly && loc && self.displayedGenomes.length > 0) {
          launchSubMenu.push(
            {
              label: `N-way synteny view (${self.displayedGenomes.length + 1} genomes)`,
              icon: ViewComfyIcon,
              onClick: () => {
                const genomes = self.displayedGenomes
                const tracks = genomes.map(() => [trackId])
                getSession(self).addView('LinearSyntenyView', {
                  type: 'LinearSyntenyView',
                  init: {
                    views: [
                      { assembly: refAssembly, loc },
                      ...genomes.map(genome => ({ assembly: genome })),
                    ],
                    tracks,
                  },
                })
              },
            },
            {
              label: '2-way synteny with...',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  LaunchPairwiseSyntenyDialog,
                  {
                    model: self,
                    handleClose,
                    refAssembly,
                    loc,
                    trackId,
                  },
                ])
              },
            },
          )
        }

        for (const { type: viewType, label, icon } of SUBGRAPH_VIEW_TYPES) {
          launchSubMenu.push({
            label: `${label} view (local)`,
            icon,
            onClick: async () => {
              const session = getSession(self)
              const region = regionFromViewport(view)
              if (!region) {
                console.warn(`[${viewType} launch] No displayed region found`)
                return
              }
              try {
                await launchSubgraphView(
                  session,
                  getRpcSessionId(self),
                  adapterConfig,
                  region,
                  viewType,
                )
              } catch (e) {
                console.error(`[${viewType} launch] Error:`, e)
                session.notify(
                  `Failed to launch ${viewType}: ${e instanceof Error ? e.message : e}`,
                  'error',
                )
              }
            },
          })
        }

        return [
          {
            label: 'Show coverage',
            icon: BarChartIcon,
            type: 'checkbox' as const,
            checked: self.showCoverage,
            onClick: () => {
              self.setShowCoverage(!self.showCoverage)
            },
          },
          {
            label: 'Color by',
            subMenu: colorByOptions.map(option => ({
              label: option,
              type: 'radio' as const,
              checked: self.colorBy === option,
              onClick: () => {
                self.setColorBy(option)
              },
            })),
          },
          {
            label: 'Row height',
            subMenu: [
              {
                label: 'Manually set row height',
                onClick: () => {
                  getSession(self).queueDialog(handleClose => [
                    SetRowHeightDialog,
                    {
                      model: self,
                      handleClose,
                    },
                  ])
                },
              },
              {
                label: 'Fit to display height',
                type: 'checkbox' as const,
                checked: self.rowHeightSetting === 0,
                onClick: () => {
                  if (self.rowHeightSetting === 0) {
                    self.setRowHeight(self.rowHeight)
                  } else {
                    self.setFitToHeight()
                  }
                },
              },
              {
                label: 'Row spacing',
                type: 'checkbox' as const,
                checked: self.rowSpacing,
                onClick: () => {
                  self.setRowSpacing(!self.rowSpacing)
                },
              },
            ],
          },
          {
            label: 'SNP detail threshold',
            subMenu: [
              {
                label: 'Off',
                type: 'radio' as const,
                checked: self.snpBpPerPxThreshold === 0,
                onClick: () => {
                  self.setSnpBpPerPxThreshold(0)
                },
              },
              ...[10, 50, 100, 500, 1000].map(t => ({
                label: `${t} bp/px`,
                type: 'radio' as const,
                checked: self.snpBpPerPxThreshold === t,
                onClick: () => {
                  self.setSnpBpPerPxThreshold(t)
                },
              })),
            ],
          },
          {
            label: `Select genomes (${self.displayedGenomes.length}/${self.queryGenomeNames.length})...`,
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                GenomeSubsetSelector,
                {
                  model: self,
                  handleClose,
                },
              ])
            },
          },
          ...(launchSubMenu.length > 0
            ? [
                {
                  label: 'Launch',
                  subMenu: launchSubMenu,
                },
              ]
            : []),
        ]
      },
    }))
}

export type MultiLGVSyntenyDisplayModel = ReturnType<
  typeof stateModelFactory
>['Type']

export default stateModelFactory
