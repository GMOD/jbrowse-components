import type React from 'react'

import {
  ConfigurationReference,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  getContainingView,
  getSession,
  openFeatureWidget,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  MIN_DISPLAY_HEIGHT,
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
import { fetchCanvasFeatureDetails } from '../LinearBasicDisplay/baseModelHelpers.ts'
import { MULTIROW_DEFAULT_COLOR } from '../MultiRowGetFeaturesRPC/multiRowColors.ts'
import { buildMultiRowInstanceBuffer } from './rendering/multiRowInstanceBuffer.ts'
import { resolveLocalRowIndices } from './rendering/resolveLocalRowIndices.ts'
import {
  buildEditableSources,
  buildSources,
  orderPartitionValues,
  resolveRowColors,
} from './sourcesLogic.ts'
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
  // adapter feature id + the region it was found in, so a click can re-fetch
  // the full feature for the details widget
  id: string
  regionIndex: number
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
      /**
       * #getter
       */
      get showTree(): boolean {
        return getConf(self, 'showTree')
      },
      /**
       * #getter
       */
      get showBranchLength(): boolean {
        return getConf(self, 'showBranchLength')
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
       * Optional explicit row order from config; values listed here are placed
       * first, remaining discovered values follow in sorted order.
       */
      get rowOrder(): string[] {
        return readConfObject(self.conf, 'rowOrder')
      },
      /**
       * #getter
       * Raw `color` slot (a CSS color or `jexl:` string), forwarded to the
       * worker which resolves it per feature.
       */
      get colorConfig(): string {
        return self.conf.color
      },
      /**
       * #getter
       * Map of partition value → color, forwarded to the worker which applies it
       * over the per-feature `color`.
       */
      get sampleColorMap(): Record<string, string> {
        return readConfObject(self.conf, 'sampleColorMap')
      },
      /**
       * #getter
       */
      get rowProportion(): number {
        return readConfObject(self.conf, 'rowProportion')
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Rows discovered in the loaded data: the distinct partition values across
       * all loaded regions, ordered by the config `rowOrder` then sorted. The
       * pre-layout, pre-filter input to the arrangement dialog and to clustering.
       */
      get sourcesWithoutLayout(): MultiRowSource[] {
        const values = new Set<string>()
        for (const data of self.rpcDataMap.values()) {
          for (const v of data.partitionValues) {
            values.add(v)
          }
        }
        return orderPartitionValues(values, self.rowOrder).map(name => ({
          name,
        }))
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
       * Per-row color (ABGR) by display row — the single per-row resolver
       * (dialog color > config `sampleColorMap` > palette-when-default). Applied
       * at render time over the worker-baked per-feature `color` slot, so any
       * color change repaints without a refetch.
       */
      get rowColorsByIndex(): (number | undefined)[] {
        return resolveRowColors(
          self.sources,
          self.sampleColorMap,
          self.colorConfig === MULTIROW_DEFAULT_COLOR,
        )
      },
      /**
       * #getter
       * Number of displayed rows (at least 1, so the auto-fit division is safe
       * and the canvas mounts before data arrives).
       */
      get nrow(): number {
        return Math.max(1, self.sources.length)
      },
      /**
       * #getter
       * The track height that auto-fit mode divides among rows: the `height`
       * config slot (its default, or a drag-resized value written to it).
       */
      get fitTargetHeight(): number {
        return readConfObject(self.conf, 'height')
      },
      /**
       * #getter
       * Resolved fixed row-height setting: `0` is auto-fit, any positive value is
       * a pinned px height. Drag-resize / fit-toggle write it via `setSlot`.
       */
      get rowHeightSetting(): number {
        return readConfObject(self.conf, 'rowHeight')
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Resolved per-row height. `rowHeightSetting === 0` auto-fits: the display
       * height split evenly across rows so all rows stay visible as the row count
       * grows. Any positive value is a pinned px height. Every consumer reads
       * this, never `rowHeightSetting`.
       */
      get rowHeight(): number {
        return self.rowHeightSetting === 0
          ? Math.max(1, self.fitTargetHeight / self.nrow)
          : self.rowHeightSetting
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Override BaseLinearDisplay.height so the track container matches the
       * rendering canvas (numRows × rowHeight). In auto-fit mode this resolves to
       * `fitTargetHeight`; in fixed mode it grows with the row count.
       */
      get height(): number {
        return self.nrow * self.rowHeight
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
      get renderState(): MultiRowRenderState {
        const view = getContainingView(self) as LinearGenomeViewModel
        return {
          canvasWidth: view.width,
          canvasHeight: self.height,
          rowHeight: self.rowHeight,
          rowProportion: self.rowProportion,
          rowIndexByValue: self.rowIndexByValue,
          rowColorsByIndex: self.rowColorsByIndex,
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
        const targetRow = Math.floor(mouseY / self.rowHeight)
        const source = self.sources[targetRow]
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
        const bp = p.coord0
        const {
          featureStarts,
          featureEnds,
          partitionValues,
          featurePartitionIndex,
          featureNames,
          featureIds,
        } = region
        // Resolve this region's local partition indices to global display rows
        // via the same helper both render paths use, so the hit-test can't drift
        // from where a feature actually paints.
        const rowForLocal = resolveLocalRowIndices(
          partitionValues,
          self.rowIndexByValue,
        )
        // Iterate back-to-front: both render paths paint in array order, so a
        // later feature sits on top of an overlapping earlier one — the hit must
        // resolve to the one actually visible.
        for (let i = featureStarts.length - 1; i >= 0; i--) {
          if (
            rowForLocal[featurePartitionIndex[i]!] === targetRow &&
            featureStarts[i]! <= bp &&
            bp < featureEnds[i]!
          ) {
            return {
              id: featureIds[i]!,
              regionIndex: p.index,
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
        self.configuration.setSlot('rowHeight', n)
      },
      /**
       * #action
       */
      setShowTree(f: boolean) {
        self.configuration.setSlot('showTree', f)
      },
      /**
       * #action
       */
      setShowBranchLength(f: boolean) {
        self.configuration.setSlot('showBranchLength', f)
      },
      /**
       * #action
       */
      setHoveredFeature(arg?: HoveredFeature) {
        self.hoveredFeature = arg
      },
      /**
       * #action
       * Re-fetch the full clicked feature by id and open it in the feature
       * details widget. The painting ships only the slim render arrays, so the
       * complete feature is fetched on demand (GetCanvasFeatureDetails).
       */
      selectFeatureById(featureId: string, displayedRegionIndex: number) {
        const region = self.loadedRegions.get(displayedRegionIndex)
        if (region) {
          void (async () => {
            const feature = await fetchCanvasFeatureDetails(
              getSession(self),
              getRpcSessionId(self),
              self.adapterConfig,
              featureId,
              region,
            )
            if (feature && isAlive(self)) {
              openFeatureWidget(self, feature.toJSON())
            }
          })()
        }
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
       * Set the track height. In auto-fit mode the rows restretch to it; in fixed
       * mode it's distributed across the current rows as a pinned row height.
       */
      setHeight(newHeight: number) {
        if (self.rowHeightSetting === 0) {
          self.configuration.setSlot(
            'height',
            Math.max(newHeight, MIN_DISPLAY_HEIGHT),
          )
        } else {
          self.configuration.setSlot(
            'rowHeight',
            Math.max(1, newHeight / self.nrow),
          )
        }
        return self.height
      },
      /**
       * #action
       * Drag-resize. Defers to `setHeight`, which restretches rows in auto-fit
       * mode and re-pins the row height in fixed mode.
       */
      resizeHeight(distance: number) {
        const oldHeight = self.height
        self.setHeight(self.height + distance)
        return self.height - oldHeight
      },
      /**
       * #action
       * Switch to auto-fit: seed the `height` config slot from the current
       * content height (so toggling on doesn't jump), then `rowHeight = 0`
       * makes `rowHeight` derive from it.
       */
      setFitToHeight() {
        self.configuration.setSlot(
          'height',
          Math.max(self.height, MIN_DISPLAY_HEIGHT),
        )
        self.configuration.setSlot('rowHeight', 0)
        self.scrollTop = 0
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
              self.rowColorsByIndex,
            )
            return { instanceBuffer: buffer, instanceCount: count }
          },
          b => {
            b.renderBlocks(self.renderBlocks, self.rpcDataMap, self.renderState)
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
