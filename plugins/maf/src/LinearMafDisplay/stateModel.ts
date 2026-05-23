import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { installPerRegionLifecycle } from '@jbrowse/core/gpu/installPerRegionLifecycle'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  getContainingView,
  getEnv,
  getSession,
  openFeatureWidget,
} from '@jbrowse/core/util'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import { TreeSidebarMixin, clusterLayout } from '@jbrowse/tree-sidebar'
import { observable } from 'mobx'

import { computeVisibleLabels } from './components/computeVisibleLabels.ts'
import { fetchMafAlignmentData } from './fetchMafAlignmentData.ts'
import { buildMafTrackMenuItems } from './trackMenuItems.ts'
import { getMsaHighlights } from './util.ts'
import { buildInstanceBuffer } from '../LinearMafRenderer/mafInstanceBuffer.ts'

import type { HoveredInfo } from './util.ts'
import type {
  MafBackend,
  MafGPURenderState,
  MafGpuProps,
  MafRegionData,
} from '../LinearMafRenderer/mafBackendTypes.ts'
import type { MafColorPalette } from '../LinearMafRenderer/util.ts'
import type { Sample } from '../types.ts'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

/**
 * Per-row metadata stored in `sourcesVolatile` and reordered through the
 * TreeSidebarMixin `layout`. `name` is the sample id (matches the canonical
 * `Sample.id`); `label`/`color` are display-only.
 */
export interface MafSource {
  name: string
  label?: string
  color?: string
}

const DEFAULTS = {
  rowHeight: 15,
  rowProportion: 0.8,
  showAllLetters: false,
  mismatchRendering: true,
  showAsUpperCase: true,
  showTree: true,
} as const

