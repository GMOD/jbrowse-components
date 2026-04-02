import type React from 'react'
import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
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

import type { MultiPairGetFeaturesResult } from '../LinearSyntenyRPC/MultiPairGetFeatures.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'
import type {
  FetchContext,
  LinearGenomeViewModel,
  MultiRegionRegion as Region,
} from '@jbrowse/plugin-linear-genome-view'

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
      }),
    )
    .volatile(() => ({
      genomeRows: new Map<string, MultiPairFeature[]>(),
      allGenomeNames: [] as string[],
      contextMenuFeature: undefined as Feature | undefined,
      statusMessage: undefined as string | undefined,
      coverageMaxDepth: 0,
      coveragePerRefName: undefined as
        | Map<string, { depths: Float32Array; maxDepth: number; startOffset: number; regionStart: number }>
        | undefined,
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
      legendItems() {
        return legendItemsMap[self.colorBy] ?? []
      },
    }))
    .actions(self => ({
      setGenomeRows(rows: Map<string, MultiPairFeature[]>) {
        self.genomeRows = rows
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
      setCoverageData(
        maxDepth: number,
        perRefName?: Map<string, { depths: Float32Array; maxDepth: number; startOffset: number; regionStart: number }>,
      ) {
        self.coverageMaxDepth = maxDepth
        self.coveragePerRefName = perRefName
      },
      setCoverageHeight(h: number) {
        self.coverageHeight = h
      },
      setSelectedGenomes(genomes: string[]) {
        self.selectedGenomes.replace(genomes)
      },
      setStatusMessage(msg?: string) {
        self.statusMessage = msg
      },
      clearDisplaySpecificData() {
        self.genomeRows = new Map()
        self.allGenomeNames = []
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

            const regions = needed.map(n => n.region)

            const result: MultiPairGetFeaturesResult = await rpcManager.call(
              sessionId,
              'MultiPairGetFeatures',
              {
                adapterConfig,
                regions,
                bpPerPx: view.bpPerPx,
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

            const genomeRowsMap = new Map(result.genomeRows)
            self.setGenomeRows(genomeRowsMap)

            for (const { region, regionNumber } of needed) {
              self.setLoadedRegionForRegion(regionNumber, region)
            }
          })
        },

        afterAttach() {
          superAfterAttach()
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
