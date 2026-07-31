import {
  buildCoverageTooltipBin,
  computeCoverageTicks,
  computeVisibleCoverageStats,
  findSignificantInBin,
} from '@jbrowse/alignments-core'
import {
  ConfigurationReference,
  getConf,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { clampBandHeight } from '@jbrowse/core/util/bandHeight'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  MIN_DISPLAY_HEIGHT,
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import { MAX_CANVAS_DIM_PX, getDpr } from '@jbrowse/render-core'
import { installPerRegionLifecycle } from '@jbrowse/render-core/installPerRegionLifecycle'
import {
  TreeSidebarMixin,
  buildSpatialIndex,
  computeClusterHierarchy,
  filterRowsBySubtree,
} from '@jbrowse/tree-sidebar'
import { domainFromStats, getNiceDomain } from '@jbrowse/wiggle-core'
import deepEqual from 'fast-deep-equal'
import { observable } from 'mobx'

import { buildInstanceBuffer } from '../LinearMafRenderer/mafInstanceBuffer.ts'
import { getMafColorPalette } from '../LinearMafRenderer/util.ts'
import {
  computeVisibleAnnotations,
  findFrameAt,
} from './components/computeVisibleAnnotations.ts'
import {
  computeCodonConservation,
  computeVisibleCodons,
  findCodonAt,
  locateVisibleCodons,
} from './components/computeVisibleCodons.ts'
import { computeVisibleDeletions } from './components/computeVisibleDeletions.ts'
import { computeVisibleEmptyLines } from './components/computeVisibleEmptyLines.ts'
import { computeVisibleInsertions } from './components/computeVisibleInsertions.ts'
import { computeVisibleInversions } from './components/computeVisibleInversions.ts'
import { computeVisibleLabels } from './components/computeVisibleLabels.ts'
import { computeVisibleSummaryBars } from './components/computeVisibleSummaryBars.ts'
import { identityRgb } from './components/drawRowIdentity.ts'
import {
  perRowChromRanks,
  sourceChromRankColor,
  sourceChromRankLabel,
  uniqueRegionsFromBlocks,
} from './components/drawSourceChrom.ts'
import { findRowHoverAtBp } from './components/findRowHover.ts'
import { findRowSpan } from './components/findRowSpan.ts'
import { coverageInsertionAt } from './coverageInsertion.ts'
import { DEFAULTS } from './displayDefaults.ts'
import { fetchMafAlignmentData, fetchMafSummaryData } from './fetchMafData.ts'
import { buildMafTrackMenuItems } from './trackMenuItems.ts'
import { getMsaHighlights } from './util.ts'

import type {
  MafGPURenderState,
  MafGpuProps,
  MafRegionData,
  MafRenderingBackend,
} from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafColorPalette } from '../LinearMafRenderer/util.ts'
import type { MafFrameRecord, MafSummaryRecord, Sample } from '../types.ts'
import type { FrameMarker } from './components/computeVisibleAnnotations.ts'
import type {
  CodonConservationBar,
  CodonMarker,
  LocatedCodon,
} from './components/computeVisibleCodons.ts'
import type {
  LinearMafDisplayConfig,
  LinearMafDisplayConfigModel,
} from './configSchema.ts'
import type { ConservationMode } from './conservationModes.ts'
import type {
  RowIdentityMode,
  RowIdentityModeWithOff,
} from './rowIdentityModes.ts'
import type { Region, UriLocation } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

/**
 * Zoom at which the GPU encoder stops encoding every base and starts
 * decimating (see `encodeBinBp`). Below it a base is still wide enough that
 * dropping any would be visible; at or above it the first bin is 2bp wide, so
 * nothing that survived the sub-pixel race is lost.
 */
const MIN_BINNED_BP_PER_PX = 4

/**
 * Per-row metadata stored in `sourcesVolatile`. `name` is the sample id
 * (matches the canonical `Sample.id`); `label`/`color` are display-only.
 */
export interface MafSource {
  name: string
  label?: string
  color?: string
  /** assembly this row's genome is loaded as, when it is navigable */
  assemblyName?: string
  /** config to load that assembly from, when the session lacks it */
  assemblyConfigLocation?: UriLocation
}

/**
 * Merge a newly discovered row set into the known one, keeping first-seen order
 * and letting the newer entry supply label/color. Used for sample-discovery
 * tracks, where each region names only the genomes its own blocks contain — see
 * `setSamples`.
 */
export function unionSources(
  known: readonly MafSource[],
  incoming: readonly MafSource[],
): MafSource[] {
  const byName = new Map(known.map(s => [s.name, s]))
  for (const source of incoming) {
    byName.set(source.name, source)
  }
  return [...byName.values()]
}

/**
 * #stateModel LinearMafDisplay
 * #displayFoundation MultiRegionDisplayMixin
 *
 * #example
 * A complete `MafTrack` config to paste into `tracks`. `samples` lists the
 * aligned species in track order; `rowHeight` sets the per-sample band
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
 *       rowHeight: 16,
 *       showCoverage: true,
 *     },
 *   ],
 * }
 * ```
 */
