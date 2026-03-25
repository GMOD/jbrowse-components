import type React from 'react'
import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import BubbleChartIcon from '@mui/icons-material/BubbleChart'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import ViewComfyIcon from '@mui/icons-material/ViewComfy'

import { legendItems as legendItemsMap } from './components/multiSyntenyColorUtils.ts'

import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'
import type { MultiPairGetFeaturesResult } from '../LinearSyntenyRPC/MultiPairGetFeatures.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
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
        snpBpPerPxThreshold: types.optional(types.number, 100),
      }),
    )
    .volatile(() => ({
      genomeRows: new Map<string, MultiPairFeature[]>(),
      allGenomeNames: [] as string[],
      contextMenuFeature: undefined as Feature | undefined,
      statusMessage: undefined as string | undefined,
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
      get autoRowHeight() {
        const n = this.displayedGenomes.length
        if (n === 0) {
          return self.height
        }
        return self.height / n
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
      setRowHeightSetting(h: number) {
        self.rowHeightSetting = h
      },
      setSnpBpPerPxThreshold(t: number) {
        self.snpBpPerPxThreshold = t
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

            console.log(
              '[MultiSyntenyFetch] Starting RPC, bpPerPx:',
              view.bpPerPx,
              'regions:',
              regions.map(r => `${r.refName}:${r.start}-${r.end}`),
            )

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
              console.log('[MultiSyntenyFetch] Discarding stale result')
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
              const names = result.sources.map(s => s.name)
              console.log(
                '[MultiSyntenyFetch] Setting allGenomeNames:',
                names.length,
                'names, first 5:',
                names.slice(0, 5),
                'referenceGenomeName:',
                self.referenceGenomeName,
              )
              self.setAllGenomeNames(names)
            } else {
              console.log('[MultiSyntenyFetch] WARNING: result.sources is undefined/null')
            }

            const genomeRowsMap = new Map(result.genomeRows)
            const totalFeatures = [...genomeRowsMap.values()].reduce(
              (s, f) => s + f.length,
              0,
            )

            // Debug: analyze feature bp distribution
            let globalMinBp = Infinity
            let globalMaxBp = 0
            const bpBuckets = new Map<number, number>()
            for (const [, features] of genomeRowsMap) {
              for (const feat of features) {
                if (feat.start < globalMinBp) {
                  globalMinBp = feat.start
                }
                if (feat.end > globalMaxBp) {
                  globalMaxBp = feat.end
                }
                const bucket = Math.floor(feat.start / 100_000) * 100_000
                bpBuckets.set(bucket, (bpBuckets.get(bucket) ?? 0) + 1)
              }
            }
            const sortedBuckets = [...bpBuckets.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([bp, count]) => `${(bp / 1e6).toFixed(1)}Mb:${count}`)

            console.log(
              '[MultiSyntenyFetch] RPC complete, genomeRows keys:',
              [...genomeRowsMap.keys()],
              'total features:',
              totalFeatures,
            )
            console.log(
              '[MultiSyntenyFetch] Feature bp coverage:',
              globalMinBp.toLocaleString(),
              '-',
              globalMaxBp.toLocaleString(),
              `(${((globalMaxBp - globalMinBp) / 1e6).toFixed(2)} Mb)`,
              'view range:',
              regions.map(r => `${r.refName}:${r.start}-${r.end}`),
            )
            console.log(
              '[MultiSyntenyFetch] Feature distribution (100kb buckets):',
              sortedBuckets,
            )
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
                  trackId: getConf(getContainingTrack(self), 'trackId'),
                  handleClose,
                  session: getSession(self),
                  feature,
                },
              ])
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

        launchSubMenu.push({
          label: 'Graph genome view (local)',
          icon: BubbleChartIcon,
          onClick: async () => {
            const session = getSession(self)
            const dr = view.displayedRegions[0]
            if (!dr) {
              return
            }
            const region = {
              refName: dr.refName,
              assemblyName: dr.assemblyName,
              start: Math.floor(view.offsetPx * view.bpPerPx),
              end: Math.floor(
                (view.offsetPx + view.width) * view.bpPerPx,
              ),
            }
            const sessionId = getRpcSessionId(self)
            const { rpcManager } = session
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (graphView as any).loadGFA(
              gfaText,
              `${region.refName}:${region.start.toLocaleString()}-${region.end.toLocaleString()}`,
            )
          },
        })

        return [
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
                label: 'Normal',
                type: 'radio' as const,
                checked: self.rowHeightSetting === 0,
                onClick: () => {
                  self.setRowHeightSetting(0)
                },
              },
              {
                label: 'Compact',
                type: 'radio' as const,
                checked: self.rowHeightSetting === 3,
                onClick: () => {
                  self.setRowHeightSetting(3)
                },
              },
              {
                label: 'Super-compact',
                type: 'radio' as const,
                checked: self.rowHeightSetting === 1,
                onClick: () => {
                  self.setRowHeightSetting(1)
                },
              },
              {
                label: 'Custom...',
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
