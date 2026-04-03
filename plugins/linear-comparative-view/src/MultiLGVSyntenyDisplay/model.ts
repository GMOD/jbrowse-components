import type React from 'react'
import { lazy } from 'react'

import { computeCoverageTicks } from '@jbrowse/alignments-core'
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
  makeDisplayedRegionKey,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'
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

import { legendItems as legendItemsMap } from './components/multiSyntenyColorUtils.ts'

import { getFirstCoverageFromRpcDataMap } from '../LinearSyntenyRPC/syntenyRegionTypes.ts'

import type { SyntenyRegionData, MultiPairGetFeaturesResult } from '../LinearSyntenyRPC/syntenyRegionTypes.ts'
import type { MultiSyntenyRenderer } from './components/MultiSyntenyRenderer.ts'
import type { SyntenyColors } from './components/multiSyntenyBackendTypes.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'
import type {
  FetchContext,
  LinearGenomeViewModel,
  MultiRegionRegion as Region,
} from '@jbrowse/plugin-linear-genome-view'

export interface SyntenyColorPalette {
  coverageColorRgb: [number, number, number]
  syntenyColors: SyntenyColors
}

type LGV = LinearGenomeViewModel

const colorByOptions = ['strand', 'syri', 'identity'] as const

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

// SYNC: This display follows the same fetch + GPU rendering architecture as
// LinearAlignmentsDisplay (plugins/alignments/src/LinearAlignmentsDisplay/model.ts):
//
//   1. Compose with MultiRegionDisplayMixin for viewport-aware fetching
//   2. Override onFetchNeeded → withFetchLifecycle for stop-token + stale checks
//   3. Override clearDisplaySpecificData to reset display-specific state
//   4. Capture superAfterAttach to register the mixin's autoruns
//   5. GPU autoruns: upload (registered first) then draw (tracks dataVersion)
//
// Changes to this pattern should be mirrored in both displays.

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
      rpcDataMap: new Map<string, SyntenyRegionData>(),
      allGenomeNames: [] as string[],
      contextMenuFeature: undefined as Feature | undefined,
      statusMessage: undefined as string | undefined,
      visibleMaxDepth: 0,
      webglRenderer: null as MultiSyntenyRenderer | null,
      colorPalette: null as SyntenyColorPalette | null,
    }))
    .views(self => ({
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
        const merged = new Map<string, MultiPairFeature[]>()
        for (const data of self.rpcDataMap.values()) {
          for (const [genome, features] of data.genomeFeatures) {
            const existing = merged.get(genome)
            if (existing) {
              for (const f of features) {
                existing.push(f)
              }
            } else {
              merged.set(genome, [...features])
            }
          }
        }
        return merged
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
        return computeCoverageTicks(self.visibleMaxDepth, this.syntenyCoverageHeight)
      },
      legendItems() {
        return legendItemsMap[self.colorBy] ?? []
      },
    }))
    .actions(self => ({
      setRpcData(blockKey: string, data: SyntenyRegionData) {
        const next = new Map(self.rpcDataMap)
        next.set(blockKey, data)
        self.rpcDataMap = next
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
      setStatusMessage(msg?: string) {
        self.statusMessage = msg
      },
      setWebGLRenderer(renderer: MultiSyntenyRenderer | null) {
        self.webglRenderer = renderer
      },
      setColorPalette(palette: SyntenyColorPalette | null) {
        self.colorPalette = palette
      },
      clearDisplaySpecificData() {
        self.rpcDataMap = new Map()
        self.allGenomeNames = []
        self.webglRenderer?.clearAllBlocks()
      },
      selectFeature(feature: Feature) {
        const session = getSession(self)
        if (isSessionModelWithWidgets(session)) {
          const featureWidget = session.addWidget(
            'SyntenyFeatureWidget',
            'syntenyFeature',
            {
              featureData: feature.toJSON(),
              view: getContainingView(self),
              track: getContainingTrack(self),
            },
          )
          session.showWidget(featureWidget)
        }
        session.setSelection(feature)
      },
    }))
    .actions(self => {
      const superAfterAttach = self.afterAttach

      return {
        onFetchNeeded(needed: { region: Region; regionNumber: number }[]) {
          self.withFetchLifecycle(needed, async (ctx: FetchContext) => {
            const track = getContainingTrack(self)
            const adapterConfig = getConf(track, 'adapter')
            const session = getSession(self)
            const sessionId = getRpcSessionId(self)
            const { rpcManager } = session
            const view = getContainingView(self) as LGV

            const regions = needed.map(n => ({
              region: n.region,
              blockKey: makeDisplayedRegionKey(view.displayedRegions[n.regionNumber]!),
            }))

            const result: MultiPairGetFeaturesResult = await rpcManager.call(
              sessionId,
              'MultiPairGetFeatures',
              {
                adapterConfig,
                regions,
                bpPerPx: view.bpPerPx,
                resolution: self.resolution,
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

            for (const [blockKey, data] of result.regionData) {
              self.setRpcData(blockKey, data)
            }

            for (const { region, regionNumber } of needed) {
              self.setLoadedRegionForRegion(regionNumber, region)
            }
          })
        },

        afterAttach() {
          superAfterAttach()

          // Autorun 1: upload geometry per region (keyed by regionKey)
          addDisposer(
            self,
            autorun(
              () => {
                const renderer = self.webglRenderer
                if (!renderer?.isGpu) {
                  return
                }
                const { rpcDataMap, displayedGenomes, colorBy, showSnps, colorPalette } = self
                if (!colorPalette) {
                  return
                }
                for (const [regionKey, data] of rpcDataMap) {
                  renderer.uploadGeometryForBlock(
                    regionKey,
                    data,
                    displayedGenomes,
                    colorBy,
                    showSnps,
                    colorPalette.syntenyColors,
                  )
                }
              },
              { name: 'MultiLGVSyntenyDisplay:uploadGeometry' },
            ),
          )

          // Autorun 2: upload coverage per region
          addDisposer(
            self,
            autorun(
              () => {
                const renderer = self.webglRenderer
                if (!renderer?.isGpu || !self.showCoverage) {
                  return
                }
                const { rpcDataMap } = self
                const view = getContainingView(self) as LGV
                if (!view.initialized) {
                  return
                }
                let globalMax = 0
                for (const data of rpcDataMap.values()) {
                  if (data.coverageMaxDepth > globalMax) {
                    globalMax = data.coverageMaxDepth
                  }
                }
                for (const [regionKey, data] of rpcDataMap) {
                  renderer.uploadCoverageForBlock(
                    regionKey,
                    data,
                    Math.ceil(view.width),
                    globalMax,
                  )
                }
              },
              { name: 'MultiLGVSyntenyDisplay:uploadCoverage' },
            ),
          )

          // Autorun 3: draw
          addDisposer(
            self,
            autorun(
              () => {
                const renderer = self.webglRenderer
                const palette = self.colorPalette
                if (!renderer || !palette) {
                  return
                }
                const view = getContainingView(self) as LGV
                if (!view.initialized) {
                  return
                }
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const _dv = self.dataVersion
                const { height, rowHeight, rowSpacing, syntenyCoverageHeight } = self
                const contentBlocks = view.staticBlocks.contentBlocks
                const regionKeyMap = new Map<number, string>()
                for (let i = 0; i < view.displayedRegions.length; i++) {
                  regionKeyMap.set(i, makeDisplayedRegionKey(view.displayedRegions[i]!))
                }

                if (renderer.isGpu) {
                  renderer.renderGpu(
                    contentBlocks,
                    regionKeyMap,
                    view.offsetPx,
                    view.width,
                    height,
                    rowHeight,
                    rowSpacing,
                    syntenyCoverageHeight,
                    palette.coverageColorRgb,
                  )
                } else {
                  const { genomeRows, displayedGenomes, colorBy, syntenyAreaHeight, showSnps } = self
                  const { width, offsetPx } = view
                  const labelW = rowHeight >= 12 ? 120 : 0
                  const bpToPx = (refName: string, coord: number) => {
                    const result = view.bpToPx({ refName, coord })
                    if (result === undefined) {
                      return undefined
                    }
                    return result.offsetPx - offsetPx
                  }
                  renderer.renderCanvas(genomeRows, displayedGenomes, {
                    width,
                    height: syntenyAreaHeight,
                    rowHeight,
                    rowSpacing,
                    bpToPx,
                    colorBy,
                    labelW,
                    showSnps,
                    coverageHeight: syntenyCoverageHeight,
                    coverage: self.showCoverage
                      ? getFirstCoverageFromRpcDataMap(self.rpcDataMap)
                      : undefined,
                    colors: palette.syntenyColors,
                  })
                }
              },
              { name: 'MultiLGVSyntenyDisplay:draw' },
            ),
          )

          // Autorun 4: visible max depth (debounced).
          // Uses dynamicBlocks for precise viewport, looks up data via
          // displayedRegionKey computed from displayedRegions[regionNumber].
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
                const blocks = view.dynamicBlocks.contentBlocks
                let maxDepth = 0
                for (const block of blocks) {
                  if (block.regionNumber === undefined) {
                    continue
                  }
                  const dr = view.displayedRegions[block.regionNumber]
                  if (!dr) {
                    continue
                  }
                  const data = self.rpcDataMap.get(makeDisplayedRegionKey(dr))
                  if (!data) {
                    continue
                  }
                  const startBin = Math.max(
                    0,
                    Math.floor(block.start - data.regionStart - data.coverageStartOffset),
                  )
                  const endBin = Math.min(
                    data.coverageDepths.length,
                    Math.ceil(block.end - data.regionStart - data.coverageStartOffset),
                  )
                  for (let i = startBin; i < endBin; i++) {
                    const d = data.coverageDepths[i]!
                    if (d > maxDepth) {
                      maxDepth = d
                    }
                  }
                }
                self.setVisibleMaxDepth(maxDepth)
              },
              {
                delay: 400,
                name: 'MultiLGVSyntenyDisplay:visibleMaxDepth',
              },
            ),
          )

          // Autorun 5: data invalidation on resolution change
          let prevResolution: number | undefined
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
              { name: 'MultiLGVSyntenyDisplay:invalidateOnResolution' },
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
          {
            label: 'Graph genome view (feature)',
            icon: BubbleChartIcon,
            onClick: async () => {
              const session = getSession(self)
              const fStart = feature.get('start')
              const fEnd = feature.get('end')
              const padding = Math.max(10, Math.floor((fEnd - fStart) * 0.5))
              const region = {
                refName: feature.get('refName'),
                assemblyName:
                  (feature.get('assemblyName') as string | undefined) ??
                  (getContainingView(self) as LGV).displayedRegions[0]
                    ?.assemblyName ??
                  '',
                start: Math.max(0, fStart - padding),
                end: fEnd + padding,
              }

              const sessionId = getRpcSessionId(self)
              try {
                const gfaText: string = await session.rpcManager.call(
                  sessionId,
                  'GetSubgraph',
                  { adapterConfig, region, sessionId },
                )
                if (!gfaText) {
                  session.notify(
                    'This adapter does not support graph subgraph extraction',
                    'warning',
                  )
                  return
                }
                const graphView = session.addView('GraphGenomeView', {})
                await (graphView as any).loadGFA(
                  gfaText,
                  `${region.refName}:${region.start.toLocaleString()}-${region.end.toLocaleString()}`,
                )
              } catch (e) {
                console.error('[GraphView launch] Error:', e)
                session.notify(
                  `Failed to launch graph view: ${e instanceof Error ? e.message : e}`,
                  'error',
                )
              }
            },
          },
          {
            label: 'Tube map view (feature)',
            icon: TimelineIcon,
            onClick: async () => {
              const session = getSession(self)
              const fStart = feature.get('start')
              const fEnd = feature.get('end')
              const padding = Math.max(10, Math.floor((fEnd - fStart) * 0.5))
              const region = {
                refName: feature.get('refName'),
                assemblyName:
                  (feature.get('assemblyName') as string | undefined) ??
                  (getContainingView(self) as LGV).displayedRegions[0]
                    ?.assemblyName ??
                  '',
                start: Math.max(0, fStart - padding),
                end: fEnd + padding,
              }
              const regionLabel = `${region.refName}:${region.start.toLocaleString()}-${region.end.toLocaleString()}`

              const sessionId = getRpcSessionId(self)
              try {
                const gfaText: string = await session.rpcManager.call(
                  sessionId,
                  'GetSubgraph',
                  { adapterConfig, region, sessionId },
                )
                if (!gfaText) {
                  session.notify(
                    'This adapter does not support graph subgraph extraction',
                    'warning',
                  )
                  return
                }
                const tubeMapView = session.addView('TubeMapView', {})
                ;(tubeMapView as unknown as { loadGFA: (t: string, n: string) => void }).loadGFA(
                  gfaText,
                  regionLabel,
                )
              } catch (e) {
                console.error('[TubeMapView launch] Error:', e)
                session.notify(
                  `Failed to launch tube map view: ${e instanceof Error ? e.message : e}`,
                  'error',
                )
              }
            },
          },
          {
            label: 'Copy info to clipboard',
            icon: ContentCopyIcon,
            onClick: async () => {
              const { uniqueId, ...rest } = feature.toJSON()
              const session = getSession(self)
              const { default: copy } = await import('copy-to-clipboard')
              copy(JSON.stringify(rest, null, 4))
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

        launchSubMenu.push(
          {
            label: 'Graph genome view (local)',
            icon: BubbleChartIcon,
            onClick: async () => {
              const session = getSession(self)
              const dr = view.displayedRegions[0]
              if (!dr) {
                console.warn('[GraphView launch] No displayed region found')
                return
              }
              const rawStart = view.offsetPx * view.bpPerPx
              const rawEnd = (view.offsetPx + view.width) * view.bpPerPx
              const region = {
                refName: dr.refName,
                assemblyName: dr.assemblyName,
                start: Math.max(0, Math.floor(rawStart)),
                end: Math.floor(rawEnd),
              }

              const sessionId = getRpcSessionId(self)
              const { rpcManager } = session
              try {
                const gfaText: string = await rpcManager.call(
                  sessionId,
                  'GetSubgraph',
                  { adapterConfig, region, sessionId },
                )
                if (!gfaText) {
                  session.notify(
                    'This adapter does not support graph subgraph extraction',
                    'warning',
                  )
                  return
                }
                const graphView = session.addView('GraphGenomeView', {})

                await (graphView as any).loadGFA(
                  gfaText,
                  `${region.refName}:${region.start.toLocaleString()}-${region.end.toLocaleString()}`,
                )
              } catch (e) {
                console.error('[GraphView launch] Error:', e)
                session.notify(
                  `Failed to launch graph view: ${e instanceof Error ? e.message : e}`,
                  'error',
                )
              }
            },
          },
          {
            label: 'Tube map view (local)',
            icon: TimelineIcon,
            onClick: async () => {
              const session = getSession(self)
              const dr = view.displayedRegions[0]
              if (!dr) {
                console.warn('[TubeMapView launch] No displayed region found')
                return
              }
              const rawStart = view.offsetPx * view.bpPerPx
              const rawEnd = (view.offsetPx + view.width) * view.bpPerPx
              const region = {
                refName: dr.refName,
                assemblyName: dr.assemblyName,
                start: Math.max(0, Math.floor(rawStart)),
                end: Math.floor(rawEnd),
              }
              const regionLabel = `${region.refName}:${region.start.toLocaleString()}-${region.end.toLocaleString()}`

              const sessionId = getRpcSessionId(self)
              const { rpcManager } = session
              try {
                const gfaText: string = await rpcManager.call(
                  sessionId,
                  'GetSubgraph',
                  { adapterConfig, region, sessionId },
                )
                if (!gfaText) {
                  session.notify(
                    'This adapter does not support graph subgraph extraction',
                    'warning',
                  )
                  return
                }
                const tubeMapView = session.addView('TubeMapView', {})
                ;(tubeMapView as unknown as { loadGFA: (t: string, n: string) => void }).loadGFA(
                  gfaText,
                  regionLabel,
                )
              } catch (e) {
                console.error('[TubeMapView launch] Error:', e)
                session.notify(
                  `Failed to launch tube map view: ${e instanceof Error ? e.message : e}`,
                  'error',
                )
              }
            },
          },
        )

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
