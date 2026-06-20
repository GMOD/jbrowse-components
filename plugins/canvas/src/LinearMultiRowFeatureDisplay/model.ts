import type React from 'react'

import {
  ConfigurationReference,
  getConfSnapshot,
  readConfObject,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getContainingView } from '@jbrowse/core/util'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import { installPerRegionLifecycle } from '@jbrowse/render-core/installPerRegionLifecycle'
import {
  TreeSidebarMixin,
  buildSpatialIndex,
  clusterLayout,
} from '@jbrowse/tree-sidebar'
import { observable } from 'mobx'

import { fetchMultiRowFeatures } from './fetchMultiRowFeatures.ts'
import { buildMultiRowInstanceBuffer } from './rendering/multiRowInstanceBuffer.ts'
import { buildEditableSources, buildSources } from './sourcesLogic.ts'
import { buildMultiRowTrackMenuItems } from './trackMenuItems.ts'

import type { LinearMultiRowFeatureDisplayConfig } from './configSchema.ts'
import type {
  MultiRowRegionData,
  MultiRowRenderState,
  MultiRowRenderingBackend,
} from './rendering/multiRowRenderingBackendTypes.ts'
import type { MultiRowSource } from './sourcesLogic.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

export interface MultiRowHit {
  row: string
  name: string
  refName: string
  start: number
  end: number
}

export interface HoveredFeature extends MultiRowHit {
  clientX: number
  clientY: number
}

const DEFAULTS = {
  showTree: true,
  showBranchLength: false,
} as const

/**
 * #stateModel LinearMultiRowFeatureDisplay
 * Multi-row interval painter (chromosome / ancestry painting). Partitions a
 * single feature track into stacked rows by a feature attribute and paints each
 * feature as a colored block on its row. GPU-rendered (WebGL/Canvas2D
 * fallback) via the shared per-region lifecycle. Rows are a `sources` chain
 * (discovered → layout-reconciled → subtree-filtered) and the left sidebar
 * (labels + dendrogram + reorder) is the shared `TreeSidebarMixin`.
 */