export default function stateModelFactory(
  configSchema: LinearMafDisplayConfigModel,
) {
  return (
    types
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
         * Bumped by `setSamples` when the worker reports a row set that differs
         * from the one already established — never on the first fetch populating
         * an empty set. It's the invalidation half of the sample set, split out so
         * `rpcProps()` can key on "the set changed" without keying on the set
         * itself (which is fetch-derived, and made every track fetch twice). See
         * `rpcProps`.
         */
        sampleSetGeneration: 0,
      }))
      .views(self => ({
        /**
         * #getter
         */
        get rowHeight(): number {
          return getConf(self, 'rowHeight')
        },
        /**
         * #getter
         */
        get rowProportion(): number {
          return getConf(self, 'rowProportion')
        },
        /**
         * #getter
         */
        get showAllLetters(): boolean {
          return getConf(self, 'showAllLetters')
        },
        /**
         * #getter
         */
        get mismatchRendering(): boolean {
          return getConf(self, 'mismatchRendering')
        },
        /**
         * #getter
         */
        get showAsUpperCase(): boolean {
          return getConf(self, 'showAsUpperCase')
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
        /**
         * #getter
         */
        get showCoverage(): boolean {
          return getConf(self, 'showCoverage')
        },
        /**
         * #getter
         */
        get showAlignments(): boolean {
          return getConf(self, 'showAlignments')
        },
        /**
         * #getter
         */
        get coverageHeight(): number {
          return getConf(self, 'coverageHeight')
        },
        /**
         * #getter
         */
        get showConservation(): boolean {
          return getConf(self, 'showConservation')
        },
        /**
         * #getter
         */
        get conservationHeight(): number {
          return getConf(self, 'conservationHeight')
        },
        /**
         * #getter
         */
        get conservationMode(): ConservationMode {
          return getConf(self, 'conservationMode')
        },
        /**
         * #getter
         */
        get rowIdentityMode(): RowIdentityModeWithOff {
          return getConf(self, 'rowIdentityMode')
        },
        /**
         * #getter
         */
        get rowIdentityAutoZoom(): boolean {
          return getConf(self, 'rowIdentityAutoZoom')
        },
        /**
         * #getter
         */
        get showAnnotations(): boolean {
          return getConf(self, 'showAnnotations')
        },
        /**
         * #getter
         */
        get showTranslation(): boolean {
          return getConf(self, 'showTranslation')
        },
        /**
         * #getter
         */
        get colorByChromosome(): boolean {
          return getConf(self, 'colorByChromosome')
        },
        /**
         * #getter
         */
        get showInversions(): boolean {
          return getConf(self, 'showInversions')
        },
      }))
      .actions(self => ({
        /**
         * #action
         */
        setRowHeight(n: number) {
          setConf(self, 'rowHeight', n)
        },
        /**
         * #action
         */
        setRowProportion(n: number) {
          setConf(self, 'rowProportion', n)
        },
        /**
         * #action
         */
        setShowAllLetters(f: boolean) {
          setConf(self, 'showAllLetters', f)
        },
        /**
         * #action
         */
        setMismatchRendering(f: boolean) {
          setConf(self, 'mismatchRendering', f)
        },
        /**
         * #action
         * Receive the worker's `samples` + serialized Newick tree.
         *
         * `samplesCanonical` says whether that set is authoritative. Config- and
         * tree-derived sets are: they're complete and identical on every region
         * fetch, so they replace, and a species dropped from the config stops
         * being a row. A sample-discovery set is not: it names only the genomes
         * the fetched region's blocks contained, so it is unioned into the rows
         * already known (`unionSources`). Replacing there dropped rows — the
         * worker indexes blocks by the client's order and discards samples
         * missing from it, so a genome only one region aligns rendered nothing,
         * and a region with no blocks at all (or the summary path, which never
         * discovers) blanked every row.
         *
         * With either resolution the deepEqual guard makes this fire once and
         * skips the redundant frozen-array reassignment (and downstream
         * `sources`/instance-buffer recompute) on later scroll/zoom. The active
         * `clusterTree` is set from the worker tree only when there's no custom
         * arrangement — a reorder has cleared it and must keep it cleared until
         * the user clears the layout.
         *
         * The guard covers the sample set only: a tree can change while the set
         * doesn't (an edited `.nh`), and folding it in left `treeNewickVolatile`
         * — and so what "Clear arrangement" restores — pinned to the first tree
         * the session ever saw.
         *
         * A set that *changes* after one was already established bumps
         * `sampleSetGeneration`, which invalidates the fetched rows through
         * `rpcProps()`: they carry `rowIndex`es assigned against the old set. That
         * only happens on a sample-discovery track whose regions align different
         * genomes — where the union means it happens once per newly seen genome,
         * not once per region whose set differs from the last one's. The first
         * fetch populating an empty set does NOT bump — that
         * transition is not a change of anything, and treating it as one is what
         * made every MAF track fetch its alignment twice.
         *
         * The bump has to route through the cache key rather than clearing here:
         * `fetchRegions` calls `setLoadedRegion` *after* this commit returns, so an
         * imperative clear would be immediately overwritten by the very regions
         * that were fetched against the old set.
         */
        setSamples({
          samples,
          treeNewick,
          samplesCanonical,
        }: {
          samples: Sample[]
          treeNewick: string | undefined
          samplesCanonical: boolean
        }) {
          const incoming = samples.map(s => ({
            name: s.id,
            label: s.label,
            color: s.color,
            ...(s.assemblyName ? { assemblyName: s.assemblyName } : {}),
            ...(s.assemblyConfigLocation
              ? { assemblyConfigLocation: s.assemblyConfigLocation }
              : {}),
          }))
          const next = samplesCanonical
            ? incoming
            : unionSources(self.sourcesVolatile, incoming)
          if (!deepEqual(next, self.sourcesVolatile)) {
            if (self.sourcesVolatile.length > 0) {
              self.sampleSetGeneration += 1
            }
            self.sourcesVolatile = next
          }
          if (treeNewick !== self.treeNewickVolatile) {
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
          setConf(self, 'showAsUpperCase', arg)
        },
        /**
         * #action
         */
        setShowTree(arg: boolean) {
          setConf(self, 'showTree', arg)
        },
        /**
         * #action
         */
        setShowBranchLength(arg: boolean) {
          setConf(self, 'showBranchLength', arg)
        },
        /**
         * #action
         */
        setShowCoverage(arg: boolean) {
          setConf(self, 'showCoverage', arg)
        },
        /**
         * #action
         */
        setShowAlignments(arg: boolean) {
          setConf(self, 'showAlignments', arg)
        },
        /**
         * #action
         */
        setCoverageHeight(arg: number) {
          setConf(self, 'coverageHeight', arg)
        },
        /**
         * #action
         * Apply one drag delta to the coverage band. Reads the current height
         * inside the action rather than taking an absolute target: `ResizeHandle`
         * emits one delta per animation frame, so a component computing
         * `renderHeight + delta` drops every tick that lands before React
         * re-renders. Mirrors `resizeHeight`.
         */
        resizeCoverageHeight(distance: number) {
          setConf(
            self,
            'coverageHeight',
            clampBandHeight(
              self.coverageHeight,
              self.coverageHeight + distance,
            ),
          )
        },
        /**
         * #action
         */
        setShowConservation(arg: boolean) {
          setConf(self, 'showConservation', arg)
        },
        /**
         * #action
         */
        setConservationMode(arg: ConservationMode) {
          setConf(self, 'conservationMode', arg)
        },
        /**
         * #action
         */
        setRowIdentityMode(arg: RowIdentityModeWithOff) {
          setConf(self, 'rowIdentityMode', arg)
        },
        /**
         * #action
         */
        setRowIdentityAutoZoom(arg: boolean) {
          setConf(self, 'rowIdentityAutoZoom', arg)
        },
        /**
         * #action
         */
        setShowAnnotations(arg: boolean) {
          setConf(self, 'showAnnotations', arg)
        },
        /**
         * #action
         */
        setShowTranslation(arg: boolean) {
          setConf(self, 'showTranslation', arg)
        },
        /**
         * #action
         */
        setColorByChromosome(arg: boolean) {
          setConf(self, 'colorByChromosome', arg)
        },
        /**
         * #action
         */
        setShowInversions(arg: boolean) {
          setConf(self, 'showInversions', arg)
        },
        /**
         * #action
         */
        setConservationHeight(arg: number) {
          setConf(self, 'conservationHeight', arg)
        },
        /**
         * #action
         * Per-frame drag delta for the conservation band — see
         * `resizeCoverageHeight` for why this reads the height itself.
         */
        resizeConservationHeight(distance: number) {
          setConf(
            self,
            'conservationHeight',
            clampBandHeight(
              self.conservationHeight,
              self.conservationHeight + distance,
            ),
          )
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
      // The derived, self-releasing too-large banner is opt-in via
      // `byteGateEnabled` below: `fetchRegions` then measures the region set
      // before it downloads, and afterAttach clears the estimate on chromosome
      // nav. Byte-only — no density axis.
      .views(self => ({
        /**
         * #getter
         * The configured CDS-frame annotation adapter snapshot (UCSC `mafFrames`),
         * or undefined when unset. Read from the MAF *adapter* config as a swappable
         * sub-adapter (alongside `summaryAdapter`), not the display — a frozen slot,
         * so this is a plain snapshot the frames RPC hands straight to `getAdapter`.
         */
        get annotationAdapterConfig(): Record<string, unknown> | undefined {
          return (
            readConfObject(self.adapterConfig, 'annotationAdapter') ?? undefined
          )
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Whether the per-species CDS frame *strip* should draw: an annotation
         * adapter is configured and the "Show CDS frames" toggle is on. The codon
         * view consumes the same frames data but is gated separately (see
         * `annotationDataActive`), so the strip can be off while codon view is on.
         */
        get annotationsActive(): boolean {
          return self.showAnnotations && !!self.annotationAdapterConfig
        },
        /**
         * #getter
         * Whether the frames data needs to be fetched: an annotation adapter is
         * configured and either the strip or the codon view wants it. Gates the
         * frames RPC and keys the fetch cache so toggling *either* consumer on
         * triggers the fetch.
         */
        get annotationDataActive(): boolean {
          return (
            (self.showAnnotations ||
              self.showTranslation ||
              (self.showConservation && self.conservationMode === 'codon')) &&
            !!self.annotationAdapterConfig
          )
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
          return base
            ? filterRowsBySubtree(base, self.subtreeFilter)
            : undefined
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
            ...(s.assemblyName ? { assemblyName: s.assemblyName } : {}),
            ...(s.assemblyConfigLocation
              ? { assemblyConfigLocation: s.assemblyConfigLocation }
              : {}),
          }))
        },
        /**
         * #getter
         * Display row order shipped to the worker so its block `rowIndex` matches
         * the on-screen row. The alignment-fetch RPC argument only — deliberately
         * NOT the cache key, which keys on the user-controlled inputs behind this
         * instead (see `rpcProps`).
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
         * The anchor species whose `mafFrames` reading frame is used to translate
         * every row (UCSC `codonDefault`). Tied to the *reference assembly*, not
         * the top display row: every species' codon is compared against the
         * reference sequence (`block.refSeqBytes`), so the frame must be enumerated
         * from the reference's own frames. A row reorder (layout) can move a
         * non-reference species to row 0 — reading `sources[0]` there would
         * enumerate codons in the wrong frame. Falls back to the worker's canonical
         * first row (pre-reorder) when the reference isn't itself a listed sample.
         */
        get defaultCodonSpecies(): string | undefined {
          const refAssembly = self.lgv.assemblyNames[0]
          const rows = self.sourcesVolatile
          return rows.find(s => s.name === refAssembly)?.name ?? rows[0]?.name
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
         * Max CSS-px height the rows canvas may take before its backing store
         * (`× dpr`) hits the browser/GPU canvas limit. The single ceiling both the
         * fit-target sizing and the `rowHeight` cap respect.
         */
        get maxRowsHeight() {
          return MAX_CANVAS_DIM_PX / getDpr()
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The track height that fit-to-height mode divides among rows. Once the
         * user drags, the explicit `height` config slot wins; before any
         * drag we size to show every row at the default px height, so a typical
         * alignment looks exactly like fixed mode. Huge alignments are bounded by
         * the `rowHeight` cap, not here, so this needs no cap of its own.
         */
        get fitTargetHeight(): number {
          return (
            getConf(self, 'height') ??
            self.nrow * DEFAULTS.rowHeight + self.rowsTopOffset
          )
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
         * Resolved per-row height. `rowHeight === 0` is fit-to-height (rows
         * stretch to the dragged track height); any positive value is a pinned px
         * height. Every consumer reads this getter, never the raw `rowHeight`
         * property.
         *
         * Capped so the rows canvas backing store (`rowsHeight × dpr`) can never
         * exceed the browser/GPU max canvas size: a fixed px height across
         * hundreds of species would otherwise throw `Canvas exceeds max size`.
         * The cap shrinks rows to fit instead of crashing (or clipping); fit mode
         * already stays small so it never engages there. Bands have their own
         * small canvases, so the rows-only ceiling is the whole limit.
         */
        get effectiveRowHeight() {
          const raw = self.rowHeight === 0 ? self.autoRowHeight : self.rowHeight
          return Math.min(raw, self.maxRowsHeight / self.nrow)
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
          return self.sources
            ? self.sources.length * self.effectiveRowHeight
            : 1
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
          return computeClusterHierarchy(
            self.root,
            self.sources?.length ?? 0,
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
         * Seeds the `height` config slot from the current content height so toggling on
         * doesn't jump, then `rowHeight = 0` makes `effectiveRowHeight` derive
         * from it.
         */
        setFitToHeight() {
          // Seed from the current content height so toggling on never jumps,
          // even if a prior fixed-mode drag left a stale explicit height.
          setConf(self, 'height', Math.max(self.height, MIN_DISPLAY_HEIGHT))
          setConf(self, 'rowHeight', 0)
          self.scrollTop = 0
        },
        /**
         * #action
         * Drag-resize. In fit mode the new height drives `autoRowHeight` (rows
         * stretch). In fixed mode the pinned `rowHeight` scales proportionally
         * so dragging still resizes rows. Mirrors the variants display.
         *
         * The `resizing` flag that sits the letter overlay out of the drag is
         * set by the handle itself (TrackContainer / `MafBandResizeHandle`), not
         * here — this action sees only individual deltas and can't tell the last
         * one from the next, which is why it used to need a settle timer.
         */
        resizeHeight(distance: number) {
          const oldHeight = self.height
          const newHeight = Math.max(oldHeight + distance, MIN_DISPLAY_HEIGHT)
          setConf(self, 'height', newHeight)
          // Only the rows area scales on a drag; the stacked coverage/conservation
          // bands (`rowsTopOffset`) are a fixed inset that doesn't move. Scale the
          // pinned rowHeight by the *rows-area* ratio, not the full-height ratio —
          // otherwise the fixed bands make the dragged edge lag the cursor by
          // rowsTopOffset/height (~20% with the coverage band on). Mirrors the
          // variants display's available-height scaling.
          //
          // Scale `effectiveRowHeight`, never the raw slot: `oldHeight` reflects
          // the `maxRowsHeight` cap, so ratioing the (larger) uncapped slot
          // against it drifts the slot while the rows stay pinned — a dead
          // handle on species counts that reach the cap. Re-seeding from the
          // resolved height mirrors the fit-mode path.
          const oldRows = oldHeight - self.rowsTopOffset
          if (self.rowHeight > 0 && oldRows > 0) {
            setConf(
              self,
              'rowHeight',
              Math.max(
                1,
                (self.effectiveRowHeight * (newHeight - self.rowsTopOffset)) /
                  oldRows,
              ),
            )
          }
          return newHeight - oldHeight
        },
      }))
      .views(self => ({
        get spatialIndex() {
          return buildSpatialIndex(self.hierarchy)
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
         * Genomic bp the GPU encoder collapses into one cell. Zoomed in this is
         * `1` (encode every base). Once a base falls below half a CSS pixel the
         * per-base quads are individually invisible — a 500kb region across 10
         * species emits 1.7M of them into a 28MB buffer, all but ~15k of which
         * lose the sub-pixel race for their pixel — so the encoder decimates to
         * one sample per bin instead.
         *
         * Quantized to a power of two off the *debounced* `coarseBpPerPx` (the
         * same input `zoomedToBaseLevel` uses) for two reasons: the encode
         * autorun tracks this getter, so an unquantized read would re-encode
         * every region on every wheel tick, and a bin that stays put across a
         * zoom nudge keeps the picture stable. `binBp <= bpPerPx / 2` keeps a
         * bin under half a CSS pixel at every tier.
         */
        get encodeBinBp() {
          const view = self.lgv
          return view.initialized && view.coarseBpPerPx >= MIN_BINNED_BP_PER_PX
            ? 2 ** Math.floor(Math.log2(view.coarseBpPerPx / 2))
            : 1
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Render state passed to GPU/Canvas2D backend each frame. Uses the rows-
         * only height so the GPU canvas only paints the per-sample band; the
         * coverage band is drawn on a separate Canvas2D overlay above.
         */
        get renderState(): MafGPURenderState {
          const view = self.lgv
          // Resolved geometry, never undefined — every field is view/settings
          // derived and safe with zero sources (nrow floors at 1). "No fetch has
          // landed" is the render callback's first-paint gate (`hasFetched`), not
          // a nullable state: a sample-discovery track — no configured `samples`,
          // so rows come from whichever genomes appear in the region's blocks —
          // yields zero sources over a region with no alignment blocks, and
          // withholding a state there once the fetch completed kept the render
          // callback returning false, so `canvasDrawn` never flipped and the
          // loading overlay spun forever.
          return {
            canvasWidth: view.width,
            canvasHeight: self.rowsHeight,
            rowHeight: self.effectiveRowHeight,
            rowProportion: self.rowProportion,
            showAllLetters: self.showAllLetters,
            mismatchRendering: self.mismatchRendering,
            palette: self.colorPalette,
            binBp: self.encodeBinBp,
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
            binBp: self.encodeBinBp,
          }
        },
        /**
         * #method
         * Worker-fetch inputs that invalidate cached data when changed (tier-1,
         * via MultiRegionDisplayMixin's `SettingsInvalidate` autorun → refetch).
         *
         * The fetch argument that actually decides row placement is
         * `orderedSampleIds` (see `fetchMafAlignmentData`), but this keys on the
         * three *inputs* that produce it instead of on the value: `layout` order
         * and `subtreeFilter` are user-driven and already settled before the first
         * fetch, while `sampleSetGeneration` carries the one thing only the worker
         * can tell us — that the row set changed out from under already-fetched
         * rows.
         *
         * Keying on `orderedSampleIds` itself is what this replaces: it is
         * undefined until the first fetch lands and defined after, so the key
         * flipped on every track load and `SettingsInvalidate` threw away the
         * region that had just arrived — a measured 2 × `LinearMafGetAlignmentData`
         * per region, on the heaviest payload in the plugin. Loop-safe but not
         * free, which is exactly the case ARCHITECTURE.md's "rpcProps() must read
         * only user-controlled settings" is about. Pinned by
         * `singleFetchPerRegion.test.ts`.
         *
         * Reorder and subtree-filter changes still refetch, deliberately: the
         * worker assigns `rowIndex` from the order and scopes coverage/identity to
         * the set, so both have to go back through it.
         */
        rpcProps() {
          // `annotationDataActive` is a cache key so toggling the CDS-frame strip
          // *or* the codon view on triggers a refetch that populates
          // `framesDataMap` for the loaded regions (the frames piggyback on the
          // same fetch pass).
          return {
            // Names only, so relabelling or recoloring a row doesn't refetch; both
            // copied to plain arrays, since the key is a JSON string and an MST
            // node's serialization is not this module's to depend on.
            layoutOrder: self.layout.map(row => row.name),
            subtreeFilter: self.subtreeFilter?.slice(),
            sampleSetGeneration: self.sampleSetGeneration,
            annotationDataActive: self.annotationDataActive,
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
         * Where `rowIndex` sits in its own genome across the reference bp range
         * `[startBp, endBp)` — the locus a "open this species here" navigation
         * targets. Undefined when the row has no aligned base in the range, when
         * no fetched block covers it, or when the row's genome isn't loaded as
         * an assembly (`Sample.assemblyName` unset), since there is then nowhere
         * to navigate to.
         */
        rowNavigationTarget(
          displayedRegionIndex: number,
          startBp: number,
          endBp: number,
          rowIndex: number,
        ) {
          const { sources } = self
          const source =
            sources && rowIndex >= 0 && rowIndex < sources.length
              ? sources[rowIndex]!
              : undefined
          const region = source?.assemblyName
            ? self.rpcDataMap.get(displayedRegionIndex)
            : undefined
          const span = region
            ? findRowSpan(region, startBp, endBp, rowIndex)
            : undefined
          return span && source?.assemblyName
            ? {
                ...span,
                assemblyName: source.assemblyName,
                assemblyConfigLocation: source.assemblyConfigLocation,
                sampleLabel: source.label ?? source.name,
              }
            : undefined
        },
        /**
         * #method
         * The CDS frame record covering absolute genomic `bp` (uint32) on display
         * `rowIndex`, or undefined when no frame overlaps there (or no frames data
         * is loaded). Gated on `annotationDataActive` not the strip toggle, so the
         * gene name still reads on hover in codon view with the strip off. The
         * species is matched by the same `src`→row projection the overlay draws
         * with, so the tooltip and the strip can't disagree about which row a gene
         * is on.
         */
        frameHoverInfo(
          displayedRegionIndex: number,
          bp: number,
          rowIndex: number,
        ) {
          if (!self.annotationDataActive) {
            return undefined
          }
          const hit = findFrameAt(
            self.framesDataMap.get(displayedRegionIndex),
            Math.floor(bp),
            rowIndex,
            self.rowIndexBySrc,
          )
          return hit ? { name: hit.name } : undefined
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
      .views(self => {
        // The block-overlay helpers all take this same bundle. Centralizing it
        // keeps every overlay on the *resolved* row height — a new overlay that
        // spelled out its own params could quietly read the raw `rowHeight`
        // sentinel and mis-place its markers in fit-to-height mode.
        const overlayParams = () => ({
          view: self.lgv,
          rpcDataMap: self.rpcDataMap,
          rowHeight: self.effectiveRowHeight,
          rowProportion: self.rowProportion,
        })
        // Every rows overlay is a full per-cell scan of the visible blocks, and
        // with `showAlignments` off the rows area is 0 px tall — so gate them all
        // here rather than let each one scan for a layer nothing paints.
        const rowsVisible = () => self.lgv.initialized && self.showAlignments
        return {
          /**
           * #getter
           * Positioned bridge-line segments for `e`-line (empty/bridged) rows.
           */
          get visibleEmptyLines() {
            return rowsVisible()
              ? computeVisibleEmptyLines(overlayParams())
              : []
          },
          /**
           * #getter
           * Positioned insertion markers (interbase) for the visible aligned rows.
           */
          get visibleInsertions() {
            return rowsVisible()
              ? computeVisibleInsertions(overlayParams())
              : []
          },
          /**
           * #getter
           * Positioned deletion runs for the visible aligned rows; the overlay draws
           * the deleted-base count inside each run when it fits.
           */
          get visibleDeletions() {
            return rowsVisible() ? computeVisibleDeletions(overlayParams()) : []
          },
          /**
           * #getter
           * Positioned strand-flip (inversion) markers for the visible aligned rows.
           * Empty unless the indicator is toggled on.
           */
          get visibleInversions() {
            return rowsVisible() && self.showInversions
              ? computeVisibleInversions(overlayParams())
              : []
          },
        }
      })
      .views(self => ({
        /**
         * #getter
         * Use the cheap summary path when a `bigMafSummary` sub-adapter is
         * configured and the view is zoomed out past the force-load threshold —
         * exactly where the full alignment fetch would be blocked by the byte
         * gate. Tracks without a summary never enter this path.
         *
         * `aboveForceLoadFloor` is the gate's own comparison against that
         * threshold (`RegionTooLargeMixin`), read rather than restated so the swap
         * and the gate can't end up disagreeing about where the floor is. It
         * deliberately excludes the opt-in terms, which is what keeps this from
         * being a cycle — `byteGateEnabled` below is false while we summarize.
         */
        get showSummary() {
          return (
            !!readConfObject(self.adapterConfig, 'summaryAdapter') &&
            self.aboveForceLoadFloor
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
         * The codon view is on: the toggle is set, frame data is available to
         * define the reading frame, and we're zoomed to base level (so codons are
         * meaningful) and not in the cheap summary path. When active it replaces
         * the per-base SNP rendering with per-codon change coloring.
         */
        get codonViewActive(): boolean {
          return (
            self.showTranslation &&
            !!self.annotationAdapterConfig &&
            self.zoomedToBaseLevel &&
            !self.showSummary
          )
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Single source of truth for what the per-sample rows area draws right now:
         * `bases` (the GPU SNP/base coloring), `codon` (per-codon change coloring
         * from `mafFrames`), `sourceChrom` (color-by-source-chromosome SV mode), or
         * a per-row identity style (`heatmap` / `xyplot`). Codon view takes
         * precedence when on, then color-by-chromosome (an explicit SV toggle, but
         * not in the cheap summary path which carries no per-row chr); otherwise,
         * with `rowIdentityAutoZoom` (default) it emulates UCSC `wigMaf` — bases at
         * base level, the identity plot when zoomed out; with auto off the selected
         * mode is pinned. The GPU canvas, the identity/chromosome canvases, the
         * codon overlay, and SVG export all branch on this one getter so they can't
         * disagree about what's on screen.
         */
        get activeRowRendering():
          | 'bases'
          | 'codon'
          | 'sourceChrom'
          | RowIdentityMode {
          if (self.codonViewActive) {
            return 'codon'
          }
          if (self.colorByChromosome && !self.showSummary) {
            return 'sourceChrom'
          }
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
         * Positioned per-base SNP/sequence letters. Suppressed in any non-base
         * rendering (the identity plot and codon view both replace the letters).
         */
        get visibleLabels() {
          const view = self.lgv
          // Suppressed in any non-base rendering (identity plot / codon view both
          // replace the per-base letters).
          if (
            !view.initialized ||
            !self.showAlignments ||
            !self.sources ||
            self.resizing ||
            self.activeRowRendering !== 'bases'
          ) {
            return []
          }
          return computeVisibleLabels({
            view,
            rpcDataMap: self.rpcDataMap,
            rowHeight: self.effectiveRowHeight,
            rowProportion: self.rowProportion,
            showAllLetters: self.showAllLetters,
            showAsUpperCase: self.showAsUpperCase,
          })
        },
        /**
         * #getter
         * Positioned per-species presence bars for the zoom-out summary overlay.
         * Empty unless `showSummary` is active. Unmatched `src` rows drop via the
         * `sources` index, keeping the render robust to summary files that list
         * extra species.
         */
        get visibleSummaryBars() {
          const view = self.lgv
          if (!self.showSummary || !self.showAlignments || !self.sources) {
            return []
          }
          return computeVisibleSummaryBars({
            view,
            summaryDataMap: self.summaryDataMap,
            rowIndexBySrc: self.rowIndexBySrc,
            rowHeight: self.effectiveRowHeight,
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
          if (
            !view.initialized ||
            !self.showAlignments ||
            !self.annotationsActive ||
            !self.sources
          ) {
            return []
          }
          return computeVisibleAnnotations({
            view,
            framesDataMap: self.framesDataMap,
            rowIndexBySrc: self.rowIndexBySrc,
            rowHeight: self.effectiveRowHeight,
            rowProportion: self.rowProportion,
          })
        },
        /**
         * #getter
         * The codon overlay is what the rows area is painting.
         */
        get codonCellsActive() {
          return (
            self.lgv.initialized &&
            self.showAlignments &&
            self.activeRowRendering === 'codon' &&
            !!self.defaultCodonSpecies
          )
        },
        /**
         * #getter
         * The conservation band is in per-codon (amino-acid identity) mode, with
         * frames to define codons and per-base blocks to translate — the cheap
         * summary path ships neither.
         */
        get codonConservationActive() {
          return (
            self.lgv.initialized &&
            self.showConservation &&
            self.conservationMode === 'codon' &&
            !!self.annotationAdapterConfig &&
            !self.showSummary &&
            !!self.defaultCodonSpecies
          )
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Every reference codon the fetched blocks resolve, in the anchor species'
         * reading frame — the shared spine of the codon cells and the codon
         * conservation band. A memoized computed rather than a call inside each
         * consumer: the resolution (enumerate the anchor's codons, index every
         * block's reference columns, locate each codon) is the expensive half, and
         * with both modes on it used to run twice per frame. Empty when neither
         * consumer is active, so a track with codon view off pays nothing.
         */
        get locatedCodons(): LocatedCodon[] {
          const src = self.defaultCodonSpecies
          return (self.codonCellsActive || self.codonConservationActive) &&
            src !== undefined
            ? locateVisibleCodons({
                view: self.lgv,
                rpcDataMap: self.rpcDataMap,
                framesDataMap: self.framesDataMap,
                defaultSrc: src,
              })
            : []
        },
        /**
         * #getter
         * Each row's source chromosomes ranked by aligned bp (`perRowChromRanks`).
         * A memoized computed for the same reason as `locatedCodons` above: the
         * rank walk covers every block × row of every visible region, and it had
         * two independent callers — the legend (already a cached computed) and
         * `drawSourceChrom`, which recomputed it inside a draw that re-fires on
         * every pan and zoom.
         *
         * Also makes the "rank over the same region set" guarantee structural.
         * The legend walked `dynamicBlocks.contentBlocks` while the painter walked
         * `renderBlocks`; those agree today (the latter derives from the former,
         * and only `displayedRegionIndex` is read), but nothing held them to it.
         * Empty when the mode is off, so a track that never colors by chromosome
         * pays nothing.
         */
        get sourceChromRanks(): ReturnType<typeof perRowChromRanks> {
          return self.activeRowRendering === 'sourceChrom'
            ? perRowChromRanks(
                uniqueRegionsFromBlocks(self.renderBlocks, self.rpcDataMap),
              )
            : { ranks: new Map<number, Map<string, number>>(), maxRank: 0 }
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Per-species codon cells for the codon view (the per-codon change
         * coloring that replaces the SNP cells). Empty unless codon view is the
         * active rendering and an anchor species is known.
         */
        get visibleCodons(): CodonMarker[] {
          return self.codonCellsActive
            ? computeVisibleCodons(self.locatedCodons, {
                rowHeight: self.effectiveRowHeight,
                rowProportion: self.rowProportion,
              })
            : []
        },
        /**
         * #getter
         * Per-codon amino-acid conservation bars for the conservation band's codon
         * mode. Draws only inside the CDS (where frames define codons); everywhere
         * else the band is blank.
         */
        get visibleCodonConservation(): CodonConservationBar[] {
          const refAssembly = self.lgv.assemblyNames[0]
          return self.codonConservationActive
            ? computeCodonConservation(self.locatedCodons, {
                // Exclude the *reference assembly's* row (matching the per-base
                // band's worker-side `refRowIndex`), not the anchor's:
                // `defaultCodonSpecies` falls back to row 0 when the reference
                // isn't a listed sample, which would wrongly drop a real species
                // from the denominator. `-1` when the reference isn't a visible
                // row.
                refRowIndex:
                  refAssembly === undefined
                    ? -1
                    : (self.rowIndexBySrc.get(refAssembly) ?? -1),
              })
            : []
        },
        /**
         * #getter
         * The color key for whatever `activeRowRendering` is painting, or empty
         * where the rendering needs no key (plain bases). One getter rather than
         * a component per mode, because both the on-screen legend and the SVG
         * export read it — an exported codon or source-chromosome figure whose
         * swatches are its only decoder used to ship with no key at all.
         *
         * Source-chromosome coloring is by each row's per-row chromosome RANK
         * (see `perRowChromRanks`), not by chromosome name, so its key is this
         * short fixed scheme rather than a per-scaffold rainbow: one entry per
         * rank actually present in view, and a lone "Main chromosome" entry
         * means nothing rearranges here.
         */
        get legendItems(): { label: string; color?: string }[] {
          const view = self.lgv
          if (!view.initialized) {
            return []
          }
          const rendering = self.activeRowRendering
          if (rendering === 'codon') {
            const { palette } = getSession(self).theme
            return [
              { label: 'Nonsynonymous', color: palette.codonNonsynonymous },
              { label: 'Synonymous', color: palette.codonSynonymous },
              { label: 'Stop', color: palette.codonStop },
            ]
          }
          if (rendering === 'sourceChrom') {
            const { maxRank } = self.sourceChromRanks
            return Array.from({ length: maxRank + 1 }, (_, rank) => ({
              label: sourceChromRankLabel(rank),
              color: sourceChromRankColor(rank),
            }))
          }
          if (rendering === 'heatmap' || rendering === 'xyplot') {
            // Endpoints of the same ramp the rows are painted with, so the
            // swatches match the rendering exactly. The color-less first entry
            // names the metric, without which the ramp is ambiguous.
            return [
              { label: 'Per-base identity to reference' },
              { label: 'Conserved (base matches)', color: identityRgb(1) },
              { label: 'Divergent (base differs)', color: identityRgb(0) },
            ]
          }
          return []
        },
        /**
         * #method
         * The codon under the cursor on display `rowIndex` at absolute genomic
         * `bp`, when the codon view is the active rendering: the species' codon +
         * amino acid, the reference codon + amino acid, and the syn/nonsyn/stop
         * classification. Reads the memoized `locatedCodons` the colored cells are
         * drawn from, so the tooltip and the cell can't disagree and a mousemove
         * costs a scan rather than a fresh codon resolution pass. Undefined off
         * codon view or where no codon covers the row there.
         */
        codonHoverInfo(
          displayedRegionIndex: number,
          bp: number,
          rowIndex: number,
        ) {
          return self.activeRowRendering === 'codon'
            ? findCodonAt({
                codons: self.locatedCodons,
                displayedRegionIndex,
                bp: Math.floor(bp),
                rowIndex,
              })
            : undefined
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
        // canvas paints nothing under the summary overlay.
        //
        // Deliberately one-directional: there is no twin on the alignment path.
        // `summaryDataMap` is what `isCacheValid` tests in summary mode, so
        // keeping it through a zoom-in is exactly what lets the zoom back out
        // reuse the cache instead of re-reading the summary adapter. It doesn't
        // accumulate either — it only ever holds the buffered regions of the
        // current chromosome, since `clearDisplaySpecificData` empties it on
        // chromosome nav and on any settings invalidation.
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
              // The render callback below draws no blocks unless the rows area
              // is in `bases` mode — the identity plot, codon view and
              // color-by-chromosome all paint the rows on sibling canvases.
              // Encoding anyway built and uploaded a buffer (tens of MB on a
              // wide region) that never reached a pixel. An empty payload skips
              // the encode *and* releases the GPU buffer (uploadRegion routes
              // count 0 to deleteRegion); the autorun stays subscribed, so
              // flipping back to `bases` re-encodes immediately.
              if (self.activeRowRendering !== 'bases') {
                return { instanceBuffer: new Uint32Array(0), instanceCount: 0 }
              }
              const { buffer, count } = buildInstanceBuffer({
                blocks: regionData.blocks,
                ...self.gpuProps(),
              })
              return { instanceBuffer: buffer, instanceCount: count }
            },
            b => {
              // First-paint gate: no fetch has landed yet, so skip the tick
              // rather than flipping canvasDrawn on an empty frame. Zero sources
              // over a loaded region is NOT this state — see renderState.
              const hasFetched = !!self.sources || self.loadedRegions.size > 0
              if (hasFetched) {
                if (self.activeRowRendering === 'bases') {
                  return b.renderBlocks(
                    self.renderBlocks,
                    self.rpcDataMap,
                    self.renderState,
                  )
                } else {
                  // Zoomed out the identity plot owns the visible rows, on a
                  // sibling canvas. Render no blocks so this canvas clears to
                  // transparent and the identity one shows through — a cleared
                  // frame nothing painted into, but still a real paint for
                  // canvasDrawn, since the rows the user sees did get drawn.
                  b.renderBlocks([], self.rpcDataMap, self.renderState)
                  return true
                }
              } else {
                return false
              }
            },
          )
        },
      }))
      .actions(self => ({
        fetchNeeded(
          needed: { region: Region; displayedRegionIndex: number }[],
        ) {
          // Zoom-out with a configured summary → cheap per-species summary rows;
          // otherwise the full alignment fetch (subject to the byte gate below).
          return self.showSummary
            ? fetchMafSummaryData(self, needed)
            : fetchMafAlignmentData(self, needed)
        },
      }))
      .views(self => ({
        /**
         * #method
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
         * #getter
         * Enable byte-estimate gating: above ~20kb visible, the adapter's
         * MAF-aware byte estimate (per-species sequence × span) is checked against
         * `fetchSizeLimit`, blocking the detail fetch with a force-load prompt
         * rather than downloading hundreds of species' bases at genome scale.
         *
         * Off in summary mode — the summary read is cheap (zoom-reduced BigBed),
         * so it must never be blocked by the gate.
         */
        get byteGateEnabled() {
          return !self.showSummary
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
        // No superAfterAttach() call: @jbrowse/mobx-state-tree auto-chains hooks,
        // so MultiRegionDisplayMixin's afterAttach already runs (see
        // afterAttachAutoChain.test.ts). Calling it explicitly would double-install
        // the mixin's fetch autoruns.
        async afterAttach() {
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
      }))
      .postProcessSnapshot(snap => {
        // The active clusterTree is derived (rebuilt from worker output on fetch,
        // or restored from treeNewickVolatile on clear), so it's dropped rather
        // than persisted. `layout` IS persisted — it's the user's custom row
        // arrangement; stripDefault omits it when empty (the common case).
        const { clusterTree: _clusterTree, ...rest } = snap
        return rest
      })
  )
}

export type LinearMafDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearMafDisplayModel = Instance<LinearMafDisplayStateModel>
