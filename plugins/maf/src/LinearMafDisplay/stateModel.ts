import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { installPerRegionGpuLifecycle } from '@jbrowse/core/gpu/installPerRegionGpuLifecycle'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  getContainingTrack,
  getContainingView,
  getEnv,
  getSession,
  max,
  measureText,
} from '@jbrowse/core/util'
import { cast, types } from '@jbrowse/mobx-state-tree'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import { clusterTree, leaves } from '@jbrowse/tree-sidebar'
import deepEqual from 'fast-deep-equal'
import { observable } from 'mobx'

import { computeVisibleLabels } from './components/computeVisibleLabels.ts'
import { fetchMafAlignmentData } from './fetchMafAlignmentData.ts'
import { buildMafTrackMenuItems } from './trackMenuItems.ts'
import {
  computeNodeDescendantNames,
  getMsaHighlights,
  layoutMafTree,
} from './util.ts'
import { buildInstanceBuffer } from '../LinearMafRenderer/mafInstanceBuffer.ts'

import type { HierarchyNode, MafTreeNode, Sample } from './types.ts'
import type { HoveredInfo } from './util.ts'
import type {
  MafBackend,
  MafGPURenderState,
  MafGpuProps,
  MafRegionData,
} from '../LinearMafRenderer/mafBackendTypes.ts'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import type { Region, SessionWithWidgets } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

const defaultRowHeight = 15
const defaultRowProportion = 0.8
const defaultShowAllLetters = false
const defaultMismatchRendering = true
const defaultShowBranchLen = false
const defaultTreeAreaWidth = 80
const defaultShowAsUpperCase = true
const defaultShowSidebar = true

/**
 * #stateModel LinearMafDisplay
 * extends BaseDisplay + TrackHeightMixin + MultiRegionDisplayMixin
 */