export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearMultiRowFeatureDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      TreeSidebarMixin<MultiRowSource>(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearMultiRowFeatureDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         * Per-display override of the config `rowHeight`. The bare `rowHeight`
         * getter resolves override-or-config so it's never undefined.
         */
        rowHeightOverride: types.maybe(types.number),
        /**
         * #property
         */
        showTree: types.stripDefault(types.boolean, DEFAULTS.showTree),
        /**
         * #property
         * Position tree nodes by cluster merge height (dendrogram) vs. evenly by
         * topology (cladogram).
         */
        showBranchLength: types.stripDefault(
          types.boolean,
          DEFAULTS.showBranchLength,
        ),
      }),
    )
    .volatile(() => ({
      rpcDataMap: observable.map<number, MultiRowRegionData>(),
      prefersOffset: true,
      /**
       * #volatile
       * The feature under the mouse (+ client coords for tooltip placement), or
       * undefined when not hovering a block.
       */
      hoveredFeature: undefined as HoveredFeature | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       * config typed off the concrete schema (ConfigurationReference erases it
       * to any); direct reads route through here to stay typed
       */
      get conf(): LinearMultiRowFeatureDisplayConfig {
        return self.configuration
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get partitionField(): string {
        return readConfObject(self.conf, 'partitionField')
      },
      /**
       * #getter
       * Raw `color` slot (a CSS color or `jexl:` string), forwarded to the
       * worker which resolves it per feature.
       */
      get colorConfig(): string {
        return getConfSnapshot(self.configuration).color as string
      },
      /**
       * #getter
       */
      get rowProportion(): number {
        return readConfObject(self.conf, 'rowProportion')
      },
      /**
       * #getter
       */
      get rowHeight(): number {
        return self.rowHeightOverride ?? readConfObject(self.conf, 'rowHeight')
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Rows discovered in the loaded data: the distinct partition values across
       * all loaded regions, sorted. The pre-layout, pre-filter input to the
       * arrangement dialog and to clustering.
       */
      get sourcesWithoutLayout(): MultiRowSource[] {
        const values = new Set<string>()
        for (const data of self.rpcDataMap.values()) {
          for (const v of data.partitionValues) {
            values.add(v)
          }
        }
        return [...values].sort().map(name => ({ name }))
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Discovered rows with the user's arrangement (reorder/relabel) applied —
       * what the arrangement dialog edits. Not subtree-filtered.
       */
      get editableSources(): MultiRowSource[] {
        return buildEditableSources(self.sourcesWithoutLayout, self.layout)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The display rows: `editableSources` narrowed by the active subtree
       * filter. Render order, label order, and `rowIndexByValue` all key off
       * this, so reordering/filtering flows through to the painting.
       */
      get sources(): MultiRowSource[] {
        return buildSources(self.editableSources, self.subtreeFilter)
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get rowIndexByValue(): Map<string, number> {
        return new Map(self.sources.map((s, i) => [s.name, i] as const))
      },
      /**
       * #getter
       * Override BaseLinearDisplay.height so the track container matches the
       * rendering canvas (numRows × rowHeight). At least one row tall so the
       * canvas mounts (and the loading overlay shows) before data arrives.
       */
      get height(): number {
        return Math.max(1, self.sources.length) * self.rowHeight
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Positioned dendrogram (when a cluster tree exists and rows are loaded).
       * Leaves spaced over `height`, branches over `treeAreaWidth`.
       */
      get hierarchy() {
        const r = self.root
        return r && self.sources.length
          ? clusterLayout(
              r,
              self.height,
              self.treeAreaWidth,
              self.showBranchLength,
            )
          : undefined
      },
      /**
       * #getter
       * Pixel width reserved on the left for the tree (0 when no tree shows).
       */
      get sidebarOffset(): number {
        return self.showTree && self.clusterTree ? self.treeAreaWidth : 0
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get spatialIndex() {
        return self.hierarchy ? buildSpatialIndex(self.hierarchy) : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Render state passed to the GPU/Canvas2D backend each frame.
       */
      get renderState(): MultiRowRenderState | undefined {
        const view = getContainingView(self) as LinearGenomeViewModel
        if (!view.initialized) {
          return undefined
        }
        return {
          canvasWidth: view.width,
          canvasHeight: self.height,
          rowHeight: self.rowHeight,
          rowProportion: self.rowProportion,
          rowIndexByValue: self.rowIndexByValue,
        }
      },
      /**
       * #method
       * Fetch-input cache keys (tier-1, via SettingsInvalidate → refetch).
       * Color is resolved in the worker, so the raw color slot is a key.
       */
      rpcProps() {
        return {
          partitionField: self.partitionField,
          colorConfig: self.colorConfig,
        }
      },
      /**
       * #method
       * Hit-test the feature under a canvas-relative pixel: row from
       * `mouseY / rowHeight`, genomic bp from the view, then the first feature on
       * that row whose `[start,end)` covers the bp. Returns undefined over the
       * sidebar, off-row, out-of-bounds, or over a gap.
       */
      featureAt(mouseX: number, mouseY: number): MultiRowHit | undefined {
        if (mouseX < self.sidebarOffset) {
          return undefined
        }
        const source = self.sources[Math.floor(mouseY / self.rowHeight)]
        if (!source) {
          return undefined
        }
        const view = getContainingView(self) as LinearGenomeViewModel
        const p = view.pxToBp(mouseX)
        if (p.oob) {
          return undefined
        }
        const region = self.rpcDataMap.get(p.index)
        if (!region) {
          return undefined
        }
        const bp = p.coord - 1
        const {
          featureStarts,
          featureEnds,
          partitionValues,
          featurePartitionIndex,
          featureNames,
        } = region
        for (let i = 0; i < featureStarts.length; i++) {
          if (
            partitionValues[featurePartitionIndex[i]!] === source.name &&
            featureStarts[i]! <= bp &&
            bp < featureEnds[i]!
          ) {
            return {
              row: source.label ?? source.name,
              name: featureNames[i]!,
              refName: p.refName,
              start: featureStarts[i]!,
              end: featureEnds[i]!,
            }
          }
        }
        return undefined
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setRowHeight(n: number) {
        self.rowHeightOverride = n
      },
      /**
       * #action
       */
      setShowTree(f: boolean) {
        self.showTree = f
      },
      /**
       * #action
       */
      setShowBranchLength(f: boolean) {
        self.showBranchLength = f
      },
      /**
       * #action
       */
      setHoveredFeature(arg?: HoveredFeature) {
        self.hoveredFeature = arg
      },
      /**
       * #action
       */
      setRpcData(regionIndex: number, data: MultiRowRegionData) {
        self.rpcDataMap.set(regionIndex, data)
      },
      /**
       * #action
       */
      clearDisplaySpecificData() {
        self.rpcDataMap.clear()
      },
      /**
       * #action
       * Distribute a target height across the current rows.
       */
      setHeight(newHeight: number) {
        const n = self.sources.length
        if (n > 0) {
          self.rowHeightOverride = Math.max(1, Math.floor(newHeight / n))
        }
      },
      /**
       * #action
       */
      startRenderingBackend(backend: MultiRowRenderingBackend) {
        installPerRegionLifecycle(
          self,
          self.rpcDataMap,
          backend,
          regionData => {
            const { buffer, count } = buildMultiRowInstanceBuffer(
              regionData,
              self.rowIndexByValue,
            )
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
      /**
       * #action
       */
      fetchNeeded(needed: { region: Region; displayedRegionIndex: number }[]) {
        return fetchMultiRowFeatures(self, needed)
      },
      /**
       * #action
       */
      async renderSvg(opts: ExportSvgDisplayOptions): Promise<React.ReactNode> {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self as LinearMultiRowFeatureDisplayModel, opts)
      },
    }))
    .actions(self => {
      const superAfterAttach = self.afterAttach
      return {
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
    .views(self => {
      const { trackMenuItems: superTrackMenuItems } = self
      return {
        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            ...buildMultiRowTrackMenuItems(self),
          ]
        },
      }
    })
}

export type LinearMultiRowFeatureDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearMultiRowFeatureDisplayModel =
  Instance<LinearMultiRowFeatureDisplayStateModel>
