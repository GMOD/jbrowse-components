import {
  buildCoverageTooltipBin,
  computeCoverageTicks,
  computeVisibleCoverageStats,
  findSignificantInBin,
} from '@jbrowse/alignments-core'
import {
  ConfigurationReference,
  readConfObject,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  AUTO_FORCE_LOAD_BP,
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import { installPerRegionLifecycle } from '@jbrowse/render-core/installPerRegionLifecycle'
import {
  TreeSidebarMixin,
  buildSpatialIndex,
  clusterLayout,
} from '@jbrowse/tree-sidebar'
import { domainFromStats, getNiceDomain } from '@jbrowse/wiggle-core'
import deepEqual from 'fast-deep-equal'
import { observable } from 'mobx'

import {
  computeVisibleAnnotations,
  findFrameAt,
} from './components/computeVisibleAnnotations.ts'
import { computeVisibleDeletions } from './components/computeVisibleDeletions.ts'
import { computeVisibleEmptyLines } from './components/computeVisibleEmptyLines.ts'
import { computeVisibleInsertions } from './components/computeVisibleInsertions.ts'
import { computeVisibleLabels } from './components/computeVisibleLabels.ts'
import { computeVisibleSummaryBars } from './components/computeVisibleSummaryBars.ts'
import { findRowHoverAtBp } from './components/findRowHover.ts'
import { coverageInsertionAt } from './coverageInsertion.ts'
import { DEFAULTS } from './displayDefaults.ts'
import { fetchMafAlignmentData, fetchMafSummaryData } from './fetchMafData.ts'
import { ROW_IDENTITY_MODE_VALUES } from './rowIdentityModes.ts'
import { buildMafTrackMenuItems } from './trackMenuItems.ts'
import { getMsaHighlights } from './util.ts'
import { buildInstanceBuffer } from '../LinearMafRenderer/mafInstanceBuffer.ts'
import { getFrameColors, getMafColorPalette } from '../LinearMafRenderer/util.ts'

import type { FrameMarker } from './components/computeVisibleAnnotations.ts'
import type {
  RowIdentityMode,
  RowIdentityModeWithOff,
} from './rowIdentityModes.ts'
import type {
  MafGPURenderState,
  MafGpuProps,
  MafRegionData,
  MafRenderingBackend,
} from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafColorPalette } from '../LinearMafRenderer/util.ts'
import type { MafFrameRecord, MafSummaryRecord, Sample } from '../types.ts'
import type { LinearMafDisplayConfig } from './configSchema.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

/**
 * Per-row metadata stored in `sourcesVolatile`. `name` is the sample id
 * (matches the canonical `Sample.id`); `label`/`color` are display-only.
 */
export interface MafSource {
  name: string
  label?: string
  color?: string
}

const minDisplayHeight = 20

