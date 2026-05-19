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
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import {
  TreeSidebarMixin,
  clusterLayout,
  setupTreeDrawingAutorun,
} from '@jbrowse/tree-sidebar'
import BarChartIcon from '@mui/icons-material/BarChart'
import CategoryIcon from '@mui/icons-material/Category'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import { observable } from 'mobx'

import {
  getGlobalMaxDepth,
  mergeGenomeRows,
} from '../LinearSyntenyRPC/syntenyRegionTypes.ts'
import { computeMultiSyntenyLabels } from './components/computeVisibleLabels.ts'
import { getColorByMenuItem } from './menus/colorBy.ts'
import {
  SUBGRAPH_VIEW_TYPES,
  getLaunchSubMenu,
  launchSubgraphView,
  regionFromFeature,
} from './menus/launch.ts'
import { getRowHeightMenuItem } from './menus/rowHeight.ts'
import { getSnpThresholdMenuItem } from './menus/snpThreshold.ts'
import { legendItems as legendItemsMap } from './shared/colorUtils.ts'
import { LABEL_WIDTH } from './shared/types.ts'

import type { SyntenyRegionData } from '../LinearSyntenyRPC/syntenyRegionTypes.ts'
import type { MultiSyntenyBackend } from './components/rendererTypes.ts'
import type { SyntenyColorPalette } from './shared/types.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature, Region } from '@jbrowse/core/util'
import type {
  ExportSvgDisplayOptions,
  FetchContext,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import type { TreeSource } from '@jbrowse/tree-sidebar'

type LGV = LinearGenomeViewModel

// TreeSource extended with a display-name override. Persisted in `layout` and
// rendered in place of the underlying genome name when set. Adapter-fetched
// genome names stay canonical (used for keying rpcDataMap and the cluster RPC);
// `label` is purely display-side.
export interface SyntenySource extends TreeSource {
  label?: string
}

const LaunchSyntenyViewDialog = lazy(
  () => import('../LGVSyntenyDisplay/components/LaunchSyntenyViewDialog.tsx'),
)
const GenomeSubsetSelector = lazy(
  () => import('./components/GenomeSubsetSelector.tsx'),
)
const ClusterIdentityDialog = lazy(
  () => import('./components/ClusterIdentityDialog.tsx'),
)
const SetColorsDialog = lazy(() => import('./components/SetColorsDialog.tsx'))

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
      TreeSidebarMixin<SyntenySource>(),
      types.model({
        type: types.literal('MultiLGVSyntenyDisplay'),
        configuration: ConfigurationReference(schema),
        colorBy: types.optional(types.string, 'strand'),
        selectedGenomes: types.optional(types.array(types.string), []),
        rowHeightMode: types.optional(types.number, 0),
        rowSpacing: types.optional(types.boolean, false),
        snpBpPerPxThreshold: types.optional(types.number, 100),
        showCoverage: types.optional(types.boolean, true),
        coverageHeight: types.optional(types.number, 45),
        resolution: types.optional(types.number, 1),
        showTree: types.optional(types.boolean, true),
      }),
    )
    .volatile(() => ({
      rpcDataMap: observable.map<number, SyntenyRegionData>(),
      allGenomeNames: [] as string[],
      contextMenuFeature: undefined as Feature | undefined,
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
      get baseGenomeNames() {
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
      // Layout-aware ordering: when the clustering layout has the same set of
      // names as the current selection, use it; otherwise fall back to the
      // base order. Filtering out genomes via setSelectedGenomes clears the
      // layout, so an inconsistent layout shouldn't normally be reached.
      // subtreeFilter (set by right-clicking a tree node) further narrows to
      // a subtree's leaves while preserving the layout order.
      get displayedGenomes() {
        const base = this.baseGenomeNames
        let ordered = base
        if (self.layout.length === base.length && base.length > 0) {
          const baseSet = new Set(base)
          const layoutNames = self.layout.map(s => s.name)
          if (layoutNames.every(n => baseSet.has(n))) {
            ordered = layoutNames
          }
        }
        if (self.subtreeFilter?.length) {
          const filterSet = new Set(self.subtreeFilter)
          return ordered.filter(n => filterSet.has(n))
        }
        return ordered
      },
      get genomeRows() {
        return mergeGenomeRows(self.rpcDataMap)
      },
      get syntenyCoverageHeight() {
        return self.showCoverage ? self.coverageHeight : 0
      },
      // Row-height model mirrors plugins/variants/.../MultiSampleVariantBaseModel.
      // rowHeightMode === 0 means fit-to-display; nonzero is a fixed pixel
      // height. Snap-to-auto on the precision boundary keeps proportional
      // resizes from leaving manual mode at exactly the auto value.
      get availableHeight() {
        return self.height - this.syntenyCoverageHeight
      },
      get autoRowHeight() {
        return this.availableHeight / Math.max(1, this.displayedGenomes.length)
      },
      get rowHeight() {
        if (self.rowHeightMode === 0) {
          return this.autoRowHeight
        }
        return Math.abs(self.rowHeightMode - this.autoRowHeight) < 0.01
          ? this.autoRowHeight
          : self.rowHeightMode
      },
      get showSnps() {
        if (self.snpBpPerPxThreshold <= 0) {
          return false
        }
        const view = getContainingView(self) as LGV
        return view.bpPerPx < self.snpBpPerPxThreshold
      },
      // Max depth across visible content blocks. MobX-cached.
      get coverageMaxDepth() {
        if (!self.showCoverage) {
          return 0
        }
        const view = getContainingView(self) as LGV
        if (!view.initialized) {
          return 0
        }
        return computeVisibleMaxDepth(view.dynamicBlocks.contentBlocks, b =>
          self.rpcDataMap.get(b.displayedRegionIndex!),
        )
      },
      get coverageTicks() {
        if (this.coverageMaxDepth === 0 || this.syntenyCoverageHeight === 0) {
          return undefined
        }
        return computeCoverageTicks(
          this.coverageMaxDepth,
          this.syntenyCoverageHeight,
        )
      },
      legendItems() {
        return legendItemsMap[self.colorBy] ?? []
      },

      // Settings sent to the worker via RPC. Adding a field here propagates
      // both into the RPC payload (via fetchNeeded) and into the
      // mixin-owned SettingsInvalidate autorun (which reads this method),
      // so refetch happens automatically when any field changes.
      rpcProps() {
        return {
          resolution: self.resolution,
        }
      },

      // Settings consumed during main-thread GPU buffer encoding
      // (buildSyntenyRegionMap), not sent to the worker. Counterpart to
      // rpcProps for things that affect the GPU side instead of the RPC
      // side. Defined as a method (not a getter) so subclasses can
      // override it via the standard `super` capture pattern. Mirrors
      // wiggle's gpuProps() pattern.
      gpuProps() {
        const view = getContainingView(self) as LGV
        return {
          displayedGenomes: this.displayedGenomes,
          colorBy: self.colorBy,
          showSnps: this.showSnps,
          showCoverage: self.showCoverage && view.initialized,
          coverageGlobalMax: getGlobalMaxDepth(self.rpcDataMap),
          viewWidth: Math.ceil(view.width),
        }
      },

      // Tree sidebar derived state — TreeSidebar/treeDrawingAutorun read
      // sources, hierarchy, totalHeight, and lineZoneHeight off the model.
      // Per-row layout overrides (color, label) merge in from self.layout when
      // present; rows without an entry get a bare {name}.
      get sources(): SyntenySource[] {
        const displayed = this.displayedGenomes
        if (self.layout.length === 0) {
          return displayed.map(name => ({ name }))
        }
        const byName = new Map(self.layout.map(s => [s.name, s]))
        return displayed.map(name => {
          const override = byName.get(name)
          return override ? { ...override } : { name }
        })
      },
      get totalHeight() {
        return this.rowHeight * this.displayedGenomes.length
      },
      // Coverage strip sits above the row area; the tree drawing starts below
      // it so the two don't overlap.
      get lineZoneHeight() {
        return this.syntenyCoverageHeight
      },
      get hierarchy() {
        const r = self.root
        if (!r || this.displayedGenomes.length === 0) {
          return undefined
        }
        return clusterLayout(r, this.totalHeight, self.treeAreaWidth)
      },

      // Tree sidebar is visually active when the user has clustering results
      // and a populated hierarchy; renderers consult this so the label strip
      // (and SVG export tree drawing) shifts right by treeAreaWidth.
      get treeSidebarActive() {
        return self.showTree && this.hierarchy !== undefined
      },
      get labelW() {
        return this.rowHeight >= 4 ? LABEL_WIDTH : 0
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
          canvasWidth: view.width,
          canvasHeight: self.height,
          rowHeight: this.rowHeight,
          rowSpacing: self.rowSpacing,
          coverageHeight: this.syntenyCoverageHeight,
          palette,
          displayedGenomes: this.displayedGenomes,
          labelW: this.labelW,
          labelXOffset: this.treeSidebarActive ? self.treeAreaWidth : 0,
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
        self.rowHeightMode = h
      },
      setFitToHeight() {
        self.rowHeightMode = 0
      },
      setRowSpacing(val: boolean) {
        self.rowSpacing = val
      },
      resizeHeight(distance: number) {
        const oldHeight = self.height
        const minHeight = self.syntenyCoverageHeight + 20
        const newHeight = Math.max(self.height + distance, minHeight)
        self.heightPreConfig = newHeight
        if (self.rowHeightMode > 0) {
          self.rowHeightMode = self.rowHeightMode * (newHeight / oldHeight)
        }
        return newHeight - oldHeight
      },
      setSnpBpPerPxThreshold(t: number) {
        self.snpBpPerPxThreshold = t
      },
      setShowCoverage(val: boolean) {
        self.showCoverage = val
      },
      setCoverageHeight(h: number) {
        self.coverageHeight = h
      },
      setSelectedGenomes(genomes: string[]) {
        self.selectedGenomes.replace(genomes)
        // Layout/tree/subtree filter are tied to the previous selection set —
        // once the selection changes, the existing ordering and any tree-node
        // subtree filter are no longer meaningful.
        self.clearLayout()
        self.setSubtreeFilter(undefined)
      },
      setShowTree(val: boolean) {
        self.showTree = val
      },
      setLayoutAndClusterTree(layout: SyntenySource[], tree?: string) {
        self.layout = layout
        self.clusterTree = tree
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
            const palette = self.colorPalette
            if (!palette) {
              return
            }
            b.sync({
              rpcDataMap: self.rpcDataMap,
              gpuProps: self.gpuProps(),
              palette,
            })
          },
          render: b => {
            const state = self.syntenyRenderState
            if (!state) {
              return false
            }
            return b.renderBlocks(self.renderBlocks, state)
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
      return {
        fetchNeeded(
          needed: { region: Region; displayedRegionIndex: number }[],
        ) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          self.fetchRegions(needed, async (ctx: FetchContext) => {
            const adapterConfig = self.adapterConfig
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
                ...self.rpcProps(),
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

        async renderSvg(
          opts: ExportSvgDisplayOptions,
        ): Promise<React.ReactNode> {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self as MultiLGVSyntenyDisplayModel, opts)
        },
      }
    })
    .views(self => ({
      get visibleLabels() {
        return computeMultiSyntenyLabels({
          view: getContainingView(self) as LGV,
          genomeRows: self.genomeRows,
          displayedGenomes: self.displayedGenomes,
          rowHeight: self.rowHeight,
          rowSpacing: self.rowSpacing,
          showSnps: self.showSnps,
        })
      },
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
          getColorByMenuItem(self),
          getRowHeightMenuItem(self),
          getSnpThresholdMenuItem(self),
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
          {
            label: 'Cluster genomes by identity...',
            icon: CategoryIcon,
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                ClusterIdentityDialog,
                {
                  model: self,
                  handleClose,
                },
              ])
            },
          },
          {
            label: `Show tree${!self.clusterTree ? ' (run clustering first)' : ''}`,
            type: 'checkbox' as const,
            checked: self.showTree,
            disabled: !self.clusterTree,
            onClick: () => {
              self.setShowTree(!self.showTree)
            },
          },
          {
            label: 'Edit colors/arrangement...',
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                SetColorsDialog,
                {
                  model: self,
                  handleClose,
                },
              ])
            },
          },
          ...getLaunchSubMenu(self),
        ]
      },
    }))
    .actions(self => ({
      afterAttach() {
        setupTreeDrawingAutorun(self)
      },
    }))
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const {
        layout,
        clusterTree,
        treeAreaWidth,
        subtreeFilter,
        showTree,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(layout.length ? { layout } : {}),
        ...(clusterTree !== undefined ? { clusterTree } : {}),
        ...(treeAreaWidth !== 80 ? { treeAreaWidth } : {}),
        ...(subtreeFilter?.length ? { subtreeFilter } : {}),
        ...(showTree ? {} : { showTree }),
      } as typeof snap
    })
}

export type MultiLGVSyntenyDisplayModel = ReturnType<
  typeof stateModelFactory
>['Type']

export default stateModelFactory