/**
 * #stateModel LinearMafDisplay
 * extends BaseDisplay + TrackHeightMixin + MultiRegionDisplayMixin + TreeSidebarMixin
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
      TreeSidebarMixin<MafSource>(),
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
        rowHeight: DEFAULTS.rowHeight,
        /**
         * #property
         */
        rowProportion: DEFAULTS.rowProportion,
        /**
         * #property
         */
        showAllLetters: DEFAULTS.showAllLetters,
        /**
         * #property
         */
        mismatchRendering: DEFAULTS.mismatchRendering,
        /**
         * #property
         */
        showAsUpperCase: DEFAULTS.showAsUpperCase,
        /**
         * #property
         */
        showTree: DEFAULTS.showTree,
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
       * Canonical row metadata received from the worker. Reordering /
       * recoloring lives in TreeSidebarMixin's `layout`; this volatile
       * holds the unfiltered authoritative set so the merged `sources` view
       * can fall back when `layout` is empty.
       */
      sourcesVolatile: [] as MafSource[],
      /**
       * #volatile
       * Theme-derived color palette (per-base colors + match/gap/mismatch/
       * unknown/insertion). Pushed in from the React component via
       * `setColorPalette`. Read by `gpuProps()` and `renderState`, so theme
       * changes trigger a main-thread re-encode but never an RPC refetch.
       * Mirrors the `ColorPalette` pattern in plugin-alignments.
       */
      colorPalette: undefined as MafColorPalette | undefined,
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
       * Push the theme-derived color palette in from the React layer.
       * Callers useMemo by theme so the reference is stable across renders.
       */
      setColorPalette(p: MafColorPalette) {
        self.colorPalette = p
      },
      /**
       * #action
       * Receive worker-authoritative `samples` + serialized Newick tree.
       * Goes through TreeSidebarMixin's `setLayoutAndClusterTree` so the
       * mixin's `root` getter re-parses on change; `sourcesVolatile` carries
       * the full pre-filter set used as the fallback in the merged `sources`
       * view.
       */
      setSamples({
        samples,
        treeNewick,
      }: {
        samples: Sample[]
        treeNewick: string | undefined
      }) {
        const next = samples.map(s => ({
          name: s.id,
          label: s.label,
          color: s.color,
        }))
        self.sourcesVolatile = next
        self.setLayoutAndClusterTree(next, treeNewick)
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
      setShowTree(arg: boolean) {
        self.showTree = arg
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
        openFeatureWidget(self, {
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
        })
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
        const config = getConf(self, ['renderer']) ?? {}
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
       * Merged row set: prefer the persisted `layout` when present (carries
       * any user reordering / recoloring) and fall back to the worker's
       * `sourcesVolatile`. Subtree filter narrows in both cases.
       */
      get sources(): MafSource[] | undefined {
        const base = self.layout.length ? self.layout : self.sourcesVolatile
        if (base.length === 0) {
          return undefined
        }
        if (self.subtreeFilter?.length) {
          const filterSet = new Set(self.subtreeFilter)
          return base.filter(s => filterSet.has(s.name))
        }
        return [...base]
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Sample list keyed by sample id (alias of `sources` mapped to the
       * project's canonical `{ id, label, color }` shape). Consumed by
       * MafSequenceWidget, color legend, etc.
       */
      get samples(): Sample[] | undefined {
        return self.sources?.map(s => ({
          id: s.name,
          label: s.label ?? s.name,
          color: s.color,
        }))
      },
      /**
       * #getter
       */
      get totalHeight() {
        return self.sources ? self.sources.length * self.rowHeight : 1
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Override BaseLinearDisplay.height so the track container matches the
       * rendering canvas height exactly (samples × rowHeight).
       */
      get height() {
        return self.totalHeight
      },
      /**
       * #getter
       * Positioned tree hierarchy. Coordinates are computed against
       * `(totalHeight, treeAreaWidth)` so leaf rows align with row tops.
       */
      get hierarchy() {
        const r = self.root
        if (!r || !self.sources?.length) {
          return undefined
        }
        return clusterLayout(r, self.totalHeight, self.treeAreaWidth)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Render state passed to GPU/Canvas2D backend each frame.
       */
      get renderState(): MafGPURenderState | undefined {
        const view = getContainingView(self) as LinearGenomeViewModel
        if (!view.initialized || !self.sources || !self.colorPalette) {
          return undefined
        }
        return {
          canvasWidth: view.width,
          canvasHeight: self.totalHeight,
          rowHeight: self.rowHeight,
          rowProportion: self.rowProportion,
          showAllLetters: self.showAllLetters,
          mismatchRendering: self.mismatchRendering,
          palette: self.colorPalette,
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
        if (!self.colorPalette) {
          return undefined
        }
        return {
          palette: self.colorPalette,
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
        if (!view.initialized || !self.sources) {
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
        const sampleCount = self.sources?.length
        if (sampleCount) {
          self.rowHeight = Math.max(1, Math.floor(newHeight / sampleCount))
        }
      },
      startBackend(backend: MafBackend) {
        // Per-region streamed upload. The encode callback builds the GPU
        // instance buffer on the main thread from raw region data + gpuProps,
        // so theme / showAllLetters / mismatchRendering changes re-encode
        // without an RPC roundtrip. Returning undefined while gpuProps isn't
        // ready (theme not yet pushed in by the React bridge) holds the
        // upload until it is — see installPerRegionLifecycle.
        installPerRegionLifecycle(
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
            return { instanceBuffer: buffer, instanceCount: count }
          },
          b => {
            const state = self.renderState
            if (!state) {
              return false
            }
            b.renderBlocks(self.renderBlocks, self.rpcDataMap, state)
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
    .actions(self => {
      const superAfterAttach = self.afterAttach
      return {
        /**
         * #action
         */
        async renderSvg(opts: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self as LinearMafDisplayModel, opts)
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
    .postProcessSnapshot(snap => {
      // layout/clusterTree intentionally dropped — both are rebuilt from
      // worker output on every fetch. The remaining defaults are stripped to
      // keep saved sessions small.
      const {
        rowHeight,
        rowProportion,
        showAllLetters,
        mismatchRendering,
        treeAreaWidth,
        showAsUpperCase,
        showTree,
        subtreeFilter,
        layout: _layout,
        clusterTree: _clusterTree,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(rowHeight !== DEFAULTS.rowHeight && { rowHeight }),
        ...(rowProportion !== DEFAULTS.rowProportion && { rowProportion }),
        ...(showAllLetters !== DEFAULTS.showAllLetters && { showAllLetters }),
        ...(mismatchRendering !== DEFAULTS.mismatchRendering && {
          mismatchRendering,
        }),
        ...(treeAreaWidth !== 80 && { treeAreaWidth }),
        ...(showAsUpperCase !== DEFAULTS.showAsUpperCase && {
          showAsUpperCase,
        }),
        ...(showTree !== DEFAULTS.showTree && { showTree }),
        ...(subtreeFilter?.length && { subtreeFilter }),
      }
    })
}

export type LinearMafDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearMafDisplayModel = Instance<LinearMafDisplayStateModel>
