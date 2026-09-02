import {
  buildCoverageTooltipBin,
  computeCoverageTicks,
  computeVisibleCoverageStats,
} from '@jbrowse/alignments-core'
import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { withHint } from '@jbrowse/core/ui/menuItems'
import {
  assembleLocString,
  getContainingView,
  getPaletteHost,
  getSession,
} from '@jbrowse/core/util'
import {
  MIN_BAND_HEIGHT,
  boundBandHeight,
  clampBandHeight,
} from '@jbrowse/core/util/bandHeight'
import { stackBands } from '@jbrowse/core/util/bandLayout'
import { copyText } from '@jbrowse/core/util/copyText'
import { deepEqual } from '@jbrowse/core/util/deepEqual'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { MIN_DISPLAY_HEIGHT } from '@jbrowse/display-kit/const'
import { subPixelBinBp } from '@jbrowse/display-kit/subPixelBinBp'
import { types } from '@jbrowse/mobx-state-tree'
import { maxCanvasCssPx } from '@jbrowse/render-core/canvas2dUtils'
import { coverageBandBuffers } from '@jbrowse/render-core/coverageBandBuffers'
import { installUpload } from '@jbrowse/render-core/installUpload'
import { namedAutorun } from '@jbrowse/render-core/namedReactions'
import { regionDataMap } from '@jbrowse/render-core/regionDataMap'
import {
  ContextMenuMixin,
  RowHeightMixin,
  TreeSidebarMixin,
  buildSpatialIndex,
  computeClusterHierarchy,
  filterRowsBySubtree,
  loadedRegionIndexAt,
  reconcileLayout,
  resetRowOrderMenuItems,
  setupTreeSidebarAutoruns,
  sortRowsHereMenuItem,
} from '@jbrowse/tree-sidebar'
import { visibleStatsDomain } from '@jbrowse/wiggle-core'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'

import {
  getMafCoverageColors,
  packMafCoverageColors,
} from '../LinearMafRenderer/coverageBandColors.ts'
import { buildInstanceBuffer } from '../LinearMafRenderer/mafInstanceBuffer.ts'
import {
  getCodonLegendItems,
  getFrameLegendItems,
  getMafColorPalette,
} from '../LinearMafRenderer/util.ts'
import { navigationFields } from '../util/navigationFields.ts'
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
import {
  computeVisibleInversions,
  consensusStrandByRowChr,
} from './components/computeVisibleInversions.ts'
import { computeVisibleLabels } from './components/computeVisibleLabels.ts'
import { computeVisibleSummaryBars } from './components/computeVisibleSummaryBars.ts'
import { identityLegendItems } from './components/drawRowIdentity.ts'
import {
  perRowChromRanks,
  sourceChromLegendItems,
} from './components/drawSourceChrom.ts'
import { findRowHoverAtBp } from './components/findRowHover.ts'
import { findRowSpans } from './components/findRowSpan.ts'
import { coverageInsertionAt, coverageSnpSnap } from './coverageInsertion.ts'
import { DEFAULTS } from './displayDefaults.ts'
import { fetchMafAlignmentData, fetchMafSummaryData } from './fetchMafData.ts'
import { mafLaunchMenuItems } from './launchMenuItems.ts'
import { openInsertionWidget } from './openInsertionWidget.ts'
import { orderMafRowsByBaseAt } from './orderMafRowsByBaseAt.ts'
import { placeMafRegionData } from './placeMafRows.ts'
import { isRowIdentityMode } from './rowIdentityModes.ts'
import {
  ZOOM_IN_FOR_BAND,
  buildMafTrackMenuItems,
  zoomGatedItem,
} from './trackMenuItems.ts'
import { getMsaHighlights } from './util.ts'

import type {
  MafCoverageBandState,
  MafGPURenderState,
  MafGpuProps,
  MafRegionData,
  MafRenderingBackend,
  MafWireRegionData,
} from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafColorPalette } from '../LinearMafRenderer/util.ts'
import type { MafFrameRecord, MafSummaryRecord, Sample } from '../types.ts'
import type { FrameMarker } from './components/computeVisibleAnnotations.ts'
import type {
  CodonConservationBar,
  CodonMarker,
  LocatedCodon,
} from './components/computeVisibleCodons.ts'
import type { StrandConsensus } from './components/computeVisibleInversions.ts'
import type { HoverBp } from './components/findRowHover.ts'
import type { RowSpan } from './components/findRowSpan.ts'
import type { MafRowGeometryParams } from './components/visibleRegionGeometry.ts'
import type {
  LinearMafDisplayConfig,
  LinearMafDisplayConfigModel,
} from './configSchema.ts'
import type { ConservationMode } from './conservationModes.ts'
import type {
  RowIdentityMode,
  RowIdentityModeWithOff,
} from './rowIdentityModes.ts'
import type { RowRendering } from './rowRenderings.ts'
import type { MafHover } from './util.ts'
import type { ContextMenuAnchor, LegendItem, MenuItem } from '@jbrowse/core/ui'
import type { UriLocation } from '@jbrowse/core/util'
import type { BandBounds } from '@jbrowse/core/util/bandHeight'
import type { IndexedRegion } from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { RowSource } from '@jbrowse/tree-sidebar'

/**
 * One species row. `RowSource` is the shared vocabulary every display with a
 * dendrogram sidebar draws rows by; this adds the two navigation fields only
 * MAF has.
 *
 * The adapter's `samples[].color` slot lands on **`labelColor`**, the name the
 * sidebar tints with, because that is the only thing MAF ever does with it —
 * nothing here paints a row in it. It used to be carried as `color` and
 * translated by a `labelSources` computed, which existed because
 * `RowLabelSource` is satisfied structurally: handing `sources` straight to the
 * sidebar type-checked and dropped the tint in silence, which is how the slot
 * came to be documented in three adapter schemas while reaching no renderer at
 * all. Naming it what it is removes the translation and the trap together.
 */
export interface MafSource extends RowSource {
  /** assembly this row's genome is loaded as, when it is navigable */
  assemblyName?: string
  /** config to load that assembly from, when the session lacks it */
  assemblyConfigLocation?: UriLocation
}

// What a right-click on the rows resolves to: the reference column the menu's
// sort and copy act on, plus whatever the click landed on — the same hit the
// tooltip shows, resolved once here so an item acting on it does not have to
// re-run the hit test against an anchor the menu has since closed.
export interface MafContextMenuInfo extends ContextMenuAnchor {
  refName: string
  pos: number
  hover?: MafHover
}

/**
 * Merge a newly discovered row set into the known one, keeping first-seen order
 * and letting the newer entry supply label/color. Used for sample-discovery
 * tracks, where each region names only the genomes its own blocks contain — see
 * `setSamples`.
 */