/**
 * #stateModel LinearMafDisplay
 *
 * #example
 * A complete `MafTrack` config to paste into `tracks`. `samples` lists the
 * aligned species in track order; `rowHeightMode` sets the per-sample band
 * height in px (or `0` to stretch rows to fill the track height):
 * ```js
 * {
 *   type: 'MafTrack',
 *   trackId: 'multiz',
 *   name: 'Multiz alignment',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'BigMafAdapter',
 *     bigBedLocation: { uri: 'https://example.com/multiz.bb' },
 *     samples: ['hg38', 'panTro4', 'mm10'],
 *   },
 *   displays: [
 *     {
 *       type: 'LinearMafDisplay',
 *       displayId: 'multiz-LinearMafDisplay',
 *       rowHeightMode: 16,
 *       showCoverage: true,
 *     },
 *   ],
 * }
 * ```
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
         * Per-row height in px, or `0` for "fit to display height" mode, where
         * rows stretch to fill the dragged track height. Mirrors the variants
         * MultiSampleVariantDisplay `rowHeightMode`. The `rowHeight` getter
         * resolves this to a concrete px value.
         */
        rowHeightMode: types.stripDefault(types.number, DEFAULTS.rowHeight),
        /**
         * #property
         */
        rowProportion: types.stripDefault(types.number, DEFAULTS.rowProportion),
        /**
         * #property
         */
        showAllLetters: types.stripDefault(
          types.boolean,
          DEFAULTS.showAllLetters,
        ),
        /**
         * #property
         */
        mismatchRendering: types.stripDefault(
          types.boolean,
          DEFAULTS.mismatchRendering,
        ),
        /**
         * #property
         */
        showAsUpperCase: types.stripDefault(
          types.boolean,
          DEFAULTS.showAsUpperCase,
        ),
        /**
         * #property
         */
        showTree: types.stripDefault(types.boolean, DEFAULTS.showTree),
        /**
         * #property
         * Position tree nodes by their cluster merge height (dendrogram) rather
         * than evenly by topology (cladogram).
         */
        showBranchLength: types.stripDefault(
          types.boolean,
          DEFAULTS.showBranchLength,
        ),
        /**
         * #property
         */
        showCoverage: types.stripDefault(types.boolean, DEFAULTS.showCoverage),
        /**
         * #property
         * Show the per-sample alignment rows. When off, only the coverage band
         * renders (independent of `showCoverage`).
         */
        showAlignments: types.stripDefault(
          types.boolean,
          DEFAULTS.showAlignments,
        ),
        /**
         * #property
         */
        coverageHeight: types.stripDefault(
          types.number,
          DEFAULTS.coverageHeight,
        ),
        /**
         * #property
         * Show the conservation band (per-bp percent identity to the reference,
         * computed from the aligned species). Off by default. Independent of
         * `showCoverage`/`showAlignments`.
         */
        showConservation: types.stripDefault(
          types.boolean,
          DEFAULTS.showConservation,
        ),
        /**
         * #property
         */
        conservationHeight: types.stripDefault(
          types.number,
          DEFAULTS.conservationHeight,
        ),
        /**
         * #property
         * Per-row identity rendering shown in place of the base SNP coloring once
         * zoomed out past base level (see `activeRowRendering`): each species row
         * shows its local (per-pixel) percent identity to the reference.
         * `heatmap` shades the row band on a red→grey→blue ramp; `xyplot` draws
         * a per-species identity wiggle (bar height = identity). `none` (the
         * default) keeps the base coloring at every zoom.
         */
        rowIdentityMode: types.stripDefault(
          types.enumeration('RowIdentityMode', ROW_IDENTITY_MODE_VALUES),
          DEFAULTS.rowIdentityMode,
        ),
        /**
         * #property
         * When true (default) the per-row identity plot follows zoom like UCSC
         * `wigMaf` — bases at base level, the identity plot when zoomed out. When
         * false the selected `rowIdentityMode` is pinned on at every zoom.
         */
        rowIdentityAutoZoom: types.stripDefault(
          types.boolean,
          DEFAULTS.rowIdentityAutoZoom,
        ),
        /**
         * #property
         * Show the per-species CDS reading-frame overlay sourced from the
         * configured `annotationAdapter` (UCSC `mafFrames`). No effect unless
         * an `annotationAdapter` is configured.
         */
        showAnnotations: types.stripDefault(
          types.boolean,
          DEFAULTS.showAnnotations,
        ),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      rpcDataMap: observable.map<number, MafRegionData>(),
      /**
       * #volatile
       * Per-region `bigMafSummary` rows for the zoom-out path, populated by
       * `fetchMafSummaryData` only while `showSummary` is active. Kept separate
       * from `rpcDataMap` so the GPU sequence canvas and the summary overlay
       * never read each other's data.
       */
      summaryDataMap: observable.map<number, MafSummaryRecord[]>(),
      /**
       * #volatile
       * Per-region CDS frame rows (UCSC `mafFrames`) for the annotation overlay,
       * populated by the frames RPC in parallel with the main fetch. Kept
       * separate from the alignment/summary maps so the overlay survives the
       * summary↔detail data swap.
       */
      framesDataMap: observable.map<number, MafFrameRecord[]>(),
      /**
       * #volatile
       */
      prefersOffset: true,
      /**
       * #volatile
       * The worker's authoritative row set, in tree (leaf) order. `layout`
       * overlays any user reorder/relabel on top; `editableSources` merges the
       * two and `sources` narrows that by the subtree filter.
       */
      sourcesVolatile: [] as MafSource[],
      /**
       * #volatile
       * The worker's guide-tree Newick (the default, before any reorder). The
       * active displayed tree lives in the mixin's `clusterTree`, which a
       * reorder clears (rows no longer match the dendrogram) and "Clear
       * arrangement" restores from here — so we keep the worker tree separately
       * rather than re-fetching it.
       */
      treeNewickVolatile: undefined as string | undefined,
      /**
       * #volatile
       * True during an active height drag. Gates the dense per-base letter
       * overlay (a Canvas2D pass that re-scans every visible cell and redraws
       * thousands of glyphs each frame) so the drag only restretches the cheap
       * GPU cell canvas; letters snap back when the drag settles.
       */
      resizing: false,
      // Debounce handle that clears `resizing` after the drag stops.
      resizeSettleTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setRowHeight(n: number) {
        self.rowHeightMode = n
      },
      /**
       * #action
       */
      setResizing(arg: boolean) {
        self.resizing = arg
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
       * Receive worker-authoritative `samples` + serialized Newick tree.
       * Samples + tree are config-derived and identical on every region fetch,
       * so the deepEqual guard makes this fire once and skips the redundant
       * frozen-array reassignment (and downstream `sources`/instance-buffer
       * recompute) on later scroll/zoom. The active `clusterTree` is set from
       * the worker tree only when there's no custom arrangement — a reorder has
       * cleared it and must keep it cleared until the user clears the layout.
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
        if (!deepEqual(next, self.sourcesVolatile)) {
          self.sourcesVolatile = next
          self.treeNewickVolatile = treeNewick
          if (!self.layout.length) {
            self.setClusterTree(treeNewick)
          }
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
      setShowTree(arg: boolean) {
        self.showTree = arg
      },
      /**
       * #action
       */
      setShowBranchLength(arg: boolean) {
        self.showBranchLength = arg
      },
      /**
       * #action
       */
      setShowCoverage(arg: boolean) {
        self.showCoverage = arg
      },
      /**
       * #action
       */
      setShowAlignments(arg: boolean) {
        self.showAlignments = arg
      },
      /**
       * #action
       */
      setCoverageHeight(arg: number) {
        self.coverageHeight = arg
      },
      /**
       * #action
       */
      setShowConservation(arg: boolean) {
        self.showConservation = arg
      },
      /**
       * #action
       */
      setRowIdentityMode(arg: RowIdentityModeWithOff) {
        self.rowIdentityMode = arg
      },
      /**
       * #action
       */
      setRowIdentityAutoZoom(arg: boolean) {
        self.rowIdentityAutoZoom = arg
      },
      /**
       * #action
       */
      setShowAnnotations(arg: boolean) {
        self.showAnnotations = arg
      },
      /**
       * #action
       */
      setConservationHeight(arg: number) {
        self.conservationHeight = arg
      },
    }))
    .actions(self => {
      const superClearLayout = self.clearLayout
      return {
        /**
         * #action
         * Drop the custom arrangement and restore the worker's guide tree (the
         * base `clearLayout` only clears it — the worker tree lives in
         * `treeNewickVolatile`).
         */
        clearLayout() {
          superClearLayout()
          if (self.treeNewickVolatile) {
            self.setClusterTree(self.treeNewickVolatile)
          }
        },
      }
    })
    .views(self => ({
      /**
       * #getter
       * the config typed off the concrete schema; `ConfigurationReference`
       * erases `self.configuration` to `any`, so direct reads route through this
       * to stay typed (same move as `BaseAdapter<CONF>`)
       */
      get conf(): LinearMafDisplayConfig {
        return self.configuration
      },
      /**
       * #getter
       * The containing LGV, typed once here so views/actions don't each repeat
       * the `getContainingView(self) as LinearGenomeViewModel` cast.
       */
      get lgv(): LinearGenomeViewModel {
        return getContainingView(self) as LinearGenomeViewModel
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The configured CDS-frame annotation adapter snapshot (UCSC `mafFrames`),
       * or undefined when unset. A frozen config slot, so this is a plain
       * snapshot the frames RPC hands straight to `getAdapter`.
       */
      get annotationAdapterConfig(): Record<string, unknown> | undefined {
        return readConfObject(self.conf, 'annotationAdapter') ?? undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether the per-species CDS frame overlay should fetch + draw: an
       * annotation adapter is configured and the toggle is on.
       */
      get annotationsActive(): boolean {
        return self.showAnnotations && !!self.annotationAdapterConfig
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The full row set with the user's arrangement applied: `layout` supplies
       * order + label/color overrides, merged over the worker's `sourcesVolatile`
       * by name. Empty `layout` (no customization) passes the worker set through.
       * Not subtree-filtered — this is what the arrangement dialog edits.
       * Undefined until the first fetch populates the worker set.
       */
      get editableSources(): MafSource[] | undefined {
        const base = self.sourcesVolatile
        if (base.length === 0) {
          return undefined
        }
        if (self.layout.length === 0) {
          return base
        }
        const byName = new Map(base.map(s => [s.name, s]))
        return self.layout.flatMap(row => {
          const b = byName.get(row.name)
          return b ? [{ ...b, ...row }] : []
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The display rows: `editableSources` narrowed to the selected subtree.
       */
      get sources(): MafSource[] | undefined {
        const base = self.editableSources
        if (!base) {
          return undefined
        }
        if (self.subtreeFilter?.length) {
          const filterSet = new Set(self.subtreeFilter)
          return base.filter(s => filterSet.has(s.name))
        }
        return base
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
       * Display row order shipped to the worker so its block `rowIndex` matches
       * the on-screen row. Single source for both `rpcProps` (cache-invalidation
       * key) and the alignment-fetch RPC arg so the two can't drift.
       */
      get orderedSampleIds(): string[] | undefined {
        return self.sources?.map(s => s.name)
      },
      /**
       * #getter
       * Maps a `src` (species) to its display row index. The single source for
       * the `src`→row projection used by the summary-bar and CDS-frame overlays
       * and the frame hover lookup, so they can't disagree on row placement.
       */
      get rowIndexBySrc(): Map<string, number> {
        return new Map(
          self.sources?.map((s, i): [string, number] => [s.name, i]) ?? [],
        )
      },
      /**
       * #getter
       * Height of the coverage band above the rows (0 when hidden).
       */
      get coverageDisplayHeight() {
        return self.showCoverage ? self.coverageHeight : 0
      },
      /**
       * #getter
       * Height of the conservation (percent identity) band (0 when hidden).
       */
      get conservationDisplayHeight() {
        return self.showConservation ? self.conservationHeight : 0
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Top offset of the per-sample rows area = the stacked band heights above
       * it (coverage + conservation). The single source of truth for "where the
       * rows start" — every rows hit-test / draw / export offset routes through
       * this so adding a band can't desync them.
       */
      get rowsTopOffset() {
        return self.coverageDisplayHeight + self.conservationDisplayHeight
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Number of displayed rows (at least 1, so the fit-mode division is safe).
       */
      get nrow() {
        return Math.max(1, self.sources?.length ?? 0)
      },
      /**
       * #getter
       * The track height that fit-to-height mode divides among rows: the
       * user-dragged `heightOverride` (TrackHeightMixin) or the config `height`
       * default before any drag.
       */
      get fitTargetHeight(): number {
        return self.heightOverride ?? readConfObject(self.conf, 'height')
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Per-row height in fit-to-height mode: the rows area (track height minus
       * the fixed bands) split evenly across rows.
       */
      get autoRowHeight() {
        return Math.max(
          1,
          (self.fitTargetHeight - self.rowsTopOffset) / self.nrow,
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Resolved per-row height. `rowHeightMode === 0` is fit-to-height (rows
       * stretch to the dragged track height); any positive value is a pinned px
       * height. Every consumer reads this getter, never `rowHeightMode`.
       */
      get rowHeight() {
        return self.rowHeightMode === 0
          ? self.autoRowHeight
          : self.rowHeightMode
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Height of the per-sample rows area (excludes the coverage band). Zero
       * when alignments are hidden, collapsing the display to the coverage band.
       */
      get rowsHeight() {
        if (!self.showAlignments) {
          return 0
        }
        return self.sources ? self.sources.length * self.rowHeight : 1
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Full display height = rows area + stacked bands.
       */
      get totalHeight() {
        return self.rowsHeight + self.rowsTopOffset
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Override BaseLinearDisplay.height so the track container matches the
       * rendering canvas height exactly (coverage band + rows × rowHeight).
       */
      get height() {
        return self.totalHeight
      },
      /**
       * #getter
       * Positioned tree hierarchy. Coordinates are computed against
       * `(rowsHeight, treeAreaWidth)` so leaf rows align with row tops; the
       * coverage band is offset separately by the React layer.
       */
      get hierarchy() {
        const r = self.root
        if (!r || !self.sources?.length) {
          return undefined
        }
        return clusterLayout(
          r,
          self.rowsHeight,
          self.treeAreaWidth,
          self.showBranchLength,
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Switch to fit-to-height mode: rows stretch to fill the track height.
       * Seeds `heightOverride` from the current content height so toggling on
       * doesn't jump, then `rowHeightMode = 0` makes `rowHeight` derive from it.
       */
      setFitToHeight() {
        // Seed from the current content height so toggling on never jumps,
        // even if a prior fixed-mode drag left a stale heightOverride.
        self.heightOverride = Math.max(self.height, minDisplayHeight)
        self.rowHeightMode = 0
        self.scrollTop = 0
      },
      /**
       * #action
       * Drag-resize. In fit mode the new height drives `autoRowHeight` (rows
       * stretch). In fixed mode the pinned `rowHeightMode` scales proportionally
       * so dragging still resizes rows. Mirrors the variants display.
       *
       * Flips `resizing` for the duration of the drag (cleared a beat after the
       * last tick) so the dense letter overlay sits out the frame-by-frame
       * restretch — see the `resizing` volatile.
       */
      resizeHeight(distance: number) {
        const oldHeight = self.height
        const newHeight = Math.max(oldHeight + distance, minDisplayHeight)
        self.heightOverride = newHeight
        if (self.rowHeightMode > 0) {
          self.rowHeightMode = (self.rowHeightMode * newHeight) / oldHeight
        }
        self.resizing = true
        clearTimeout(self.resizeSettleTimer)
        self.resizeSettleTimer = setTimeout(() => {
          if (isAlive(self)) {
            self.setResizing(false)
          }
        }, 150)
        return newHeight - oldHeight
      },
    }))
    .views(self => ({
      get spatialIndex() {
        return self.hierarchy ? buildSpatialIndex(self.hierarchy) : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Theme-derived color palette (per-base colors + match/gap/mismatch/
       * unknown/insertion), read by `gpuProps()` and `renderState`. Derived
       * from the session theme so it's always available — including headless
       * SVG export and RPC, where no component mounts to seed it. Theme changes
       * trigger a main-thread re-encode but never an RPC refetch.
       */
      get colorPalette(): MafColorPalette {
        return getMafColorPalette(getSession(self).theme)
      },
      /**
       * #getter
       * Theme CDS reading-frame colors for the annotation overlay, indexed by
       * the marker `frameIndex` via `Array.at`. Theme-derived (like
       * `colorPalette`) so it's available headless for SVG export too.
       */
      get frameColors(): (string | undefined)[] {
        return getFrameColors(getSession(self).theme)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Render state passed to GPU/Canvas2D backend each frame. Uses the rows-
       * only height so the GPU canvas only paints the per-sample band; the
       * coverage band is drawn on a separate Canvas2D overlay above.
       */
      get renderState(): MafGPURenderState | undefined {
        const view = self.lgv
        if (!view.initialized || !self.sources) {
          return undefined
        }
        return {
          canvasWidth: view.width,
          canvasHeight: self.rowsHeight,
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
      gpuProps(): MafGpuProps {
        return {
          palette: self.colorPalette,
          showAllLetters: self.showAllLetters,
          mismatchRendering: self.mismatchRendering,
        }
      },
      /**
       * #method
       * Worker-fetch inputs that invalidate cached data when changed (tier-1,
       * via MultiRegionDisplayMixin's `SettingsInvalidate` autorun → refetch).
       * `orderedSampleIds` is the display row order (layout reorder + subtree
       * filter); the worker emits block rows in it so `rowIndex` is the
       * on-screen row. Loop-safe despite deriving from worker output: `sources`
       * is set-stable (`sourcesVolatile` deepEqual-guarded in `setSamples`,
       * `layout`/`subtreeFilter` user-driven), so it doesn't churn per fetch.
       */
      rpcProps() {
        // `annotationsActive` is a cache key so toggling the CDS-frame overlay
        // on triggers a refetch that populates `framesDataMap` for the loaded
        // regions (the frames piggyback on the same fetch pass).
        return {
          orderedSampleIds: self.orderedSampleIds,
          annotationsActive: self.annotationsActive,
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Per-position depth stats across the currently visible content blocks,
       * derived from the worker-shipped `coverage.coverageDepths` arrays (which
       * already reflect the active subtree — see `rpcProps`). Feeds
       * `coverageDomain` → `coverageTicks`.
       */
      get coverageStats() {
        if (!self.showCoverage) {
          return undefined
        }
        const view = self.lgv
        if (!view.initialized) {
          return undefined
        }
        return computeVisibleCoverageStats(
          view.dynamicBlocks.contentBlocks,
          b => self.rpcDataMap.get(b.displayedRegionIndex!)?.coverage,
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * [min, max] coverage domain for the visible blocks. Linear scale only
       * for MAF — sample counts are already bounded and well-distributed.
       */
      get coverageDomain() {
        return self.coverageStats
          ? getNiceDomain({
              domain: domainFromStats(self.coverageStats, 'global', 3),
              bounds: [undefined, undefined],
              scaleType: 'linear',
            })
          : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Y-axis tick marks for the coverage band.
       */
      get coverageTicks() {
        return self.coverageDomain
          ? computeCoverageTicks(
              self.coverageDomain[1],
              self.coverageHeight,
              'linear',
            )
          : undefined
      },
    }))
    .views(self => ({
      /**
       * #method
       * Resolve a hover hit on `rowIndex` at absolute genomic `bp` (uint32, per
       * worker-output convention): an aligned base (`cell`) or a bridged/empty
       * region (`empty`), each tagged with the sample label. Returns undefined
       * when no fetched block covers the bp, the row is out of range, or the
       * cell is a gap.
       */
      rowHoverInfo(
        displayedRegionIndex: number,
        gposFrac: number,
        rowIndex: number,
        bpPerPx: number,
      ) {
        const { sources } = self
        const region =
          sources && rowIndex >= 0 && rowIndex < sources.length
            ? self.rpcDataMap.get(displayedRegionIndex)
            : undefined
        const hit = region
          ? findRowHoverAtBp(
              region,
              gposFrac,
              rowIndex,
              self.showAsUpperCase,
              bpPerPx,
            )
          : undefined
        if (!hit || !sources) {
          return undefined
        }
        const source = sources[rowIndex]!
        return {
          ...hit,
          sampleLabel: source.label ?? source.name,
        }
      },
      /**
       * #method
       * The CDS frame record covering absolute genomic `bp` (uint32) on display
       * `rowIndex`, or undefined when no frame overlaps there (or the overlay is
       * off). Powers the gene/reading-frame rows in the hover tooltip — the
       * species is matched by the same `src`→row projection the overlay draws
       * with, so the tooltip and the strip can't disagree about which row a gene
       * is on.
       */
      frameHoverInfo(displayedRegionIndex: number, bp: number, rowIndex: number) {
        if (!self.annotationsActive) {
          return undefined
        }
        const hit = findFrameAt(
          self.framesDataMap.get(displayedRegionIndex),
          Math.floor(bp),
          rowIndex,
          self.rowIndexBySrc,
        )
        return hit
          ? { name: hit.name, frame: hit.frame, strand: hit.strand }
          : undefined
      },
      /**
       * #method
       * Build a per-position coverage tooltip bin (depth + SNP base counts) for
       * the given absolute genomic bp + region index. Delegates the math to
       * alignments-core's `buildCoverageTooltipBin` — same code path the
       * alignments display uses. Insertions are reported separately via
       * `coverageInsertionHit`, so they never mix into the depth/SNP table.
       * Returns undefined when the region has no fetched data or depth is zero.
       */
      coverageTooltipBin(
        displayedRegionIndex: number,
        position: number,
        bpPerPx: number,
      ) {
        const coverage = self.rpcDataMap.get(displayedRegionIndex)?.coverage
        if (!coverage) {
          return undefined
        }
        // Zoomed out a pixel spans many bp, so the exact cursor position rarely
        // lands on the SNP coordinate. Tooltip the most significant SNP in the
        // pixel's bp range instead (mirrors alignments' `hitTestCoverage`);
        // depth still falls back to the exact position when none qualifies.
        const snpPos =
          bpPerPx > 1
            ? findSignificantInBin(
                coverage.mismatchPositions,
                coverage.coverageDepths,
                coverage.coverageStartPos,
                position,
                position + Math.ceil(bpPerPx),
                0.05,
              )
            : undefined
        const bin = buildCoverageTooltipBin(
          snpPos ?? position,
          {
            coverageDepths: coverage.coverageDepths,
            coverageStartPos: coverage.coverageStartPos,
          },
          {
            mismatchPositions: coverage.mismatchPositions,
            mismatchBases: coverage.mismatchBases,
          },
        )
        if (!bin) {
          return undefined
        }
        // Percent identity at the reported position (NaN where unclassifiable).
        const idx = bin.position - coverage.coverageStartPos
        const identity =
          idx >= 0 && idx < coverage.identityScores.length
            ? (coverage.identityScores[idx] ?? Number.NaN)
            : Number.NaN
        return { ...bin, identity }
      },
      /**
       * #method
       * Hit-test an insertion bar in the coverage band at fractional genomic
       * `gposFrac`. Returns the interbase summary (count + length range +
       * interbaseDepth) when the cursor is on the bar, else undefined — drives
       * the dedicated interbase tooltip, kept separate from the depth/SNP one.
       */
      coverageInsertionHit(
        displayedRegionIndex: number,
        gposFrac: number,
        bpPerPx: number,
      ) {
        const coverage = self.rpcDataMap.get(displayedRegionIndex)?.coverage
        return coverage
          ? coverageInsertionAt(coverage, gposFrac, bpPerPx)
          : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get visibleLabels() {
        const view = self.lgv
        if (!view.initialized || !self.sources || self.resizing) {
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
      /**
       * #getter
       * Positioned bridge-line segments for `e`-line (empty/bridged) rows.
       */
      get visibleEmptyLines() {
        const view = self.lgv
        if (!view.initialized) {
          return []
        }
        return computeVisibleEmptyLines({
          view,
          rpcDataMap: self.rpcDataMap,
          rowHeight: self.rowHeight,
          rowProportion: self.rowProportion,
        })
      },
      /**
       * #getter
       * Positioned insertion markers (interbase) for the visible aligned rows.
       */
      get visibleInsertions() {
        const view = self.lgv
        if (!view.initialized) {
          return []
        }
        return computeVisibleInsertions({
          view,
          rpcDataMap: self.rpcDataMap,
          rowHeight: self.rowHeight,
          rowProportion: self.rowProportion,
        })
      },
      /**
       * #getter
       * Positioned deletion runs for the visible aligned rows; the overlay draws
       * the deleted-base count inside each run when it fits.
       */
      get visibleDeletions() {
        const view = self.lgv
        if (!view.initialized) {
          return []
        }
        return computeVisibleDeletions({
          view,
          rpcDataMap: self.rpcDataMap,
          rowHeight: self.rowHeight,
          rowProportion: self.rowProportion,
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Use the cheap summary path when a `bigMafSummary` sub-adapter is
       * configured and the view is zoomed out past the force-load threshold —
       * exactly where the full alignment fetch would be blocked by the byte
       * gate. Tracks without a summary never enter this path.
       */
      get showSummary() {
        const view = self.lgv
        return (
          !!readConfObject(self.adapterConfig, 'summaryAdapter') &&
          view.initialized &&
          view.visibleBp >= AUTO_FORCE_LOAD_BP
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * At base level each reference base spans at least a pixel, so individual
       * bases / SNP marks are legible (UCSC's `zoomedToBaseLevel`). Read off the
       * debounced `coarseBpPerPx` so the rendering swap it gates doesn't thrash
       * mid-zoom. False until the view is initialized.
       */
      get zoomedToBaseLevel() {
        const view = self.lgv
        return view.initialized && view.coarseBpPerPx <= 1
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Single source of truth for what the per-sample rows area draws right now:
       * `bases` (the GPU SNP/base coloring) or one of the per-row identity styles
       * (`heatmap` / `xyplot`). With `rowIdentityAutoZoom` (default) it emulates
       * UCSC `wigMaf` — bases at base level, the identity plot when zoomed out;
       * with auto off the selected mode is pinned at every zoom. Either way it's
       * off when no mode is selected or the cheap `bigMafSummary` path already
       * owns the zoom-out view. The GPU canvas, the identity canvas, and SVG
       * export all branch on this one getter so they can't disagree about what's
       * on screen.
       */
      get activeRowRendering(): 'bases' | RowIdentityMode {
        const { rowIdentityMode } = self
        // With auto on (default) the identity plot yields to the bases once
        // zoomed in to base level — UCSC wigMaf. Auto off pins it on everywhere.
        const autoHidesAtBaseLevel =
          self.rowIdentityAutoZoom && self.zoomedToBaseLevel
        return rowIdentityMode !== 'none' &&
          !self.showSummary &&
          !autoHidesAtBaseLevel
          ? rowIdentityMode
          : 'bases'
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Positioned per-species presence bars for the zoom-out summary overlay.
       * Empty unless `showSummary` is active. Unmatched `src` rows drop via the
       * `sources` index, keeping the render robust to summary files that list
       * extra species.
       */
      get visibleSummaryBars() {
        const view = self.lgv
        if (!self.showSummary || !self.sources) {
          return []
        }
        return computeVisibleSummaryBars({
          view,
          summaryDataMap: self.summaryDataMap,
          rowIndexBySrc: self.rowIndexBySrc,
          rowHeight: self.rowHeight,
          rowProportion: self.rowProportion,
        })
      },
      /**
       * #getter
       * Positioned per-species CDS frame boxes for the annotation overlay.
       * Empty unless an annotation adapter is configured and the overlay is on.
       * Reuses the `src`→row mapping the summary bars established, so frame rows
       * for species the track doesn't list drop out.
       */
      get visibleFrames(): FrameMarker[] {
        const view = self.lgv
        if (!view.initialized || !self.annotationsActive || !self.sources) {
          return []
        }
        return computeVisibleAnnotations({
          view,
          framesDataMap: self.framesDataMap,
          rowIndexBySrc: self.rowIndexBySrc,
          rowHeight: self.rowHeight,
          rowProportion: self.rowProportion,
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
      setSummaryData(regionIndex: number, records: MafSummaryRecord[]) {
        self.summaryDataMap.set(regionIndex, records)
      },
      setFramesData(regionIndex: number, records: MafFrameRecord[]) {
        self.framesDataMap.set(regionIndex, records)
      },
      // Drop alignment blocks when entering summary mode so the GPU sequence
      // canvas paints nothing under the summary overlay (and vice versa).
      clearAlignmentData() {
        self.rpcDataMap.clear()
      },
      clearDisplaySpecificData() {
        self.rpcDataMap.clear()
        self.summaryDataMap.clear()
        self.framesDataMap.clear()
      },
      // reload() not overridden — MultiRegionDisplayMixin's base default
      // (clearAllRpcData) is exactly maf's behavior; no extra teardown.
      startRenderingBackend(backend: MafRenderingBackend) {
        // Per-region streamed upload. The encode callback builds the GPU
        // instance buffer on the main thread from raw region data + gpuProps,
        // so theme / showAllLetters / mismatchRendering changes re-encode
        // without an RPC roundtrip.
        installPerRegionLifecycle(
          self,
          self.rpcDataMap,
          backend,
          regionData => {
            const { buffer, count } = buildInstanceBuffer({
              blocks: regionData.blocks,
              ...self.gpuProps(),
            })
            return { instanceBuffer: buffer, instanceCount: count }
          },
          b => {
            const state = self.renderState
            if (!state) {
              return false
            }
            // When the identity plot is the active rows rendering (zoomed out),
            // render no blocks so the GPU canvas clears to transparent and the
            // identity canvas drawn over it is the only thing visible.
            b.renderBlocks(
              self.activeRowRendering === 'bases' ? self.renderBlocks : [],
              self.rpcDataMap,
              state,
            )
            return true
          },
        )
      },
    }))
    .actions(self => ({
      fetchNeeded(needed: { region: Region; displayedRegionIndex: number }[]) {
        // Zoom-out with a configured summary → cheap per-species summary rows;
        // otherwise the full alignment fetch (subject to the byte gate below).
        return self.showSummary
          ? fetchMafSummaryData(self, needed)
          : fetchMafAlignmentData(self, needed)
      },
      /**
       * #action
       * Force a refetch when the loaded data is the wrong kind for the current
       * zoom: crossing the summary↔detail threshold within an already-loaded
       * region wouldn't trip the bounds-based coverage check, so the mode is
       * keyed on which map holds the region.
       */
      isCacheValid(displayedRegionIndex: number) {
        return self.showSummary
          ? self.summaryDataMap.has(displayedRegionIndex)
          : self.rpcDataMap.has(displayedRegionIndex)
      },
      /**
       * #action
       * Enable byte-estimate gating: above ~20kb visible, the adapter's
       * MAF-aware byte estimate (per-species sequence × span) is checked against
       * `fetchSizeLimit`, blocking the detail fetch with a force-load prompt
       * rather than downloading hundreds of species' bases at genome scale.
       *
       * Returns null in summary mode — the summary read is cheap (zoom-reduced
       * BigBed), so it must never be blocked by the gate.
       */
      getByteEstimateConfig() {
        if (self.showSummary) {
          return null
        }
        const view = self.lgv
        return {
          adapterConfig: self.adapterConfig,
          fetchSizeLimit: readConfObject(self.conf, 'fetchSizeLimit'),
          userByteSizeLimit: self.userByteSizeLimit,
          visibleBp: view.visibleBp,
        }
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
      // The active clusterTree is derived (rebuilt from worker output on fetch,
      // or restored from treeNewickVolatile on clear), so it's dropped rather
      // than persisted. `layout` IS persisted — it's the user's custom row
      // arrangement; stripDefault omits it when empty (the common case).
      const { clusterTree: _clusterTree, ...rest } = snap
      return rest
    })
    .preProcessSnapshot((snap: Record<string, unknown> | undefined) => {
      // Pre-fit-mode sessions stored a bare `rowHeight` property; migrate it to
      // `rowHeightMode` (a px value = fixed mode).
      if (
        snap &&
        snap.rowHeightMode === undefined &&
        snap.rowHeight !== undefined
      ) {
        const { rowHeight, ...rest } = snap
        return { ...rest, rowHeightMode: rowHeight }
      }
      return snap
    })
}

export type LinearMafDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearMafDisplayModel = Instance<LinearMafDisplayStateModel>
