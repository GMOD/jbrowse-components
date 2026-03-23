import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { TrackHeightMixin } from '@jbrowse/plugin-linear-genome-view'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import BubbleChartIcon from '@mui/icons-material/BubbleChart'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import ViewComfyIcon from '@mui/icons-material/ViewComfy'

import { doAfterAttach } from './afterAttach.ts'
import { legendItems as legendItemsMap } from './components/multiSyntenyColorUtils.ts'

import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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

function stateModelFactory(schema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'MultiLGVSyntenyDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      types.model({
        type: types.literal('MultiLGVSyntenyDisplay'),
        configuration: ConfigurationReference(schema),
        colorBy: types.optional(types.string, 'strand'),
        selectedGenomes: types.optional(types.array(types.string), []),
        // 0 = auto (fit rows to display height), >0 = manual px per row
        rowHeightSetting: types.optional(types.number, 0),
        // bpPerPx threshold below which SNP/CIGAR details are fetched and drawn
        // 0 = off, higher = show SNPs at more zoomed-out levels
        snpBpPerPxThreshold: types.optional(types.number, 100),
      }),
    )
    .volatile(() => ({
      genomeRows: new Map<string, MultiPairFeature[]>(),
      allGenomeNames: [] as string[],
      loading: false,
      error: undefined as unknown,
      contextMenuFeature: undefined as Feature | undefined,
    }))
    .views(self => ({
      get displayedGenomes() {
        if (self.selectedGenomes.length > 0) {
          return [...self.selectedGenomes]
        }
        return self.allGenomeNames
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
      setLoading(flag: boolean) {
        self.loading = flag
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
      setError(e: unknown) {
        self.error = e
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
    .actions(self => ({
      afterAttach() {
        doAfterAttach(self)
      },
    }))
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

        if (adapterConfig.type === 'GfaAdapter') {
          const gfaLocation = adapterConfig.gfaLocation
          launchSubMenu.push({
            label: 'Graph genome view',
            icon: BubbleChartIcon,
            onClick: async () => {
              const session = getSession(self)
              const graphView = session.addView('GraphGenomeView', {})
              const uri =
                gfaLocation.uri ??
                gfaLocation.localPath ??
                gfaLocation.internetAccountId
              if (uri) {
                const response = await fetch(uri)
                const text = await response.text()
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (graphView as any).loadGFA(
                  text,
                  uri.split('/').pop() ?? 'GFA',
                )
              }
            },
          })
        }

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
            label: `Select genomes (${self.displayedGenomes.length}/${self.allGenomeNames.length})...`,
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