export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearMafDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearMafDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         */
        rowHeight: defaultRowHeight,
        /**
         * #property
         */
        rowProportion: defaultRowProportion,
        /**
         * #property
         */
        showAllLetters: defaultShowAllLetters,
        /**
         * #property
         */
        mismatchRendering: defaultMismatchRendering,

        /**
         * #property
         */
        showBranchLen: defaultShowBranchLen,

        /**
         * #property
         */
        treeAreaWidth: defaultTreeAreaWidth,
        /**
         * #property
         */
        showAsUpperCase: defaultShowAsUpperCase,
        /**
         * #property
         */
        showSidebar: defaultShowSidebar,
        /**
         * #property
         */
        subtreeFilter: types.maybe(types.array(types.string)),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      rpcDataMap: observable.map<number, MafRegionData>(),
      /**
       * #volatile
       */
      hoveredInfo: undefined as HoveredInfo | undefined,
      /**
       * #volatile
       */
      prefersOffset: true,
      /**
       * #volatile
       */
      volatileSamples: undefined as Sample[] | undefined,
      /**
       * #volatile
       */
      volatileTree: undefined as MafTreeNode | undefined,
      /**
       * #volatile
       */
      highlightedRowNames: undefined as string[] | undefined,
      /**
       * #volatile
       */
      hoveredTreeNode: undefined as { x: number; y: number } | undefined,
      /**
       * #volatile
       */
      treeMenuAnchor: undefined as
        | { x: number; y: number; names: string[] }
        | undefined,
      /**
       * #volatile
       * Theme-derived per-base color map (lowercase keys: a/c/g/t/n).
       * Pushed in from the React component via `setColorForBase`. Read by
       * `gpuProps()` and `mafRenderState`, so theme changes trigger a
       * main-thread re-encode but never an RPC refetch. Mirrors the
       * `ColorPalette` pattern in plugin-alignments.
       */
      colorForBase: undefined as Record<string, string> | undefined,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setHoveredInfo(arg?: HoveredInfo) {
        self.hoveredInfo = arg
      },
      /**
       * #action
       */
      setRowHeight(n: number) {
        self.rowHeight = n
      },
      /**
       * #action
       */
      setRowProportion(n: number) {
        self.rowProportion = n
      },
      /**
       * #action
       */
      setShowAllLetters(f: boolean) {
        self.showAllLetters = f
      },
      /**
       * #action
       */
      setMismatchRendering(f: boolean) {
        self.mismatchRendering = f
      },
      /**
       * #action
       * Push theme-derived base colors in from the React layer. Idempotent
       * via deepEqual so calling it on every render is fine.
       */
      setColorForBase(c: Record<string, string>) {
        if (!deepEqual(c, self.colorForBase)) {
          self.colorForBase = c
        }
      },
      /**
       * #action
       */
      setSamples({
        samples,
        tree,
      }: {
        samples: Sample[]
        tree: MafTreeNode | undefined
      }) {
        if (!deepEqual(samples, self.volatileSamples)) {
          self.volatileSamples = samples
        }
        if (!deepEqual(tree, self.volatileTree)) {
          self.volatileTree = tree
        }
      },
      /**
       * #action
       */
      setShowAsUpperCase(arg: boolean) {
        self.showAsUpperCase = arg
      },
      /**
       * #action
       */
      setTreeAreaWidth(width: number) {
        self.treeAreaWidth = width
      },
      /**
       * #action
       */
      setShowSidebar(arg: boolean) {
        self.showSidebar = arg
      },
      /**
       * #action
       */
      setHighlightedRowNames(
        names?: string[],
        nodePosition?: { x: number; y: number },
      ) {
        self.highlightedRowNames = names
        self.hoveredTreeNode = nodePosition
      },
      /**
       * #action
       */
      setSubtreeFilter(names?: string[]) {
        self.subtreeFilter = cast(names)
      },
      /**
       * #action
       */
      setTreeMenuAnchor(anchor?: { x: number; y: number; names: string[] }) {
        self.treeMenuAnchor = anchor
      },
      /**
       * #action
       */
      showInsertionSequenceDialog(insertionData: {
        sequence: string
        sampleLabel: string
        chr: string
        pos: number
      }) {
        const { sequence, sampleLabel, chr, pos } = insertionData
        const session = getSession(self) as SessionWithWidgets
        const featureWidget = session.addWidget(
          'BaseFeatureWidget',
          'baseFeature',
          {
            featureData: {
              uniqueId: `insertion-${chr}-${pos}-${sampleLabel}`,
              type: 'insertion',
              refName: chr,
              start: pos,
              end: pos + 1,
              sample: sampleLabel,
              insertionLength: sequence.length,
              sequence: self.showAsUpperCase
                ? sequence.toUpperCase()
                : sequence.toLowerCase(),
            },
            view: getContainingView(self),
            track: getContainingTrack(self),
          },
        )

        session.showWidget(featureWidget)
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get rendererTypeName() {
        return 'LinearMafRenderer'
      },

      /**
       * #getter
       */
      get rendererConfig(): AnyConfigurationModel {
        const configBlob = getConf(self, ['renderer']) || {}
        const config = configBlob as Omit<typeof configBlob, symbol>
        const { rendererType } = self
        if (!rendererType) {
          throw new Error('LinearMafRenderer renderer type not found')
        }
        return rendererType.configSchema.create(
          {
            ...config,
            type: 'LinearMafRenderer',
          },
          getEnv(self),
        )
      },
    }))

    .views(self => ({
      /**
       * #getter
       */
      get root() {
        return self.volatileTree
          ? clusterTree(self.volatileTree, self.subtreeFilter)
          : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * generates a new tree that is clustered with x,y positions
       */
      get hierarchy(): HierarchyNode | undefined {
        const r = self.root
        if (!r) {
          return undefined
        }
        layoutMafTree(r, self.treeAreaWidth, self.rowHeight)
        return r
      },
      /**
       * #getter
       */
      get samples() {
        let samples: Sample[] | undefined
        if (this.rowNames) {
          const volatileSamplesMap = self.volatileSamples
            ? Object.fromEntries(self.volatileSamples.map(e => [e.id, e]))
            : undefined
          samples = this.rowNames.map(id => ({
            id,
            label: volatileSamplesMap?.[id]?.label ?? id,
            color: volatileSamplesMap?.[id]?.color,
          }))
        } else {
          samples = self.volatileSamples
        }

        if (samples && self.subtreeFilter) {
          const filterSet = new Set(self.subtreeFilter)
          return samples.filter(s => filterSet.has(s.id))
        }
        return samples
      },

      /**
       * #getter
       */
      get totalHeight() {
        return this.samples ? this.samples.length * self.rowHeight : 1
      },
      /**
       * #getter
       * Override BaseLinearDisplay.height so the track container matches the
       * rendering canvas height exactly (samples × rowHeight).
       */
      get height() {
        return this.totalHeight
      },
      /**
       * #getter
       */
      get leaves() {
        return self.root ? leaves(self.root) : undefined
      },
      /**
       * #getter
       */
      get leafMap() {
        return new Map(this.leaves?.map(leaf => [leaf.data.name, leaf]))
      },
      /**
       * #getter
       * Precomputed map from hierarchy node to its descendant leaf names
       */
      get nodeDescendantNames() {
        if (this.hierarchy) {
          return computeNodeDescendantNames(this.hierarchy)
        }
        return new Map<HierarchyNode, string[]>()
      },
      /**
       * #getter
       */
      get rowNames(): string[] | undefined {
        // MAF tree leaves are samples — name is always present at runtime
        return this.leaves?.map(n => n.data.name!)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Render state passed to GPU/Canvas2D backend each frame.
       */
      get mafRenderState(): MafGPURenderState | undefined {
        const view = getContainingView(self) as LinearGenomeViewModel
        if (!view.initialized || !self.samples || !self.colorForBase) {
          return undefined
        }
        return {
          canvasWidth: view.width,
          canvasHeight: self.totalHeight,
          rowHeight: self.rowHeight,
          rowProportion: self.rowProportion,
          showAllLetters: self.showAllLetters,
          mismatchRendering: self.mismatchRendering,
          colorForBase: self.colorForBase,
        }
      },
      /**
       * #method
       * Inputs to the main-thread GPU instance encoder. Changes here
       * re-encode in the per-region encode autorun — no RPC
       * roundtrip. Intentionally excludes `showAsUpperCase` (label-only)
       * and view-shape props (rowHeight, rowProportion — driven by shader
       * uniforms).
       */
      gpuProps(): MafGpuProps | undefined {
        if (!self.colorForBase) {
          return undefined
        }
        return {
          colorForBase: self.colorForBase,
          showAllLetters: self.showAllLetters,
          mismatchRendering: self.mismatchRendering,
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get visibleLabels() {
        const view = getContainingView(self) as LinearGenomeViewModel
        if (!view.initialized || !self.samples) {
          return []
        }
        return computeVisibleLabels({
          view,
          rpcDataMap: self.rpcDataMap,
          rowHeight: self.rowHeight,
          rowProportion: self.rowProportion,
          showAllLetters: self.showAllLetters,
          showAsUpperCase: self.showAsUpperCase,
        })
      },
    }))
    .views(self => {
      const { trackMenuItems: superTrackMenuItems } = self
      return {
        /**
         * #getter
         */
        get treeWidth() {
          return self.hierarchy ? self.treeAreaWidth : 0
        },
        /**
         * #method
         */
        trackMenuItems() {
          return [...superTrackMenuItems(), ...buildMafTrackMenuItems(self)]
        },
      }
    })
    .views(self => ({
      /**
       * #getter
       * Get highlight regions from connected MSA views
       */
      get msaHighlights() {
        return getMsaHighlights(
          getSession(self).views,
          getContainingView(self).id,
        )
      },
      /**
       * #getter
       */
      get svgFontSize() {
        return Math.min(Math.max(self.rowHeight, 8), 14)
      },
      /**
       * #getter
       */
      get canDisplayLabel() {
        return self.rowHeight >= 7
      },
      /**
       * #getter
       */
      get labelWidth() {
        const minWidth = 20
        return max(
          self.samples
            ?.map(s => measureText(s.label, this.svgFontSize))
            .map(width => (this.canDisplayLabel ? width : minWidth)) ?? [],
          0,
        )
      },
      /**
       * #getter
       */
      get sidebarWidth() {
        return self.showSidebar ? this.labelWidth + 5 + self.treeWidth : 0
      },
    }))
    .actions(self => ({
      setRpcData(regionIndex: number, data: MafRegionData) {
        self.rpcDataMap.set(regionIndex, data)
      },
      clearDisplaySpecificData() {
        self.rpcDataMap.clear()
      },
      reload() {
        self.clearAllRpcData()
      },
      // Override base setHeight: distribute the new total height across rows so
      // the resize handle and programmatic setHeight both work.
      setHeight(newHeight: number) {
        const sampleCount = self.samples?.length
        if (sampleCount) {
          self.rowHeight = Math.max(1, Math.floor(newHeight / sampleCount))
        }
      },
      startGpuBackendLifecycle(backend: MafBackend) {
        // Per-region streamed upload. The encode callback builds the GPU
        // instance buffer on the main thread from raw region data + gpuProps,
        // so theme / showAllLetters / mismatchRendering changes re-encode
        // without an RPC roundtrip. Returning undefined while gpuProps isn't
        // ready (theme not yet pushed in by the React bridge) holds the
        // upload until it is — see installPerRegionGpuLifecycle.
        installPerRegionGpuLifecycle(
          self,
          self.rpcDataMap,
          backend,
          regionData => {
            const props = self.gpuProps()
            if (!props) {
              return undefined
            }
            const { buffer, count } = buildInstanceBuffer({
              blocks: regionData.blocks,
              ...props,
            })
            return {
              instanceBuffer: buffer,
              instanceCount: count,
              regionData,
            }
          },
          b => {
            const state = self.mafRenderState
            if (!state) {
              return false
            }
            b.renderBlocks(self.renderBlocks, state)
            return true
          },
        )
      },
    }))
    .actions(self => ({
      fetchNeeded(needed: { region: Region; displayedRegionIndex: number }[]) {
        return fetchMafAlignmentData(self, needed)
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      async renderSvg(opts: ExportSvgDisplayOptions) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self as LinearMafDisplayModel, opts)
      },
    }))
    .postProcessSnapshot(snap => {
      const {
        rowHeight,
        rowProportion,
        showAllLetters,
        mismatchRendering,
        showBranchLen,
        treeAreaWidth,
        showAsUpperCase,
        showSidebar,
        subtreeFilter,
        ...rest
      } = snap as typeof snap & {
        rowHeight?: number
        rowProportion?: number
        showAllLetters?: boolean
        mismatchRendering?: boolean
        showBranchLen?: boolean
        treeAreaWidth?: number
        showAsUpperCase?: boolean
        showSidebar?: boolean
        subtreeFilter?: string[]
      }
      return {
        ...(rest as Omit<typeof rest, symbol>),
        ...(rowHeight !== defaultRowHeight ? { rowHeight } : {}),
        ...(rowProportion !== defaultRowProportion ? { rowProportion } : {}),
        ...(showAllLetters !== defaultShowAllLetters ? { showAllLetters } : {}),
        ...(mismatchRendering !== defaultMismatchRendering
          ? { mismatchRendering }
          : {}),
        ...(showBranchLen !== defaultShowBranchLen ? { showBranchLen } : {}),
        ...(treeAreaWidth !== defaultTreeAreaWidth ? { treeAreaWidth } : {}),
        ...(showAsUpperCase !== defaultShowAsUpperCase
          ? { showAsUpperCase }
          : {}),
        ...(showSidebar !== defaultShowSidebar ? { showSidebar } : {}),
        ...(subtreeFilter && subtreeFilter.length > 0 ? { subtreeFilter } : {}),
      }
    })
}

export type LinearMafDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearMafDisplayModel = Instance<LinearMafDisplayStateModel>