function unionSources(
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
      // #region compose
      .compose(
        'LinearMafDisplay',
        BaseDisplay,
        TrackHeightMixin(),
        MultiRegionDisplayMixin(),
        RowHeightMixin(),
        TreeSidebarMixin<MafSource>(),
        ContextMenuMixin<MafContextMenuInfo>(),
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
      // #endregion
      .volatile(() => ({
        /**
         * #volatile
         * Rows as the worker sent them: named by species, with no screen
         * position. `rpcDataMap` is this placed against the current row order,
         * and this is what a reorder re-places from instead of refetching.
         */
        wireDataMap: regionDataMap<MafWireRegionData>('wireDataMap'),
        /**
         * #volatile
         * `wireDataMap` with every row assigned its on-screen `rowIndex` (see
         * `placeMafRegionData`). Everything that draws, hit-tests or measures
         * rows reads this one.
         */
        rpcDataMap: regionDataMap<MafRegionData>('rpcDataMap'),
        /**
         * #volatile
         * Per-region `bigMafSummary` rows for the zoom-out path, populated by
         * `fetchMafSummaryData` only while `showSummary` is active. Kept separate
         * from `rpcDataMap` so the GPU sequence canvas and the summary overlay
         * never read each other's data.
         */
        summaryDataMap: regionDataMap<MafSummaryRecord[]>('summaryDataMap'),
        /**
         * #volatile
         * Per-region CDS frame rows (UCSC `mafFrames`) for the annotation overlay,
         * populated by the frames RPC in parallel with the main fetch. Kept
         * separate from the alignment/summary maps so the overlay survives the
         * summary↔detail data swap.
         */
        framesDataMap: regionDataMap<MafFrameRecord[]>('framesDataMap'),
        /**
         * #volatile
         * The last frames fetch declined to read the `annotationAdapter`
         * because the `byteLimit` it carried refused the region. The overlay is
         * auxiliary and fails soft, so the only thing that happens is that the
         * strip stops drawing — this is what lets the menu say so rather than
         * leaving the tick on over nothing.
         *
         * Volatile and not a config slot: it describes a measurement of the
         * current viewport, not a setting. **Never in `rpcProps()`** — it is
         * written by the fetch, which is the loop trap ARCHITECTURE.md names.
         */
        framesGateBlocked: false,
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
      }))
      .views(self => ({
        get view() {
          return getContainingView(self) as LinearGenomeViewModel
        },
        /**
         * #getter
         * Offset the track label above the plot rather than overlapping it.
         * Always true here: a MAF display draws a left y-axis gutter for its
         * conservation and coverage bands, and an overlapping label would sit on
         * top of it.
         *
         * A getter, not a setterless volatile, because nothing sets it — the
         * wiggle, variants, GWAS and alignments displays all answer this hook
         * the same way, several of them conditionally.
         */
        get prefersOffset() {
          return true
        },
        /**
         * #getter
         * The legal range for a band height that is *stated* — by a config, a
         * session snapshot or a menu — rather than dragged. Undefined when the
         * track height is itself derived from the bands, where they cannot
         * overflow a height they are a term of.
         *
         * `fitTargetHeight` is unavailable to this: it reads `rowsTopOffset`,
         * which is the band fold.
         */
        get statedBandBounds(): BandBounds | undefined {
          const configuredHeight = getConf(self, 'height')
          return configuredHeight === undefined
            ? undefined
            : {
                min: 0,
                max: Math.max(
                  MIN_BAND_HEIGHT,
                  configuredHeight - MIN_BAND_HEIGHT,
                ),
              }
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
         * already known (`unionSources`). Replacing there dropped rows: a genome
         * only one region aligns would stop having a row the moment another
         * region reported its own set, and a region with no blocks at all (or
         * the summary path, which never discovers) names none and so blanked
         * every row.
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
         * A set that *changes* after one was already established invalidates
         * nothing: the fetched rows name their species rather than a row index,
         * so the placement autorun re-places them against the widened order and
         * they are correct again without a refetch. This used to bump a
         * `sampleSetGeneration` counter into `rpcProps()`, from a design where
         * the worker narrowed each region's blocks to the client's sample list
         * and so genuinely lost rows it had not been told about. It no longer
         * takes one — the row set is config-derived or discovered per region in
         * the worker, and the only thing the client sends is `subtreeFilter` —
         * so the counter had become a pure refetch of every loaded region, once
         * per newly seen genome, on exactly the discovery tracks that can least
         * afford it.
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
            labelColor: s.color,
            ...navigationFields(s),
          }))
          const next = samplesCanonical
            ? incoming
            : unionSources(self.sourcesVolatile, incoming)
          if (!deepEqual(next, self.sourcesVolatile)) {
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
          setConf(
            self,
            'coverageHeight',
            boundBandHeight(arg, self.statedBandBounds),
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
          setConf(
            self,
            'conservationHeight',
            boundBandHeight(arg, self.statedBandBounds),
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
      }))
      .views(self => ({
        /**
         * #getter
         * Which sample row IS the reference — the worker's own answer
         * (`referenceSampleId`, resolved from the block whose sequence the row
         * carries), with the view's assembly name as the fallback before any
         * region has landed.
         *
         * The view's assembly name is only coincidentally the MAF's name for
         * the reference: a MAF-tabix track sets `refAssemblyName` on the
         * adapter precisely when the two differ, and a bigMaf/TAF file names
         * its reference by whatever db name it was built with. Reading it here
         * rather than in each consumer is what keeps the codon conservation
         * band's excluded row and the per-base band's (computed in the worker)
         * the same row.
         *
         * Any loaded region answers — a track has one reference species — so
         * this takes the first that names one.
         */
        get referenceSampleId(): string | undefined {
          for (const region of self.rpcDataMap.values()) {
            if (region.refSampleId !== undefined) {
              return region.refSampleId
            }
          }
          return self.view.assemblyNames[0]
        },
      }))
      // The derived, self-releasing too-large banner is opt-in via
      // `gateEnabled` below: the tier's own RPC then measures the file it is
      // about to read before it downloads, and afterAttach clears the estimate
      // on chromosome nav. Byte-only — no density axis.
      .views(self => ({
        /**
         * #getter
         * The configured CDS-frame annotation adapter snapshot (UCSC `mafFrames`),
         * or undefined when unset. Read from the MAF *adapter* config as a swappable
         * sub-adapter (alongside `summaryAdapter`), not the display — a frozen slot,
         * so this is a plain snapshot the frames RPC hands straight to `getAdapter`.
         *
         * Read with an array slot path off the **live** parent track, not as
         * `readConfObject(self.adapterConfig, …)`. `adapterConfig` is itself a
         * snapshot, and a slot read against a snapshot is the case
         * `core/configuration/CLAUDE.md` warns about: `types.stripDefault` omits a
         * slot sitting at its default, so the read reports a defaulted slot as
         * absent. Harmless for these two — they default to null and are only
         * tested for presence — but the array path costs nothing and doesn't
         * depend on that staying true.
         */
        get annotationAdapterConfig(): Record<string, unknown> | undefined {
          return (
            getConf(self.parentTrack, ['adapter', 'annotationAdapter']) ??
            undefined
          )
        },
        /**
         * #getter
         * The configured `bigMafSummary` sub-adapter snapshot, or undefined when
         * unset. Same journey as `annotationAdapterConfig`.
         *
         * Declared here, beside its sibling, so `showSummary` has one place to
         * ask whether the tier exists. The gate reaches the same slot through
         * `byteGateAdapterPath` rather than through this getter, since it needs
         * the path anyway to read the tier's own budget.
         */
        get summaryAdapterConfig(): Record<string, unknown> | undefined {
          return (
            getConf(self.parentTrack, ['adapter', 'summaryAdapter']) ??
            undefined
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
         * Empty until the first fetch populates the worker set; `sourcesKnown`
         * is the readiness question.
         *
         * The shared `reconcileLayout`, same as multi-row features and
         * multi-wiggle. Its append half matters here: a sample-discovery track
         * learns of a genome only from the region whose blocks contain it (see
         * `setSamples` / `unionSources`), and the hand-rolled merge this
         * replaced iterated `layout` alone — so with any custom arrangement
         * saved, a species revealed by a later region never got a row at all.
         */
        get editableSources(): MafSource[] {
          return reconcileLayout(self.sourcesVolatile, self.layout)
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The display rows: `editableSources` narrowed to the selected subtree.
         *
         * **Resolved — an array, never `undefined`**, the shared spelling across
         * the row displays. The two consumers that used to read the absent case
         * were both asking "has the species list arrived", which is
         * `sourcesKnown`; everything else already collapsed it with `?.length`
         * or `?? 0`. An empty array reaches here two ways that must stay
         * indistinguishable to a *renderer* — no fetch yet, and a subtree filter
         * that matched nothing — which is exactly why the readiness question
         * needs its own name rather than a truthiness test on this.
         */
        get sources(): MafSource[] {
          return filterRowsBySubtree(self.editableSources, self.subtreeFilter)
        },

        /**
         * #getter
         * The species list has arrived from the adapter. The readiness half of
         * what `sources` used to answer by being `undefined`: `rowsVisible` and
         * the render callback's first-paint gate both need "a fetch has landed",
         * and neither can get it from an empty `sources`, which a subtree filter
         * narrowing to nothing also produces.
         */
        get sourcesKnown(): boolean {
          return self.sourcesVolatile.length > 0
        },

        /**
         * #getter
         * `subtreeFilter` as the worker sees it: a **set**, sorted, and a plain
         * array. The one expression both the RPC payload (`fetchMafData`) and
         * the cache key (`rpcProps`) read, so the bytes sent and the key they
         * are cached under cannot drift apart.
         *
         * Sorted because the key is a JSON string while the worker consumes the
         * value as `new Set(...)` and places rows by species name — so order is
         * unobservable to the fetch but would still move the key. Re-picking the
         * same clade after a re-cluster hands `setSubtreeFilter` the same names
         * in the tree's new leaf order, which refetched every loaded region for
         * identical data. ARCHITECTURE.md §"Row order is not a fetch input".
         *
         * Copied out of the MST node for the same reason: the key is a JSON
         * string and an MST node's serialization is not this module's to depend
         * on.
         */
        get subtreeFilterSet(): string[] | undefined {
          const filter = self.subtreeFilter
          return filter?.length ? [...filter].sort() : undefined
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Use the cheap summary path when a `bigMafSummary` sub-adapter is
         * configured and the view is zoomed out past the force-load threshold,
         * which is where the detail fetch stops being affordable at all. Tracks
         * without a summary never enter this path.
         *
         * `aboveForceLoadFloor` is the gate's own comparison against that
         * threshold (`RegionTooLargeMixin`), read rather than restated so the swap
         * and the gate can't end up disagreeing about where the floor is. It
         * deliberately excludes the opt-in terms, which is what keeps this from
         * being a cycle — everything below that reads this getter
         * (`byteGateAdapterPath`) sits downstream of the floor, never upstream.
         *
         * The swap point is 20kb and stays there even though the byte gate has no
         * floor at all any more: where the summary tier starts being the better
         * *picture* is a rendering question, and where the detail fetch gets too
         * expensive is a bytes question. They coincided before only because the
         * gate had nothing to say below 20kb. `aboveForceLoadFloor` survives for
         * this and for the density axis; nothing else compares against 20kb.
         *
         * Declared this early in the chain — well before the fetch and rendering
         * getters that are its obvious neighbours — because the band layout
         * below needs it: `coverageBandActive` is what zeroes the band's height,
         * and `rowsTopOffset` (and the whole height cascade under it) is
         * resolved long before here. Both its inputs come off the compose, so
         * there is nothing to order it after.
         */
        get showSummary() {
          return !!self.summaryAdapterConfig && self.aboveForceLoadFloor
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The coverage band is on *and* has data to put in it.
         *
         * `showCoverage` is the user's setting — the menu ticks it, a config
         * sets it — but the band's depths come from `coverage.coverageDepths` on
         * the alignment blocks, and the summary path clears `rpcDataMap` on
         * purpose. Reading the setting as if it answered both questions left the
         * band reserving `coverageHeight` px above the rows and painting nothing
         * whatsoever into them: no bars, no axis, no label — ~45px of dead
         * chrome on every track with a `summaryAdapter` zoomed out past the
         * floor.
         *
         * Everything that lays the band out, paints it, hit-tests it or exports
         * it reads this; only the track menu reads `showCoverage`, so the tick
         * keeps reporting what the user chose rather than where they happen to
         * be zoomed — and zooming back in restores the band without touching the
         * config. Same split as `basesRenderingActive` vs `activeRowRendering`,
         * for the same reason.
         */
        get coverageBandActive() {
          return self.showCoverage && !self.showSummary
        },
        /**
         * #getter
         * The conservation band is on *and* has data to put in it — the exact
         * twin of `coverageBandActive`, and it exists because the band had the
         * bug that getter was written to fix.
         *
         * Percent identity is computed from the alignment: the per-base mode
         * reads `coverage.identityScores` off the blocks and the codon mode
         * translates them, so both come out of `rpcDataMap`, which the summary
         * path clears. `showConservation` alone therefore left 40px of band, a
         * fixed 0–100% axis and a resize handle drawn over nothing at every zoom
         * past the floor. Unlike coverage it is off by default, which is the
         * only reason it went unnoticed for longer.
         *
         * Same split as its twin: everything that lays the band out, paints it
         * or exports it reads this, so the menu tick keeps reporting what the
         * user chose and zooming back in restores the band without touching the
         * config.
         *
         * The one other reader of the raw setting is `annotationDataActive`, and
         * it has to stay raw: it is an `rpcProps()` cache key, so resolving it
         * through this getter would make the key zoom-dependent and drop every
         * loaded region on each crossing of the summary floor. Fetching frames
         * the codon band can't draw yet costs one small read; refetching the
         * alignment costs the tier swap twice over.
         */
        get conservationBandActive() {
          return self.showConservation && !self.showSummary
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Sample list keyed by sample id (alias of `sources` mapped to the
         * project's canonical `{ id, label, color }` shape). Consumed by
         * MafSequenceWidget, color legend, etc.
         */
        get samples(): Sample[] {
          return self.sources.map(s => ({
            id: s.name,
            label: s.label ?? s.name,
            color: s.labelColor,
            ...navigationFields(s),
          }))
        },
        /**
         * #getter
         * Maps a `src` (species) to its display row index. The single source for
         * the `src`→row projection used by the summary-bar and CDS-frame overlays
         * and the frame hover lookup, so they can't disagree on row placement.
         */
        get rowIndexBySrc(): Map<string, number> {
          return new Map(
            self.sources.map((s, i): [string, number] => [s.name, i]),
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
         *
         * The reference is `referenceSampleId` — the row the worker saw carrying
         * the reference sequence — not the view's assembly name, which is a
         * different string whenever the MAF names its reference differently.
         */
        get defaultCodonSpecies(): string | undefined {
          const refSrc = self.referenceSampleId
          const rows = self.sourcesVolatile
          return rows.some(s => s.name === refSrc) ? refSrc : rows[0]?.name
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The display's band stack, coverage above conservation — the one place
         * the order is stated. Every top, height and offset below reads this
         * fold, so a band cannot be reserved at one height and painted at
         * another, and a band that is off spends 0 px.
         */
        get topBands() {
          const bounds = self.statedBandBounds
          return stackBands(['coverage', 'conservation'], {
            coverage: {
              active: self.coverageBandActive,
              height: self.coverageHeight,
              bounds,
            },
            conservation: {
              active: self.conservationBandActive,
              height: self.conservationHeight,
              bounds,
            },
          })
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Height of the coverage band above the rows (0 when hidden, and on the
         * summary path, where it has nothing to draw).
         */
        get coverageDisplayHeight() {
          return self.topBands.reserved.coverage
        },
        /**
         * #getter
         * Height of the conservation (percent identity) band (0 when hidden, and
         * on the summary path, where it has nothing to draw).
         */
        get conservationDisplayHeight() {
          return self.topBands.reserved.conservation
        },
        /**
         * #getter
         * Top offset of the per-sample rows area = where the band stack ends.
         * The single source of truth for "where the rows start" — every rows
         * hit-test / draw / export offset routes through this so adding a band
         * can't desync them.
         */
        get rowsTopOffset() {
          return self.topBands.bottom
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Number of displayed rows (at least 1, so the fit-mode division is safe).
         */
        get nrow() {
          return Math.max(1, self.sources.length)
        },
        /**
         * #getter
         * The per-sample rows area has something to draw: the view can place it,
         * the rows are shown at all, and the row set is known.
         *
         * Every rows layer is a full per-cell scan of the visible blocks, and
         * with `showAlignments` off the area is 0px tall — so the gate lives
         * here rather than being re-spelled by each `visible*` getter, which is
         * how the summary bars came to be the only rows layer that could run
         * before the view was initialized.
         */
        get rowsVisible() {
          return (
            self.host.initialized && self.showAlignments && self.sourcesKnown
          )
        },
        /**
         * #getter
         * Max CSS-px height the rows canvas may take before its backing store
         * (`× dpr`) hits the browser/GPU canvas limit. The single ceiling both the
         * fit-target sizing and the `rowHeight` cap respect.
         */
        get maxRowsHeight() {
          return maxCanvasCssPx()
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The track height that fit-to-height mode divides among rows. Once the
         * user drags, the explicit `height` config slot wins; before any drag we
         * size to show every row at the default px height, so a typical
         * alignment looks exactly like fixed mode.
         *
         * Bounded by `DEFAULTS.maxAutoFitHeight`, past which the rows shrink
         * instead of the track growing. Sizing purely to content made the
         * default height scale with the species count — 4141px for a 447-way,
         * across a stack of full-height overlay canvases — and left
         * `maxRowsHeight` (a crash guard, at the backing-store limit) as the
         * only thing bounding it. This is the *policy* bound; that one stays as
         * the hard floor under a deliberate drag.
         */
        get fitTargetHeight(): number {
          return (
            getConf(self, 'height') ??
            Math.min(
              self.nrow * DEFAULTS.rowHeight + self.rowsTopOffset,
              DEFAULTS.maxAutoFitHeight,
            )
          )
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Height of the per-sample rows *viewport* — the track height minus the
         * stacked bands, which is exactly the rows canvas. Zero when alignments
         * are hidden, collapsing the display to the coverage band.
         *
         * This is the viewport, not the content: with a fixed `rowHeight` the
         * rows can add up to far more than this and the extra is reached by
         * scrolling (`rowsContentHeight` / `scrollableHeight`), never by growing
         * the canvas. Capped at `maxRowsHeight` so even a deliberate drag can't
         * push the backing store past the browser/GPU canvas limit.
         */
        get rowsHeight() {
          return self.showAlignments
            ? Math.min(
                Math.max(0, self.fitTargetHeight - self.rowsTopOffset),
                self.maxRowsHeight,
              )
            : 0
        },
        /**
         * #getter
         * The legal range for the two drag-resizable bands stacked over the rows
         * (coverage, conservation).
         *
         * The ceiling is what makes the drag recoverable: `rowsHeight` above
         * floors at 0, so without one a band dragged past the track height
         * squashes the rows to nothing *and* carries its own resize handle —
         * drawn at the band's bottom edge — off the display, leaving no way back.
         * Bounded against `fitTargetHeight`, the same pot `rowsHeight` divides,
         * and per band rather than across both: two bands dragged large can still
         * crowd the rows, but each stays reachable.
         */
        get resizableBandBounds() {
          return {
            max: Math.max(
              MIN_BAND_HEIGHT,
              self.fitTargetHeight - MIN_BAND_HEIGHT,
            ),
          }
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Per-row height in fit-to-height mode: the rows viewport split evenly
         * across rows, so the content always fits exactly and the display never
         * scrolls in this mode.
         *
         * Deliberately NOT floored at 1px. A sub-pixel row is the legitimate
         * answer for more species than the track has pixels, and flooring it
         * made the rows area taller than the height it was asked to fit inside
         * — which defeated `fitTargetHeight`'s own ceiling past ~555 species
         * (2000 species floored to 1px re-grew the track to 2045px) and would
         * now make fit mode report a phantom scroll. The non-positive guard
         * belongs in `effectiveRowHeight`, which is the resolved value consumers
         * divide by. Same rule, and same regression, as the multi-sample variant
         * display's `autoRowHeight`.
         *
         * A **fixed** height goes the other way and is used as-is however many
         * species there are: the rows canvas is the viewport (`rowsHeight`), so
         * hundreds of tall rows cost scroll extent, not backing store. The
         * canvas-size ceiling that `effectiveRowHeight` used to apply —
         * shrinking every row so the whole stack could be one canvas — now
         * lives on `rowsHeight` itself, where the canvas actually is.
         */
        get autoRowHeight() {
          return self.rowsHeight / self.nrow
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Height the per-sample rows add up to — the scrolled content behind the
         * `rowsHeight` viewport. Equal to it in fit-to-height mode (which is what
         * makes that mode never scroll); larger whenever a fixed `rowHeight`
         * asks for more rows than the track shows.
         */
        get rowsContentHeight() {
          return self.showAlignments ? self.nrow * self.effectiveRowHeight : 0
        },
        /**
         * #getter
         * Full display height = rows viewport + stacked bands.
         */
        get totalHeight() {
          return self.rowsHeight + self.rowsTopOffset
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Max valid `scrollTop`: how far the rows scroll before the last one
         * reaches the viewport floor. Zero when they fit, so this doubles as the
         * "does this display scroll" answer (the scrollbar and the wheel handler
         * both read it). Fit-to-height always fits.
         */
        get scrollableHeight() {
          return Math.max(0, self.rowsContentHeight - self.rowsHeight)
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Override BaseLinearDisplay.height so the track container matches the
         * rendering canvases exactly (stacked bands + rows viewport).
         */
        get height() {
          return self.totalHeight
        },
        /**
         * #getter
         * Positioned tree hierarchy. Coordinates are computed against
         * `(rowsContentHeight, treeAreaWidth)` so leaf rows align with row tops
         * even where the rows scroll past the viewport — the tree canvas and the
         * SVG labels shift the whole thing by `scrollTop`, exactly as the rows
         * do. The coverage band is offset separately by the React layer.
         */
        get hierarchy() {
          return computeClusterHierarchy(
            self.root,
            self.sources,
            self.rowsContentHeight,
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
         * Apply one drag delta to the coverage band. Reads the current height
         * inside the action rather than taking an absolute target: `ResizeHandle`
         * emits one delta per animation frame, so a component computing
         * `renderHeight + delta` drops every tick that lands before React
         * re-renders. Mirrors `resizeHeight`.
         *
         * Sits here rather than with its `setCoverageHeight` twin because the
         * ceiling comes off `fitTargetHeight`, which is declared above this
         * block.
         */
        resizeCoverageHeight(distance: number) {
          setConf(
            self,
            'coverageHeight',
            clampBandHeight(
              self.coverageHeight,
              self.coverageHeight + distance,
              self.resizableBandBounds,
            ),
          )
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
              self.resizableBandBounds,
            ),
          )
        },
        // `setScrollTop` and the re-clamp autorun are TrackHeightMixin's, earned
        // by overriding `scrollableHeight` above — nothing self-corrects a
        // stranded offset here, since the rows are a fixed-size canvas painted
        // at `-scrollTop`, not a DOM overflow container.
      }))
      .views(self => ({
        get spatialIndex() {
          return buildSpatialIndex(self.hierarchy)
        },
      }))
      .actions(self => ({
        /**
         * #action
         * Reorder the rows by the base each species carries in the reference
         * column at (refName, pos) — the MAF analogue of the multi-row
         * painting's "sort rows by color here". Reads the placed region data
         * already in hand, no refetch, and writes the order through `layout`,
         * the channel clustering and the arrangement dialog write, so "Reset
         * row order" undoes all three.
         *
         * Declines with fewer than two rows, and at a column no loaded region
         * covers, for the reasons the other two displays' twins state: the
         * empty write is not a no-op (`setLayout` drops the tree — here the
         * guide phylogeny — whenever the row set changes), and every row
         * reading "no base" writes back the order it already had.
         */
        sortRowsByBaseAt(refName: string, pos: number) {
          const index = loadedRegionIndexAt(self.loadedRegions, refName, pos)
          const region =
            index === undefined ? undefined : self.rpcDataMap.get(index)
          if (region && self.editableSources.length > 1) {
            self.setLayout(
              orderMafRowsByBaseAt(
                self.editableSources,
                self.sources,
                region,
                pos,
              ),
            )
          }
        },
      }))
      .views(self => ({
        /**
         * #method
         * Items for the right-click menu, built from the column the click
         * landed on. The position is captured when the menu opens rather than
         * read inside the onClick, because `closeContextMenu` runs first when
         * an item is clicked.
         */
        contextMenuItems(): MenuItem[] {
          const info = self.contextMenuInfo
          // The sort reads `rpcDataMap`, which the summary fetch clears on
          // purpose, so on that tier the row was enabled and did nothing. Same
          // wording the two band toggles use for the same override.
          const zoomHint = self.showSummary ? ZOOM_IN_FOR_BAND : undefined
          const insertion =
            info?.hover?.kind === 'insertion' ? info.hover : undefined
          return info
            ? [
                {
                  label: 'Copy location',
                  icon: ContentCopyIcon,
                  onClick: () => {
                    void copyText(
                      self,
                      assembleLocString({
                        refName: info.refName,
                        start: info.pos,
                        end: info.pos + 1,
                      }),
                      'location',
                    )
                  },
                },
                // Reachable by left click too, and only there until now — a
                // long insertion's sequence is dropped from the tooltip, so
                // the widget is the only way to read it.
                ...(insertion
                  ? [
                      {
                        label: 'Open insertion details',
                        icon: MenuOpenIcon,
                        onClick: () => {
                          openInsertionWidget(self, insertion)
                        },
                      },
                    ]
                  : []),
                zoomGatedItem(
                  sortRowsHereMenuItem({
                    label: withHint('Sort rows by base here', zoomHint),
                    rowCount: self.editableSources.length,
                    onClick: () => {
                      self.sortRowsByBaseAt(info.refName, info.pos)
                    },
                  }),
                  zoomHint,
                ),
                ...resetRowOrderMenuItems(self),
              ]
            : []
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
        // #region colorPalette
        get colorPalette(): MafColorPalette {
          return getMafColorPalette(getPaletteHost(self).palette)
        },
        // #endregion
        /**
         * #getter
         * Genomic bp the GPU encoder collapses into one cell — `subPixelBinBp`
         * off the *debounced* `coarseBpPerPx` (the same input
         * `zoomedToBaseLevel` uses), which the encode autorun tracks. Zoomed in
         * this is `1` (encode every base). Once a base falls below half a CSS
         * pixel the per-base quads are individually invisible — a 500kb region
         * across 10 species emits 1.7M of them into a 28MB buffer, all but ~15k
         * of which lose the sub-pixel race for their pixel — so the encoder
         * decimates to one sample per bin instead.
         */
        get encodeBinBp() {
          const view = self.view
          return view.initialized ? subPixelBinBp(view.coarseBpPerPx) : 1
        },
      }))
      .views(self => ({
        /**
         * #method
         * Where the rows sit on screen: the resolved row height, plus the scroll
         * offset and viewport that every rows layer places and culls against.
         * One source for all of them — a layer spelling out its own geometry
         * could quietly read the raw `rowHeight` sentinel, or forget the scroll
         * and hang its markers a scroll-distance below the cells they annotate.
         */
        rowGeometry(): MafRowGeometryParams {
          return {
            rowHeight: self.effectiveRowHeight,
            rowProportion: self.rowProportion,
            scrollTop: self.scrollTop,
            viewportHeight: self.rowsHeight,
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
         * Row *order* is deliberately absent: no fetch argument depends on it
         * any more, since the worker names rows by species and the main thread
         * places them (`placeMafRegionData`). A reorder therefore re-places the
         * cached payload — the heaviest in the plugin — instead of refetching it.
         *
         * `subtreeFilter` stays because it is a fetch argument, and the *set* is
         * the only thing about the rows that is: the worker ships only the rows
         * in it and scopes coverage/identity to them. It is sent as a set, never
         * an order, so reordering inside a filter is still free.
         *
         * The discovered row set growing is deliberately NOT a key — see
         * `setSamples` for why re-placement covers it.
         *
         * Nothing here may be fetch-derived. Keying on a value that is undefined
         * until the first fetch lands and defined after flips the key on every
         * track load, and `SettingsInvalidate` then throws away the region that
         * just arrived — a measured 2 × `LinearMafGetAlignmentData` per region.
         * Loop-safe but not free, which is exactly the case ARCHITECTURE.md's
         * "`rpcProps()` loop trap and how to break it" is about. Pinned by
         * `singleFetchPerRegion.test.ts`.
         */
        rpcProps() {
          // `annotationDataActive` is a cache key so toggling the CDS-frame strip
          // *or* the codon view on triggers a refetch that populates
          // `framesDataMap` for the loaded regions (the frames piggyback on the
          // same fetch pass).
          return {
            subtreeFilter: self.subtreeFilterSet,
            annotationDataActive: self.annotationDataActive,
          }
        },
      }))
      .views(self => ({
        /**
         * #getter
         * [min, max] coverage domain over the currently visible content blocks,
         * derived from the worker-shipped `coverage.coverageDepths` arrays
         * (which already reflect the active subtree — see `rpcProps`). Linear
         * and unbounded: sample counts are already bounded and
         * well-distributed, so this display composes no score axis to
         * configure. Feeds `coverageTicks`.
         */
        get coverageDomain() {
          return visibleStatsDomain({
            active: self.coverageBandActive,
            view: self.view,
            payloadFor: index => self.rpcDataMap.get(index)?.coverage,
            itemsFor: coverage => [coverage],
            accumulate: entries => computeVisibleCoverageStats(entries),
            range: ({ scoreMin, scoreMax }) => [scoreMin, scoreMax],
            bounds: [undefined, undefined],
            scaleType: 'linear',
          })
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
                self.coverageDomain,
                self.topBands.reserved.coverage,
                'linear',
              )
            : undefined
        },
        /**
         * #getter
         * The coverage band's colours, in both representations the two backends
         * need: CSS strings for the Canvas2D painters, packed ABGR for the GPU
         * passes. Its own getter so the pack — which parses nine CSS colours —
         * is memoized against the palette rather than re-run inside
         * `renderState`, which every scroll frame invalidates.
         */
        get coverageBandColors() {
          const colors = getMafCoverageColors(getPaletteHost(self).palette)
          return { colors, gpuColors: packMafCoverageColors(colors) }
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The coverage band as the renderers take it, or undefined for "draw no
         * band": the setting is off, the summary tier owns the view, or the
         * autoscaled domain has not resolved yet. Every mark in the band is a
         * fraction of the domain max, so the third case is not a shorter band —
         * it is bars of arbitrary height, which is why one nullable object
         * carries the height and the domain together.
         */
        get coverageBandState(): MafCoverageBandState | undefined {
          const domainMax = self.coverageDomain?.[1]
          return self.coverageBandActive && domainMax
            ? {
                height: self.topBands.reserved.coverage,
                domainMax,
                ...self.coverageBandColors,
              }
            : undefined
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Render state passed to GPU/Canvas2D backend each frame.
         *
         * `canvasHeight` is the WHOLE canvas — the stacked bands plus the rows
         * viewport — because the coverage band draws on the same canvas as the
         * rows, scissored out of it, the way the alignments display draws its
         * coverage band above its pileup. A display gets one rendering backend,
         * so a second GPU band cannot mean a second canvas. `rowsTop` /
         * `rowsHeight` are the rows band inside it.
         */
        get renderState(): MafGPURenderState {
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
            canvasWidth: self.canvasWidthPx,
            canvasHeight: self.rowsTopOffset + self.rowsHeight,
            rowsTop: self.rowsTopOffset,
            rowsHeight: self.rowsHeight,
            coverage: self.coverageBandState,
            rowHeight: self.effectiveRowHeight,
            rowProportion: self.rowProportion,
            scrollTop: self.scrollTop,
            showAllLetters: self.showAllLetters,
            mismatchRendering: self.mismatchRendering,
            palette: self.colorPalette,
            binBp: self.encodeBinBp,
          }
        },
      }))
      .views(self => ({
        /**
         * #method
         * Resolve a hover hit on `rowIndex` at the cursor's genomic position
         * (absolute uint32, per worker-output convention): an aligned base
         * (`cell`) or a bridged/empty region (`empty`), each tagged with the
         * sample label. Returns undefined when no fetched block covers the bp,
         * the row is out of range, or the cell is a gap.
         *
         * `bp` carries both readings of the cursor (see `HoverBp`) because the
         * cell and the interbase insertion marker are selected by different
         * ones, and they differ on a reversed region.
         */
        rowHoverInfo(
          displayedRegionIndex: number,
          bp: HoverBp,
          rowIndex: number,
          bpPerPx: number,
        ) {
          const { sources } = self
          const region =
            rowIndex >= 0 && rowIndex < sources.length
              ? self.rpcDataMap.get(displayedRegionIndex)
              : undefined
          const hit = region
            ? findRowHoverAtBp(
                region,
                bp,
                rowIndex,
                self.showAsUpperCase,
                bpPerPx,
              )
            : undefined
          if (!hit) {
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
         * Where the rows `[startRow, endRow)` sit in their own genomes across
         * the reference bp range `[startBp, endBp)` — the loci an "open this
         * species here" navigation targets. A row contributes nothing when it
         * has no aligned base in the range, when no fetched block covers it, or
         * when its genome isn't loaded as an assembly (`Sample.assemblyName`
         * unset), since there is then nowhere to navigate to.
         *
         * The whole row range at once, because that is what the callers ask
         * for: the track menu builds an entry per row on every open, and a
         * per-row answer re-walked the buffered region — thousands of blocks,
         * each scanned with `rows.find` — once per species.
         */
        rowNavigationTargets(
          displayedRegionIndex: number,
          startBp: number,
          endBp: number,
          startRow: number,
          endRow: number,
        ) {
          const { sources } = self
          const { assemblyManager } = getSession(self)
          const assemblyNames = new Map<number, string>()
          for (
            let row = Math.max(0, startRow);
            row < Math.min(endRow, sources.length);
            row++
          ) {
            const source = sources[row]!
            // The config's mapping first. Failing one, a sample whose id IS an
            // assembly the session already holds — the pangenome MAFs are built
            // from PanSN-named strains loaded under those same names. This is
            // not the name resolution MAF_CROSS_VIEW_NAVIGATION.md rules out:
            // nothing is looked up against a portal, and an assembly present
            // under the exact id is the config author's own statement of which
            // genome it is.
            const assemblyName =
              source.assemblyName ??
              (assemblyManager.has(source.name) ? source.name : undefined)
            if (assemblyName !== undefined) {
              assemblyNames.set(row, assemblyName)
            }
          }
          // A track whose samples name no genome — every multiz — never reaches
          // the blocks at all.
          const region = assemblyNames.size
            ? self.rpcDataMap.get(displayedRegionIndex)
            : undefined
          const spans = region
            ? findRowSpans(
                region,
                startBp,
                endBp,
                new Set(assemblyNames.keys()),
              )
            : undefined
          const targets: (RowSpan & {
            assemblyName: string
            assemblyConfigLocation?: UriLocation
            sampleLabel: string
            rowIndex: number
          })[] = []
          for (const [rowIndex, assemblyName] of assemblyNames) {
            const span = spans?.get(rowIndex)
            const source = sources[rowIndex]!
            if (span) {
              targets.push({
                ...span,
                assemblyName,
                assemblyConfigLocation: source.assemblyConfigLocation,
                sampleLabel: source.label ?? source.name,
                rowIndex,
              })
            }
          }
          return targets
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
         *
         * `bp` is a base index — the caller passes `MafPointer.baseBp`, not a
         * floored `gposFrac`, so this names the same base the row hover and the
         * coverage tooltip do on a reversed region.
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
            bp,
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
         *
         * `reversed` is the region's orientation, and the SNP snap below needs it
         * for the reason alignments' `hitTestCoverage` does: the snap widens
         * `position` into the bp the CURSOR'S PIXEL covers, and which side of
         * `position` those bp lie on is what the orientation decides. `position`
         * itself already comes through `basePaintedAt`, so it is the right base
         * either way — widening rightward regardless searched the neighbouring
         * pixel's bp on a flipped region, and reported a SNP the cursor was not
         * over.
         */
        coverageTooltipBin(
          displayedRegionIndex: number,
          position: number,
          bpPerPx: number,
          reversed = false,
        ) {
          const coverage = self.rpcDataMap.get(displayedRegionIndex)?.coverage
          if (!coverage) {
            return undefined
          }
          const snpPos = coverageSnpSnap(coverage, position, bpPerPx, reversed)
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
         * The orientation each (row, source chromosome) is measured against for
         * the inversion indicator (`consensusStrandByRowChr`). A memoized
         * computed for the same reason as `sourceChromRanks`: it walks every
         * block × row of every *loaded* region — deliberately, so the consensus
         * stays put as the user scrolls within loaded data — while its only
         * consumer runs on every pan and zoom. Empty when the indicator is off,
         * so a track that never shows inversions pays nothing.
         */
        get inversionConsensus(): StrandConsensus {
          return self.showInversions
            ? consensusStrandByRowChr(self.rpcDataMap)
            : new Map<number, Map<string, number>>()
        },
      }))
      .views(self => {
        // The block-overlay helpers all take this same bundle.
        const overlayParams = () => ({
          view: self.host,
          rpcDataMap: self.rpcDataMap,
          ...self.rowGeometry(),
        })
        return {
          /**
           * #getter
           * Positioned bridge-line segments for `e`-line (empty/bridged) rows.
           */
          get visibleEmptyLines() {
            return self.rowsVisible
              ? computeVisibleEmptyLines(overlayParams())
              : []
          },
          /**
           * #getter
           * Positioned deletion runs for the visible aligned rows; the overlay draws
           * the deleted-base count inside each run when it fits.
           */
          get visibleDeletions() {
            return self.rowsVisible
              ? computeVisibleDeletions(overlayParams())
              : []
          },
          /**
           * #getter
           * Positioned strand-flip (inversion) markers for the visible aligned rows.
           * Empty unless the indicator is toggled on.
           */
          get visibleInversions() {
            return self.rowsVisible && self.showInversions
              ? computeVisibleInversions({
                  ...overlayParams(),
                  consensus: self.inversionConsensus,
                })
              : []
          },
        }
      })
      .views(self => ({
        /**
         * #getter
         * At base level each reference base spans at least a pixel, so individual
         * bases / SNP marks are legible (UCSC's `zoomedToBaseLevel`). Read off the
         * debounced `coarseBpPerPx` so the rendering swap it gates doesn't thrash
         * mid-zoom. False until the view is initialized.
         */
        get zoomedToBaseLevel() {
          const view = self.view
          return view.initialized && view.coarseBpPerPx <= 1
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The row coloring the *user picked*, as one value across the three
         * slots that store it. `activeRowRendering` below is what is actually
         * painting; this is the setting behind it, and the two differ wherever
         * zoom or the summary path overrides the choice.
         *
         * Zoom-independent on purpose. The radio it drives would otherwise
         * move its own tick as the user zoomed — the identity plot yields to
         * the bases at base level, codon view only exists there — which reads
         * as the menu changing the setting behind their back.
         *
         * This is where precedence between the three slots is decided, once:
         * `activeRowRendering` starts from the answer rather than re-deriving
         * it, so the two cannot disagree about which setting won.
         */
        get selectedRowRendering(): RowRendering {
          return self.showTranslation && !!self.annotationAdapterConfig
            ? 'codon'
            : self.colorByChromosome
              ? 'sourceChrom'
              : self.rowIdentityMode !== 'none'
                ? self.rowIdentityMode
                : 'bases'
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Single source of truth for what the per-sample rows area draws right now:
         * `bases` (the GPU SNP/base coloring), `codon` (per-codon change coloring
         * from `mafFrames`), `sourceChrom` (color-by-source-chromosome SV mode), or
         * a per-row identity style (`heatmap` / `xyplot`). The GPU canvas, the
         * identity/chromosome canvases, the codon overlay, and SVG export all
         * branch on this one getter so they can't disagree about what's on screen.
         *
         * `selectedRowRendering` is the setting; this applies the two things that
         * can override it, and falls back to the bases — the rendering that needs
         * nothing beyond the alignment — whenever it does:
         *
         * - the cheap summary path carries neither per-row bases nor per-row
         *   source chromosomes, so no alternative can draw from it;
         * - zoom, in the two directions UCSC `wigMaf` uses. Codons only exist at
         *   base level, and with `rowIdentityAutoZoom` (the default) the identity
         *   plot yields to the bases there, where the letters say more than a
         *   per-pixel mean of them. Auto off pins the plot on at every zoom.
         *
         * Deriving from the selection rather than restating its precedence is
         * also what keeps a config that sets two of the three slots — the state
         * the old menu of independent checkboxes could reach, and a hand-written
         * config still can — painting the one the menu ticks. Re-deriving let a
         * lower-precedence slot take over at the zooms where the winner couldn't
         * draw, so the menu said "Codon changes" while the rows were colored by
         * source chromosome.
         */
        get activeRowRendering():
          | 'bases'
          | 'codon'
          | 'sourceChrom'
          | RowIdentityMode {
          if (self.showSummary) {
            return 'bases'
          }
          const selected = self.selectedRowRendering
          if (selected === 'codon') {
            return self.zoomedToBaseLevel ? 'codon' : 'bases'
          }
          if (isRowIdentityMode(selected)) {
            return self.rowIdentityAutoZoom && self.zoomedToBaseLevel
              ? 'bases'
              : selected
          }
          return selected
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The GPU base canvas owns the rows: per-base SNP cells are what's
         * painted, so the per-base letters draw, insertion markers are live
         * (drawn, hoverable, clickable), and the encode autorun has a buffer
         * worth building.
         *
         * Named once here because it is the question six consumers ask —
         * the encode and render callbacks, the insertion overlay and its cursor,
         * the insertion click, and SVG export — and a mode added to
         * `activeRowRendering` has to reach all six or the markers keep drawing
         * over a rendering that isn't theirs.
         *
         * **Not simply `activeRowRendering === 'bases'`.** That getter answers
         * which of the *selectable* renderings wins, and summary mode resolves
         * to `bases` there because none of the alternatives can draw from
         * summary rows. But the base canvas can't draw from them either:
         * `fetchMafSummaryData` clears `rpcDataMap` on purpose, and the rows the
         * user sees are the summary overlay's. So the two questions genuinely
         * differ here, and answering this one with that one pinned the display
         * in `loading` forever — the render callback took the paint-from-
         * `rpcDataMap` branch, `renderBlocks` returned `painted: false` over an
         * empty map every frame, and `canvasDrawn` never flipped, so
         * `computeLoadingTerm`'s `rendersCanvas && !canvasDrawn` stayed true
         * under a track that was fully loaded and visibly drawn.
         */
        get basesRenderingActive() {
          return self.activeRowRendering === 'bases' && !self.showSummary
        },
        /**
         * #getter
         * Which rendering the sibling Canvas2D rows layer paints, or undefined
         * when it paints nothing (`bases` is the GPU canvas, `codon` is its own
         * overlay). The on-screen canvas and SVG export both branch on this
         * rather than re-deriving the same cascade, which is what let the export
         * grow a four-branch chain against the canvas's two.
         */
        get rowsCanvas2dMode(): 'sourceChrom' | RowIdentityMode | undefined {
          const rendering = self.activeRowRendering
          return rendering === 'bases' || rendering === 'codon'
            ? undefined
            : rendering
        },
      }))
      .actions(self => ({
        /**
         * #action
         * Pick the row coloring, writing all three slots so exactly one is on.
         *
         * The exclusivity has to be written, not just displayed: the slots are
         * independent booleans, `activeRowRendering` resolves a clash by
         * precedence, and the menu used to offer them as separate checkboxes —
         * so turning on color-by-chromosome while an identity plot was selected
         * left a setting that was on, persisted into the session, and painting
         * nothing. Selecting through here is what makes the tick the truth.
         *
         * A session saved before this (or hand-written config) can still carry
         * two of them; nothing migrates, `selectedRowRendering` just reports
         * the one that wins, and the next pick clears the rest.
         */
        setRowRendering(rendering: RowRendering) {
          // Through the per-slot actions, not `setConf` again: they are the
          // persisted form and stay individually settable (a saved session
          // names them one by one), so this is the exclusivity rule on top of
          // them rather than a second place that knows the slot names.
          self.setShowTranslation(rendering === 'codon')
          self.setColorByChromosome(rendering === 'sourceChrom')
          self.setRowIdentityMode(
            isRowIdentityMode(rendering) ? rendering : 'none',
          )
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Positioned per-base SNP/sequence letters. Suppressed in any non-base
         * rendering (the identity plot and codon view both replace the letters).
         */
        get visibleLabels() {
          // Suppressed in any non-base rendering (identity plot / codon view both
          // replace the per-base letters).
          return self.rowsVisible && !self.resizing && self.basesRenderingActive
            ? computeVisibleLabels({
                view: self.host,
                rpcDataMap: self.rpcDataMap,
                ...self.rowGeometry(),
                showAllLetters: self.showAllLetters,
                showAsUpperCase: self.showAsUpperCase,
              })
            : []
        },
        /**
         * #getter
         * Positioned insertion markers (interbase) for the visible aligned rows.
         *
         * Lives here, past `basesRenderingActive`, rather than beside the other
         * block overlays: the markers are drawn only in `bases` mode (the
         * overlay and the SVG export both gate on it), so the identity plot,
         * codon view and color-by-chromosome were each paying a full per-column
         * insertion walk of every visible block × row, every frame, for markers
         * nothing rendered. The identity plot is the expensive case — it is the
         * zoom-out default once `rowIdentityMode` is set, which is exactly where
         * the walk covers the most blocks. Same mistake, and same fix, as the
         * deletion overlay building 679k markers to draw none; see
         * agent-docs/reference/MAF_LARGE_BLOCKS.md.
         *
         * The hover hit-test does NOT read this — it resolves insertions from
         * the blocks directly (`findRowHoverAtBp`) — so gating costs no
         * interactivity.
         */
        get visibleInsertions() {
          return self.rowsVisible && self.basesRenderingActive
            ? computeVisibleInsertions({
                view: self.host,
                rpcDataMap: self.rpcDataMap,
                ...self.rowGeometry(),
              })
            : []
        },
        /**
         * #getter
         * Positioned per-species presence bars for the zoom-out summary overlay.
         * Unmatched `src` rows drop via the `sources` index, keeping the render
         * robust to summary files that list extra species.
         *
         * Drawn on the summary tier, **and as the coarse stand-in for a region
         * the detail tier hasn't landed yet** — which is the swap back in, and
         * used to be a blank track. Zooming in past the floor stays spatially
         * inside the region the summary fetch loaded, so `viewportWithinLoadedData`
         * is true and `canvasDrawn` is already set: the display reads as `ready`
         * with nothing in it, for the 600ms fetch debounce plus the alignment
         * RPC, which on a deep alignment is the slow one. Nothing was wrong
         * except that the rows we could still draw had been switched off.
         *
         * Suppressed per region rather than in one decision, because the tiers
         * arrive per region: the one under the cursor can be showing bases while
         * its neighbour is still bars. `showSummary` short-circuits it because
         * the two maps *can* both hold a region — zooming back out reuses the
         * summary cache and never calls `clearAlignmentData`, and the bars are
         * what is on screen there.
         */
        get visibleSummaryBars() {
          if (!self.rowsVisible || self.summaryDataMap.size === 0) {
            return []
          }
          const summary = self.summaryDataMap
          return computeVisibleSummaryBars({
            view: self.host,
            summaryDataMap: self.showSummary
              ? summary
              : {
                  get: (i: number) =>
                    self.rpcDataMap.has(i) ? undefined : summary.get(i),
                },
            rowIndexBySrc: self.rowIndexBySrc,
            ...self.rowGeometry(),
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
          return self.rowsVisible && self.annotationsActive
            ? computeVisibleAnnotations({
                view: self.host,
                framesDataMap: self.framesDataMap,
                rowIndexBySrc: self.rowIndexBySrc,
                ...self.rowGeometry(),
              })
            : []
        },
        /**
         * #getter
         * The codon overlay is what the rows area is painting.
         */
        get codonCellsActive() {
          return (
            self.rowsVisible &&
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
            self.host.initialized &&
            // carries both "the user asked for the band" and "not the summary
            // path", which this used to spell as two terms of its own
            self.conservationBandActive &&
            self.conservationMode === 'codon' &&
            !!self.annotationAdapterConfig &&
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
                view: self.host,
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
         * rank walk covers every block × row of every loaded region, and it had
         * two independent callers — the legend (already a cached computed) and
         * `drawSourceChrom`, which recomputed it inside a draw that re-fires on
         * every pan and zoom.
         *
         * Ranked over the loaded regions, exactly as `inversionConsensus` is, and
         * for both of its reasons. The colors stay put as the user scrolls within
         * loaded data — a rank is a claim about the row, and a block ought not
         * change color because a pan brought a different scaffold into view — and
         * the walk re-runs on new data rather than on movement.
         *
         * It used to be keyed on `renderBlocks`, which is rebuilt on every pan
         * tick (its `screenStartPx` moves), so the memo missed on every frame of
         * a pan and re-ranked every (block, row) pair to produce the identical
         * map: those blocks only selected *which region* to walk, and the region
         * they selected carries the whole buffered span either way. Pinned by
         * `sourceChromRanks.test.ts`.
         *
         * Empty when the mode is off, so a track that never colors by chromosome
         * pays nothing.
         */
        get sourceChromRanks(): ReturnType<typeof perRowChromRanks> {
          return self.activeRowRendering === 'sourceChrom'
            ? perRowChromRanks(self.rpcDataMap.values())
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
            ? computeVisibleCodons(self.locatedCodons, self.rowGeometry())
            : []
        },
        /**
         * #getter
         * Per-codon amino-acid conservation bars for the conservation band's codon
         * mode. Draws only inside the CDS (where frames define codons); everywhere
         * else the band is blank.
         */
        get visibleCodonConservation(): CodonConservationBar[] {
          const refSrc = self.referenceSampleId
          return self.codonConservationActive
            ? computeCodonConservation(self.locatedCodons, {
                // Exclude the *reference's* row (matching the per-base band's
                // worker-side `refSampleId`), not the anchor's:
                // `defaultCodonSpecies` falls back to row 0 when the reference
                // isn't a listed sample, which would wrongly drop a real species
                // from the denominator. `-1` when the reference isn't a visible
                // row.
                refRowIndex:
                  refSrc === undefined
                    ? -1
                    : (self.rowIndexBySrc.get(refSrc) ?? -1),
              })
            : []
        },
        /**
         * #getter
         * Titles for the stacked bands, with the y they sit at — empty unless
         * both bands draw, which is the only case they are needed for: two
         * stacked filled-histogram bands are otherwise told apart only by their
         * Y-axis units (depth vs %).
         *
         * A getter for the same reason as `legendItems` below: the on-screen
         * labels and the SVG export both read it. The export had no titles at
         * all, so the one figure that needs them most — both bands drawn, and
         * an exported PNG where nothing can be hovered to disambiguate — was
         * the one shipping without them.
         *
         * The conservation title names what the band is *drawing*
         * (`codonConservationActive`), not the mode that was asked for: codon
         * mode falls back to per-base wherever frames or per-base blocks are
         * missing, and a band captioned "aa identity" while drawing nucleotide
         * identity is worse than no caption.
         */
        get bandLabels(): { text: string; top: number }[] {
          return self.coverageBandActive && self.conservationBandActive
            ? [
                { text: 'Coverage', top: self.topBands.top.coverage },
                {
                  text: self.codonConservationActive
                    ? 'Conservation (aa identity)'
                    : 'Conservation (% identity)',
                  top: self.topBands.top.conservation,
                },
              ]
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
         * A dispatch, not a description: each key is built by the module that
         * paints the rendering, out of the colors it paints with. Written out
         * here instead, all three had drifted from the screen — the codon
         * swatches skipped the alpha the cells are composited with, the X-Y plot
         * got the heatmap's ramp when it paints one color and varies height, and
         * the source-chromosome key kept adding rows past the point where its
         * palette stops changing.
         */
        get legendItems(): LegendItem[] {
          const view = self.host
          if (!view.initialized) {
            return []
          }
          const { palette } = getSession(self)
          const rendering = self.activeRowRendering
          const rows =
            rendering === 'codon'
              ? getCodonLegendItems(palette)
              : rendering === 'sourceChrom'
                ? // Colored by each row's per-row chromosome RANK, not by
                  // chromosome name, so the key is this short fixed scheme
                  // rather than a per-scaffold rainbow.
                  sourceChromLegendItems(self.sourceChromRanks.maxRank)
                : isRowIdentityMode(rendering)
                  ? identityLegendItems(rendering)
                  : []
          // The CDS strip is not one of the alternatives above — it draws *over*
          // whichever of them won — so it is appended rather than dispatched to,
          // and this is why it had no key at all: a dispatch on
          // `activeRowRendering` has no branch that is ever the strip. Last, so
          // the key reads in paint order, and so the rendering's own swatches
          // stay where a reader of the other modes already expects them.
          // Whether the strip has frames to draw, not `visibleFrames.length`:
          // that walk is per-pan, so reading it here recomputed the whole key
          // on every pan tick for an answer that only moves when a frames
          // fetch lands.
          return self.rowsVisible &&
            self.annotationsActive &&
            self.framesDataMap.size > 0
            ? [...rows, ...getFrameLegendItems(palette)]
            : rows
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
                // a base index from the caller (`MafPointer.baseBp`), for the
                // same reason as `frameHoverInfo`
                bp,
                rowIndex,
              })
            : undefined
        },
      }))
      // #region superMethod
      .views(self => {
        const { trackMenuItems: superTrackMenuItems } = self
        return {
          /**
           * #method
           */
          trackMenuItems() {
            return [
              ...superTrackMenuItems(),
              ...buildMafTrackMenuItems(self),
              ...mafLaunchMenuItems({
                session: getSession(self),
                model: self,
                view: getContainingView(self) as LinearGenomeViewModel,
              }),
            ]
          },
        }
      })
      // #endregion
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
        setRpcData(regionIndex: number, data: MafWireRegionData) {
          self.wireDataMap.set(regionIndex, data)
          self.rpcDataMap.set(
            regionIndex,
            placeMafRegionData(data, self.rowIndexBySrc),
          )
        },
        /**
         * #action
         * Re-place every cached region against the row order now on screen.
         * Driven by the autorun below, so a reorder repaints from data already
         * in hand — the fetched rows name their species, so nothing about them
         * is order-specific. Replacing the region objects is what re-runs the
         * per-region encode.
         */
        placeFetchedRows(rowIndexBySrc: Map<string, number>) {
          for (const [regionIndex, data] of self.wireDataMap) {
            self.rpcDataMap.set(
              regionIndex,
              placeMafRegionData(data, rowIndexBySrc),
            )
          }
        },
        setSummaryData(regionIndex: number, records: MafSummaryRecord[]) {
          self.summaryDataMap.set(regionIndex, records)
        },
        setFramesData(regionIndex: number, records: MafFrameRecord[]) {
          self.framesDataMap.set(regionIndex, records)
        },
        /**
         * #action
         * Record whether the last frames read was declined as over budget. Set
         * both ways by every fetch pass that reaches the annotation adapter, so
         * zooming back in clears it without anything else having to.
         */
        setFramesGateBlocked(blocked: boolean) {
          self.framesGateBlocked = blocked
        },
        // Drop alignment blocks when entering summary mode so the GPU sequence
        // canvas paints nothing under the summary overlay.
        //
        // Deliberately one-directional: there is no twin on the alignment path.
        // `summaryDataMap` is what `regionHasData` tests in summary mode, so
        // keeping it through a zoom-in is exactly what lets the zoom back out
        // reuse the cache instead of re-reading the summary adapter. It doesn't
        // accumulate either — it only ever holds the buffered regions of the
        // current chromosome, since `clearDisplaySpecificData` empties it on
        // chromosome nav and on any settings invalidation.
        clearAlignmentData() {
          self.wireDataMap.clear()
          self.rpcDataMap.clear()
        },
        clearDisplaySpecificData() {
          self.wireDataMap.clear()
          self.rpcDataMap.clear()
          self.summaryDataMap.clear()
          self.framesDataMap.clear()
          // The verdict describes a read of the viewport that was just thrown
          // away, so it goes with the data rather than outliving it — otherwise
          // chromosome nav carries "too much data" onto a region nobody has
          // measured yet.
          self.framesGateBlocked = false
        },
        // reload() not overridden — MultiRegionDisplayMixin's base default
        // (clearAllRpcData) is exactly maf's behavior; no extra teardown.
        startRenderingBackend(backend: MafRenderingBackend) {
          // Per-region streamed upload. The encode callback builds the GPU
          // instance buffer on the main thread from raw region data + gpuProps,
          // so theme / showAllLetters / mismatchRendering changes re-encode
          // without an RPC roundtrip.
          installUpload(self, backend, {
            cells: () => self.rpcDataMap,
            // `basesRenderingActive` belongs in here with gpuProps, not read
            // inside the encode: flipping modes has to re-encode every region,
            // and only a declared input does that now.
            inputs: () => ({
              basesActive: self.basesRenderingActive,
              gpu: self.gpuProps(),
            }),
            encode: (regionData, { basesActive, gpu }) => {
              // The coverage band's four buffers are the worker's own, carried
              // through by reference — nothing to encode, and they upload
              // whatever the rows are doing, since the band is drawn from the
              // same canvas and gated only by its own setting.
              const coverage = coverageBandBuffers(regionData.coverage)
              // The rows pass draws nothing unless the rows area is in `bases`
              // mode — the identity plot, codon view and color-by-chromosome all
              // paint the rows on sibling canvases. Encoding anyway built and
              // uploaded a buffer (tens of MB on a wide region) that never
              // reached a pixel. An empty payload skips the encode *and*
              // releases the GPU buffer (an empty pack deletes the pass's
              // buffer); flipping back to `bases` re-encodes immediately.
              if (!basesActive) {
                return { instanceBuffer: new Uint32Array(0), ...coverage }
              }
              const { buffer } = buildInstanceBuffer({
                blocks: regionData.blocks,
                ...gpu,
              })
              return { instanceBuffer: buffer, ...coverage }
            },
            render: b => {
              // First-paint gate: no fetch has landed yet, so skip the tick
              // rather than flipping canvasDrawn on an empty frame. Zero sources
              // over a loaded region is NOT this state — see renderState.
              const hasFetched =
                self.sourcesKnown || self.loadedRegions.size > 0
              // One call whatever the rows are doing, because this canvas now
              // carries the coverage band too. Out of `bases` mode the rows are
              // owned by a sibling canvas (the identity plot, the codon view,
              // color-by-chromosome, or the summary bars) and the rows pass has
              // an empty buffer, so it paints nothing — but the band above still
              // has to draw, and this used to pass no blocks at all to make the
              // rows canvas clear. It still counts as a real paint for
              // `canvasDrawn`: returning false instead is what left summary mode
              // scrimmed forever; see `basesRenderingActive`.
              // The `|| !basesRenderingActive` is the sibling-canvas case: past
              // the summary threshold `rpcDataMap` is cleared on purpose, so
              // this backend draws nothing and reports nothing painted while
              // the rows the user sees are on a sibling canvas.
              return hasFetched
                ? b.renderBlocks(
                    self.renderBlocks,
                    self.rpcDataMap,
                    self.renderState,
                  ) || !self.basesRenderingActive
                : false
            },
          })
        },
      }))
      .actions(self => ({
        fetchNeeded(needed: IndexedRegion[]) {
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
         * Whether the tier the current zoom needs holds this region: crossing
         * the summary↔detail threshold inside an already-loaded region wouldn't
         * trip the bounds-based coverage check, so the answer is which map has
         * it.
         *
         * The presence hook rather than `regionFetchKey`, which stays empty,
         * because the two tiers cache side by side: the detail fetch keeps the
         * summary records (`clearAlignmentData` runs one way only), and a
         * summary/detail key would refetch the summary on every zoom back out.
         */
        regionHasData(displayedRegionIndex: number) {
          return self.showSummary
            ? self.summaryDataMap.has(displayedRegionIndex)
            : self.rpcDataMap.has(displayedRegionIndex)
        },
        /**
         * #getter
         * Enable byte-estimate gating: a MAF-aware byte estimate (per-species
         * sequence × span) is checked against `fetchSizeLimit` inside the tier's
         * own RPC, blocking the fetch with a force-load prompt rather than
         * downloading hundreds of species' bases at genome scale.
         *
         * On for **both** tiers, and `byteGateAdapterPath` below is what makes
         * that safe: each RPC measures the file it actually reads — the
         * alignment index on the detail path, the `summaryAdapter` sub-adapter
         * on the summary one. This used to be `!showSummary`, exempting the
         * summary tier on the grounds
         * that it is the cheap one. It is cheap *per base* — no sequence — but it
         * is still a whole-feature download (`BigBedAdapter.getFeatures`), and
         * `showSummary` covers every zoom from 20kb to the whole genome. So the
         * one path that existed to escape the gate was also the one that could
         * pull an unbounded number of per-species records with nothing quoting
         * the size. A genuinely small summary read is nowhere near
         * `fetchSizeLimit` and never sees a banner; that is the estimate's job to
         * decide, not this getter's.
         */
        get gateEnabled() {
          return true
        },
        /**
         * #getter
         * Measure whichever tier is about to be fetched: the `summaryAdapter`
         * sub-adapter while `showSummary`, otherwise the MAF adapter itself.
         * Without this the summary tier would be gated against the *alignment's*
         * estimate — a number describing a download that isn't happening, which
         * at genome scale would block the cheap tier on the expensive one's cost.
         *
         * The only hook the swap needs: `byteGateAdapterConfig` is the config at
         * this path and `adapterFetchSizeLimit` is that config's own
         * `fetchSizeLimit` slot, so the measurement and the budget describe one
         * file by construction rather than by two overrides agreeing.
         *
         * Reading `showSummary` here is not a cycle: it resolves through
         * `aboveForceLoadFloor`, which deliberately excludes every opt-in term
         * (`RegionTooLargeMixin`), so nothing in the gate is upstream of it.
         */
        get byteGateAdapterPath(): string[] {
          return self.showSummary ? ['adapter', 'summaryAdapter'] : ['adapter']
        },
      }))
      .actions(self => ({
        // #region renderSvgAction
        /**
         * #action
         * Dynamic import so the export path — and everything it pulls in — stays
         * out of the bundle until someone actually exports.
         */
        async renderSvg(opts: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self as LinearMafDisplayModel, opts)
        },
        // #endregion
        // No superAfterAttach() call: @jbrowse/mobx-state-tree auto-chains hooks,
        // so MultiRegionDisplayMixin's afterAttach already runs (see
        // afterAttachAutoChain.test.ts). Calling it explicitly would double-install
        // the mixin's fetch autoruns.
        afterAttach() {
          // `rowIndexBySrc` is read in the autorun body rather than inside the
          // action: an MST action's own reads are untracked, so the placement
          // would never see the row order change. Reading it here also hands
          // the action the memoized Map instead of a freshly rebuilt one.
          //
          // This re-places on any change to `sources`, including a relabel or a
          // recolor, which move no row. That costs one re-encode of the loaded
          // regions — the same work a theme or color-setting change already
          // does on this path — for a rare manual edit, which is cheaper than
          // carrying a comparison to suppress it.
          namedAutorun(
            self,
            () => {
              self.placeFetchedRows(self.rowIndexBySrc)
            },
            { name: 'Maf:placeFetchedRows' },
          )
          setupTreeSidebarAutoruns(self, {
            name: 'Maf',
            sortRows: (refName, pos) => {
              self.sortRowsByBaseAt(refName, pos)
            },
            // "Cluster rows by identity": two rows minimum, matching the
            // menu's gate — one row has no structure to find and hclust has
            // nothing to merge
            clustering: {
              ready: () => self.sources.length > 1,
              run: async args => {
                const { runMafClustering } =
                  await import('./runMafClustering.ts')
                await runMafClustering({ model: self, ...args })
              },
            },
          })
        },
      }))
      .postProcessSnapshot(snap => {
        // A GUIDE tree is derived — rebuilt from worker output on fetch, or
        // restored from treeNewickVolatile on clear — so persisting it would
        // store a copy of something the adapter re-supplies. A CLUSTERED tree is
        // not: nothing recomputes it, and a session that dropped it would come
        // back with the clustered row order and no dendrogram beside it.
        //
        // `clusterProvenance` is what tells the two apart, and it is the same
        // distinction it was introduced for: set only for a tree this app
        // computed, absent for a supplied phylogeny. `layout` is persisted
        // either way — it is the user's own row arrangement; stripDefault omits
        // it when empty, which is the common case.
        if (snap.clusterProvenance) {
          return snap
        }
        const { clusterTree: _clusterTree, ...rest } = snap
        return rest
      })
  )
}

export type LinearMafDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearMafDisplayModel = Instance<LinearMafDisplayStateModel>
