import {
  buildCoverageTooltipBin,
  computeVisibleCoverageDomain,
  computeVisibleCoverageStats,
  coverageDepthDomain,
  hitCoverageBand,
} from '@jbrowse/alignments-core'
import {
  COVERAGE_Y_PATHS,
  coverageBandSlotActions,
  coverageBandSlotViews,
  coverageLayerProblems,
} from '@jbrowse/alignments-core/coverageBandConfigSchema'
import {
  ConfigurationReference,
  getConf,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { withHint } from '@jbrowse/core/ui/menuItems'
import {
  assembleLocString,
  getDialogHost,
  getEnv,
  getPaletteHost,
  getSession,
} from '@jbrowse/core/util'
import { MIN_BAND_HEIGHT, clampBandHeight } from '@jbrowse/core/util/bandHeight'
import { bandDragBounds } from '@jbrowse/core/util/bandLayout'
import { copyText } from '@jbrowse/core/util/copyText'
import { deepEqual } from '@jbrowse/core/util/deepEqual'
import { isSameAssemblyName } from '@jbrowse/core/util/tracks'
import CoarseTierMixin from '@jbrowse/display-kit/CoarseTierMixin'
import ColorWritesMixin from '@jbrowse/display-kit/ColorWritesMixin'
import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import SolidColorDialog from '@jbrowse/display-kit/SolidColorDialog'
import StoredHoverMixin from '@jbrowse/display-kit/StoredHoverMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { editPlotMenuItems } from '@jbrowse/display-kit/plotMenu'
import { sameAsLast } from '@jbrowse/display-kit/stableIdentityComputed'
import { types } from '@jbrowse/mobx-state-tree'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import { maxCanvasCssPx } from '@jbrowse/render-core/canvas2dUtils'
import { createEncodeMemo } from '@jbrowse/render-core/encodeMemo'
import { installUpload } from '@jbrowse/render-core/installUpload'
import { namedAutorun } from '@jbrowse/render-core/namedReactions'
import { scaleTypeCode } from '@jbrowse/render-core/scoreScale'
import { drawnRowHeightPx } from '@jbrowse/render-core/shaders/rowRect'
import {
  ContextMenuMixin,
  TreeSidebarMixin,
  treeOfLeaves,
  getLeafNames,
  resetRowOrderMenuItems,
  setupTreeSidebarAutoruns,
  sortRowsAtColumn,
  sortRowsHereMenuItem,
} from '@jbrowse/tree-sidebar'
import {
  ScoreScaleMixin,
  resolveSymlogConstant,
  visibleStatsRange,
  widenRangeToRules,
} from '@jbrowse/wiggle-core'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'

import { mafCoverageBandColors } from '../LinearMafRenderer/coverageBandColors.ts'
import { identityOver } from '../LinearMafRenderer/identity.ts'
import { getMafColorPalette } from '../LinearMafRenderer/util.ts'
import {
  copyParent,
  isRowVisible,
  placeCopyRows,
} from '../util/sampleCopies.ts'
import { visibleSamples } from '../util/visibleSamples.ts'
import { computeVisibleCodonGlyphs, findCodonAt } from './codons.ts'
import { mafColorScales } from './colorScales.ts'
import { computeVisibleDeletions } from './components/computeVisibleDeletions.ts'
import { computeVisibleEmptyLines } from './components/computeVisibleEmptyLines.ts'
import {
  computeVisibleFrames,
  findFrameAt,
} from './components/computeVisibleFrames.ts'
import {
  computeVisibleInversions,
  consensusStrandByRowRefName,
} from './components/computeVisibleInversions.ts'
import { computeVisibleLabels } from './components/computeVisibleLabels.ts'
import { conservationBarAt } from './components/conservationBand.ts'
import { findRowHoverAtBp } from './components/findRowHover.ts'
import { perRowRefNameRanks } from './components/refNameRanks.ts'
import { summaryAt } from './components/summarySpans.ts'
import { configSlotActions, configSlotViews } from './configSlotViews.ts'
import { coverageTooltipBinAt } from './coverageTooltipBin.ts'
import {
  EMPTY_MAF_COVERAGE,
  createRowsSourceJoin,
  encodeMafRows,
} from './encodeMafRows.ts'
import {
  fetchMafAlignmentData,
  fetchMafSummaryData,
  unionSources,
} from './fetchMafData.ts'
import { mafLaunchMenuItems } from './launchMenuItems.ts'
import { mafTopBands } from './mafTopBands.ts'
import { openInsertionWidget } from './openInsertionWidget.ts'
import { orderMafRowsByBaseAt } from './orderMafRowsByBaseAt.ts'
import { placeMafRegionData } from './placeMafRows.ts'
import { rowNavigationTargetsOf } from './rowNavigationTargets.ts'
import { basePaintsOf, resolveRowPlan } from './rowPlan.ts'
import {
  ZOOM_IN_FOR_BAND,
  buildMafTrackMenuItems,
  zoomGatedItem,
} from './trackMenuItems.ts'
import { mafValueScales } from './valueScales.ts'

import type {
  MafGPURenderState,
  MafRegionData,
  MafRenderingBackend,
  MafUploadPayload,
  MafWireRegionData,
} from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafColorPalette } from '../LinearMafRenderer/util.ts'
import type {
  MafFrameRecord,
  MafRegionPayload,
  MafSource,
  MafSummaryRecord,
} from '../types.ts'
import type { CodonGlyph } from './codons.ts'
import type { FrameMarker } from './components/computeVisibleFrames.ts'
import type { StrandConsensus } from './components/computeVisibleInversions.ts'
import type { HoverBp } from './components/findRowHover.ts'
import type { MafRowGeometryParams } from './components/visibleRegionGeometry.ts'
import type { LinearMafDisplayConfigModel } from './configSchema.ts'
import type { MafRowsEncodeProps, MafRowsSource } from './encodeMafRows.ts'
import type { MafBasesField, RowPlan } from './rowPlan.ts'
import type { MafHover } from './util.ts'
import type { CoverageBandState } from '@jbrowse/alignments-core'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { ContextMenuAnchor, MenuItem } from '@jbrowse/core/ui'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { FetchContext } from '@jbrowse/core/util/fetchContext'
import type {
  CoarseTierRead,
  CoarseTierResult,
} from '@jbrowse/display-kit/coarseTier'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { RowAlias, SvgSidebarProps } from '@jbrowse/tree-sidebar'
import type { ValueScale } from '@jbrowse/wiggle-core'

/**
 * The row under the pointer, published as `hoveredFeature` so another display
 * in the view can tell which sample it is on
 */
export interface MafRowHover {
  name: string
}

// A right-click's reference column plus the hit under it, resolved once so menu
// items need not re-run the hit test against a closed anchor.
export interface MafContextMenuInfo extends ContextMenuAnchor {
  refName: string
  pos: number
  hover?: MafHover
}

/**
 * A listed sample set plus the copy rows earlier regions found: a region
 * without the copy must not drop it.
 */
function withKnownCopies(
  known: readonly MafSource[],
  incoming: readonly MafSource[],
): MafSource[] {
  const names = new Set(incoming.map(s => s.name))
  const kept = known.filter(s => {
    const parent = copyParent(s.name)
    return parent !== undefined && names.has(parent) && !names.has(s.name)
  })
  return [...incoming, ...kept]
}

const NO_DETAIL: ReadonlyMap<number, MafRegionData> = new Map()

/**
 * #stateModel LinearMafDisplay
 * #displayFoundation MultiRegionDisplayMixin
 * Draws the multiple alignment in a `MafTrack`, one row per aligned species,
 * under a conservation band.
 *
 * #example
 * A complete `MafTrack` config to paste into `tracks`. `samples` lists the
 * aligned species in track order; the rows divide the track `height` the
 * bands leave between them:
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
 *       height: 400,
 *       coverage: { show: true },
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
        types.compose(
          BaseDisplay,
          TrackHeightMixin(),
          MultiRegionDisplayMixin(),
        ),
        StoredHoverMixin<MafRowHover>((a, b) => a.name === b.name),
        CoarseTierMixin<MafRegionPayload<MafSummaryRecord[]>>(),
        LegendMixin(),
        ColorWritesMixin(),
        TreeSidebarMixin<MafSource>(),
        ContextMenuMixin<MafContextMenuInfo>(),
        ScoreScaleMixin(COVERAGE_Y_PATHS),
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
         * The `byteLimit` refused the last frames fetch, so the strip
         * stops drawing; the menu reads this to say so.
         *
         * Never in `rpcProps()`: the fetch writes it, the loop trap
         * ARCHITECTURE.md names.
         */
        framesGateBlocked: false,
        /**
         * #volatile
         * The worker's authoritative row set, in tree (leaf) order.
         * `editableSources` arranges it by `rows` and `rowColor`, and `sources`
         * narrows that by the focus.
         */
        sourcesVolatile: [] as MafSource[],
        /**
         * #volatile
         * The adapter's guide tree as newick, which `rowTree` draws while some
         * rotation of it lists `rows.sort` in order.
         */
        treeNewickVolatile: undefined as string | undefined,
        /**
         * #volatile
         * Whether the adapter lists its species, by a `samples` config or its
         * guide tree, rather than discovering them from the blocks it reads.
         */
        speciesListed: false,
        /**
         * #volatile
         * The reference sample row the worker resolved, held here because the
         * region store that delivers it empties on chromosome navigation.
         *
         * Last write wins, not a latch: a re-pointed adapter or edited
         * `refAssemblyName` keeps the display instance.
         */
        refSampleIdVolatile: undefined as string | undefined,
      }))
      .views(self => ({
        /**
         * #getter
         */
        get view() {
          return containingLgv(self)
        },
        /**
         * #getter
         * Offsets the track label above the plot, since the left y-axis gutter
         * would sit under an overlapping label.
         */
        get prefersOffset() {
          return true
        },
      }))
      .views(configSlotViews)
      .actions(configSlotActions)
      .views(coverageBandSlotViews)
      .actions(coverageBandSlotActions)
      .actions(self => ({
        /**
         * #action
         * Receive the worker's `samples` and serialized Newick tree.
         *
         * `samplesCanonical` marks the set authoritative (config- or
         * tree-derived), so it replaces the rows. A discovery set names only
         * the genomes its region's blocks hold, so it unions into the known
         * rows (`unionSources`).
         *
         * The deepEqual guard covers the sample set only; a tree can change
         * while the set does not.
         */
        setSamples({
          samples,
          treeNewick,
          samplesCanonical,
        }: {
          samples: MafSource[]
          treeNewick: string | undefined
          samplesCanonical: boolean
        }) {
          const next = placeCopyRows(
            samplesCanonical
              ? withKnownCopies(self.sourcesVolatile, samples)
              : unionSources([self.sourcesVolatile, samples]),
          )
          if (!deepEqual(next, self.sourcesVolatile)) {
            self.sourcesVolatile = next
          }
          if (treeNewick !== self.treeNewickVolatile) {
            self.treeNewickVolatile = treeNewick
          }
          self.speciesListed = samplesCanonical
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The reference sample row as the worker resolved it (`MafRegionSink`),
         * and until a detail region loads, the row naming the view's assembly
         * or one of its aliases: the HPRC summary tier names hg38's row
         * `GRCh38`.
         *
         * Every consumer reads this getter, so the codon conservation band and
         * the per-base band exclude the same row.
         */
        get referenceSampleId(): string | undefined {
          const { assemblyManager } = getSession(self)
          const viewAssembly = self.view.assemblyNames[0]
          return (
            self.refSampleIdVolatile ??
            self.sourcesVolatile.find(s =>
              isSameAssemblyName(s.name, viewAssembly, assemblyManager),
            )?.name
          )
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The MAF adapter's `framesAdapter` (UCSC `mafFrames`), or undefined.
         * Read by slot path off the live parent track, since a slot read
         * against a snapshot misses defaulted slots.
         */
        get framesAdapterConfig(): Record<string, unknown> | undefined {
          return (
            getConf(self.parentTrack, ['adapter', 'framesAdapter']) ?? undefined
          )
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The CDS frame strip draws: a frames adapter is configured and
         * `alignments.frames.show` is on.
         */
        get framesActive(): boolean {
          return self.showFrames && !!self.framesAdapterConfig
        },
        /**
         * #getter
         * A frames adapter is configured and something reads its frames: the
         * strip, the codon view or the codon band.
         */
        get framesInUse(): boolean {
          return (
            (self.showFrames ||
              self.basesField === 'codon' ||
              (self.showConservation && self.conservationUnit === 'codon')) &&
            !!self.framesAdapterConfig
          )
        },
      }))
      .views(self => ({
        /**
         * #getter
         * `TreeSidebarMixin`'s hook: the worker's species, in the order it
         * reported them. Empty until the first fetch populates the set;
         * `sourcesKnown` is the readiness question.
         */
        get discoveredRows(): MafSource[] {
          return self.sourcesVolatile
        },
        /**
         * #getter
         * `TreeSidebarMixin`'s hook: the adapter's guide tree.
         */
        get guideTreeNewick(): string | undefined {
          return self.treeNewickVolatile
        },
        /**
         * #getter
         * `TreeSidebarMixin`'s hook: none, since a species row has no
         * attribute to color it by.
         */
        get rowColorFields(): readonly string[] {
          return []
        },
        /**
         * #getter
         * `TreeSidebarMixin`'s hook: a copy row answers to its sample, so an
         * order, label, color or focus written against the sample reaches its
         * copies. Undefined while no row is a copy.
         */
        get rowAlias(): RowAlias | undefined {
          const names = self.sourcesVolatile.map(s => s.name)
          if (!names.some(name => copyParent(name) !== undefined)) {
            return undefined
          }
          const known = new Set(names)
          return name =>
            copyParent(name) ?? (known.has(name) ? name : undefined)
        },
        /**
         * #getter
         * `TreeSidebarMixin`'s hook: rows follow the leaves of the rotated
         * `parsedTree` that `rows.sort` uses, then any rows the tree does not
         * name. Without a tree, the species `rows.sort` lists lead and the
         * rest keep adapter order.
         */
        get rowOrder(): readonly string[] {
          const { parsedTree, rowSort } = self
          return parsedTree
            ? [...getLeafNames(parsedTree), ...rowSort]
            : rowSort
        },
      }))
      .views(self => ({
        /**
         * #getter
         * `editableSources` narrowed to the focus by the worker's own rule,
         * `visibleSamples`, so the rows drawn are the rows shipped.
         */
        get clusterableSources(): MafSource[] {
          const { editableSources, rowFocus, speciesListed } = self
          const visible = visibleSamples(
            rowFocus,
            speciesListed ? editableSources : [],
          )
          return visible
            ? editableSources.filter(r => isRowVisible(r.name, visible))
            : editableSources
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The display rows: `clusterableSources`, less the reference row when
         * `showReferenceRow` is off. An empty array means no fetch yet or a
         * focus with no rows; `sourcesKnown` tells them apart.
         */
        get sources(): MafSource[] {
          const rows = self.clusterableSources
          if (self.showReferenceRow) {
            return rows
          }
          const refSrc = self.referenceSampleId
          return rows.filter(s => s.name !== refSrc)
        },

        /**
         * #getter
         * Two or more display rows, so a hidden reference row does not count.
         */
        get autoClusterReady(): boolean {
          return this.sources.length > 1
        },

        /**
         * #getter
         * Whether the species list has arrived from the adapter. `rowsVisible`
         * and the render callback's first-paint gate read this, since an empty
         * `sources` is ambiguous.
         */
        get sourcesKnown(): boolean {
          return self.sourcesVolatile.length > 0
        },

        /**
         * #getter
         * The focus `rows.kept` as the worker sees it: a sorted plain array
         * read off config alone. The sort keeps a re-cluster's new leaf order
         * out of the fetch key (reference/FETCH_KEYS.md, "Row order is not a
         * fetch input").
         */
        get rowFocusKey(): string[] | undefined {
          const filter = self.rowFocus
          return filter?.length ? [...filter].sort() : undefined
        },
      }))
      .views(self => ({
        /**
         * #getter
         */
        get coarseAdapterSlot() {
          return 'summaryAdapter'
        },
        /**
         * #getter
         * Whether the view is zoomed out past the force-load floor, read from
         * `RegionTooLargeMixin`'s gate so the tier swap and the gate agree on
         * the floor.
         */
        get coarseTierPastThreshold() {
          return self.aboveForceLoadFloor
        },
        /**
         * #getter
         * What the summary RPC reads beyond its regions and byte budget: the
         * adapter and the focus it filters records by. The detail fetch's
         * other settings never reach it.
         */
        get summaryReadArgs() {
          return {
            adapterConfig: self.adapterConfig,
            rowFocus: self.rowFocusKey,
          }
        },
        /**
         * #getter
         * `summaryReadArgs`, and whether the strip wants frames read beside
         * the summary: the detail tier always reads them, the summary tier
         * only for the strip.
         */
        get coarseReadKey() {
          return {
            args: this.summaryReadArgs,
            frames: self.framesActive,
          }
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The coverage band is on and has data: `showCoverage` alone is not
         * enough, since the summary tier has no `coverage.coverageDepths`.
         *
         * `topBands` reads this as the band's `active` half, and the data
         * questions (autoscaling, the depth rules) read it directly; whatever
         * places something in the band reads `topBands.rects`. Only the track
         * menu reads `showCoverage`, so the tick keeps the user's choice
         * across zoom. Same split as `rowPlan` vs the slots it resolves.
         */
        get coverageBandActive() {
          return self.showCoverage && !self.coarseTierActive
        },
        /**
         * #getter
         * The conservation band is on and has data: twin of
         * `coverageBandActive`, since the identity scores are computed from
         * alignment blocks, which the summary tier lacks.
         *
         * `topBands` and the conservation encode read this; the menu tick
         * reads `showConservation`.
         */
        get conservationBandActive() {
          return self.showConservation && !self.coarseTierActive
        },
      }))
      .views(self => ({
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
         * The anchor species whose `mafFrames` reading frame translates every
         * row (UCSC `codonDefault`). Tied to the reference assembly's
         * `referenceSampleId`, not the top row, since codons compare against
         * the reference sequence (`block.refSeqBytes`). Falls back to the
         * worker's first row when the reference is not a listed sample.
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
         * The reference's display row for the band's codon mode, matching the
         * per-base band's worker-side `refSampleId`; -1 where the reference is
         * no drawn row.
         */
        get referenceRowIndex(): number {
          const refSrc = self.referenceSampleId
          return refSrc === undefined
            ? -1
            : (self.rowIndexBySrc.get(refSrc) ?? -1)
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The detail tier's store: `MultiRegionDisplayMixin`'s per-region
         * payloads narrowed to the worker's columnar rows plus the CDS frames
         * from the same fetch. A reorder re-places from here without
         * refetching.
         */
        get detailPayloads(): ReadonlyMap<
          number,
          MafRegionPayload<MafWireRegionData>
        > {
          return self.regionPayloads as ReadonlyMap<
            number,
            MafRegionPayload<MafWireRegionData>
          >
        },
      }))
      .views(self => {
        const placed = createEncodeMemo(
          () => self.detailPayloads,
          () => self.rowIndexBySrc,
          (payload, rowIndexBySrc) =>
            placeMafRegionData(payload.data, rowIndexBySrc),
        )
        return {
          /**
           * #getter
           * `detailPayloads` with every row assigned its on-screen `rowIndex`
           * (`placeMafRegionData`). Everything that draws, hit-tests or
           * measures rows reads this.
           *
           * The memo is held in this closure so it outlives a context-loss recovery;
           * `afterAttach` installs the observer it needs.
           */
          get rpcDataMap(): ReadonlyMap<number, MafRegionData> {
            return placed()
          },
        }
      })
      .views(self => ({
        /**
         * #getter
         * `rpcDataMap` while the detail tier draws, and nothing on the summary
         * tier: `CoarseTierMixin` keeps the detail store under the tier, so
         * whatever marks, hovers or navigates by the alignment reads this.
         */
        get detailOnScreen(): ReadonlyMap<number, MafRegionData> {
          return self.coarseTierActive ? NO_DETAIL : self.rpcDataMap
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Per-region CDS frame rows (UCSC `mafFrames`) for the frames strip.
         * The tier on screen is checked first and the other tier fills gaps,
         * so the strip stays visible across the summary-detail swap.
         */
        get framesDataMap(): ReadonlyMap<number, MafFrameRecord[]> {
          const detail = self.detailPayloads
          const summary = self.coarseTier
          const [first, second] = self.coarseTierActive
            ? [summary, detail]
            : [detail, summary]
          const frames = new Map<number, MafFrameRecord[]>()
          for (const tier of [second, first]) {
            for (const [displayedRegionIndex, payload] of tier) {
              if (payload.frames) {
                frames.set(displayedRegionIndex, payload.frames)
              }
            }
          }
          return frames
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The plot the bands share with the rows: the track height less the
         * focus chip's line, keeping the rows a floor while they show.
         */
        get bandPlot() {
          return {
            height: self.allottedHeight - self.rowFocusLineHeight,
            floor: self.showAlignments ? MIN_BAND_HEIGHT : 0,
          }
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The band stack, coverage above conservation (`mafTopBands`): the
         * stated heights bound against `bandPlot`, each band's tops and
         * rect. Every top, height and offset reads this; a band that reserves
         * 0 px does not draw.
         */
        get topBands() {
          return mafTopBands(
            {
              coverage: {
                active: self.coverageBandActive,
                height: self.coverageHeight,
              },
              conservation: {
                active: self.conservationBandActive,
                height: self.conservationHeight,
              },
            },
            self.bandPlot,
          )
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Read `topBands.rects.coverage.height`.
         * @deprecated
         */
        get coverageDisplayHeight() {
          return self.topBands.rects.coverage.height
        },
        /**
         * #getter
         * Read `topBands.rects.conservation.height`.
         * @deprecated
         */
        get conservationDisplayHeight() {
          return self.topBands.rects.conservation.height
        },
        /**
         * #getter
         * `TreeSidebarMixin`'s hook: where the band stack ends. Every rows
         * hit-test, draw and export offset reads the mixin's `rowsTopOffset`
         * over it, so adding a band or the focus chip's line can't desync them.
         */
        get rowsHeaderHeight() {
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
         * The per-sample rows area has something to draw: the view can place
         * it, the rows are shown and the row set is known. The `visible*`
         * getters share this gate instead of re-spelling it.
         */
        get rowsVisible() {
          return (
            self.host.initialized && self.showAlignments && self.sourcesKnown
          )
        },
        /**
         * #getter
         * Max CSS-px height the rows canvas may take before its backing store
         * (`× dpr`) hits the browser/GPU canvas limit.
         */
        get maxRowsHeight() {
          return maxCanvasCssPx()
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The track height fit mode divides among the rows: the `height` slot,
         * never the row count, so more species shrink the rows rather than
         * grow the track.
         */
        get fitTargetHeight(): number {
          return self.allottedHeight
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Height of the per-sample rows area: the track height minus the
         * stacked bands, which is the rows canvas. Zero when alignments are
         * hidden. Capped at `maxRowsHeight` to stay under the canvas
         * backing-store limit.
         */
        get rowsHeight() {
          return self.showAlignments
            ? Math.min(
                Math.max(0, self.fitTargetHeight - self.rowsTopOffset),
                self.maxRowsHeight,
              )
            : 0
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Per-row height: the rows area split evenly across the rows, so the
         * rows always fit the track and never scroll. A taller track or a
         * narrower row focus is how a reader gets taller rows.
         *
         * Sub-pixel is legitimate for more species than pixels; only a
         * non-positive height, which every consumer divides by, is floored
         * (agent-docs/reference/ROW_HEIGHT_AND_FIT.md).
         */
        get effectiveRowHeight() {
          const fit = self.rowsHeight / self.nrow
          return fit > 0 ? fit : 1
        },
        /**
         * #getter
         */
        get scrollViewportHeight() {
          return self.rowsHeight
        },
        /**
         * #getter
         * `TreeSidebarMixin`'s hook: off while the alignments are hidden, since
         * the tree lays against rows that are not drawn.
         */
        get drawsTree() {
          return self.showAlignments
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Override BaseLinearDisplay.height so the track container matches the
         * rendering canvases exactly (stacked bands + rows viewport).
         */
        get height() {
          return self.rowsHeight + self.rowsTopOffset
        },
        /**
         * #getter
         * `TreeSidebarMixin`'s hook: `root` with a hidden reference row
         * pruned, since `root` is already narrowed to the focus.
         */
        get treeRoot() {
          return self.root && !self.showReferenceRow
            ? treeOfLeaves(
                self.root,
                self.sources.map(s => s.name),
              )
            : self.root
        },
      }))
      .views(self => ({
        /**
         * #getter
         */
        get svgSidebar(): SvgSidebarProps {
          return {
            showTree: self.showTree,
            hierarchy: self.hierarchy,
            sources: self.sources,
            rowHeight: self.effectiveRowHeight,
            treeAreaWidth: self.treeAreaWidth,
            showLabels: self.showRowLabels,
          }
        },
      }))
      .actions(self => ({
        /**
         * #action
         * The coverage band's height, clamped as every band drag is
         * (`clampBandHeight`) to the room the other band and the rows' floor
         * leave (`bandDragBounds`).
         */
        setCoverageHeight(height: number) {
          setConf(
            self,
            ['coverage', 'height'],
            clampBandHeight(
              self.coverageHeight,
              height,
              bandDragBounds(self.topBands, 'coverage', self.bandPlot),
            ),
          )
        },
        /**
         * #action
         * The conservation band's height, clamped as `setCoverageHeight` is.
         */
        setConservationHeight(height: number) {
          setConf(
            self,
            ['conservation', 'height'],
            clampBandHeight(
              self.conservationHeight,
              height,
              bandDragBounds(self.topBands, 'conservation', self.bandPlot),
            ),
          )
        },
      }))
      .actions(self => ({
        /**
         * #action
         * Reorder the rows by the base each species has in the reference
         * column at (refName, pos), writing the order to `rows.sort` as
         * clustering and the arrangement dialog do, so "Reset row order" undoes
         * all three.
         *
         * Declines with fewer than two rows or at a column no loaded region
         * covers; `sortRowsAtColumn` owns both gates and the returned "did it
         * sort".
         */
        sortRowsByBaseAt(refName: string, pos: number) {
          return sortRowsAtColumn(
            self,
            refName,
            pos,
            index => self.detailOnScreen.get(index),
            (sources, region) =>
              orderMafRowsByBaseAt(sources, self.sources, region, pos),
          )
        },
      }))
      .views(self => ({
        /**
         * #method
         * Items for the right-click menu, built from the column under the
         * click. Captured when the menu opens, since `closeContextMenu`
         * runs before an item's onClick.
         */
        contextMenuItems(): MenuItem[] {
          const info = self.contextMenuInfo
          const zoomHint = self.coarseTierActive ? ZOOM_IN_FOR_BAND : undefined
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
         * Theme-derived color palette (per-base colors plus match, gap,
         * mismatch, unknown, insertion), read by `rowsEncodeProps()` and
         * `renderState`. Derived from the session theme, so it exists in
         * headless SVG export and RPC. A theme change re-encodes on the main
         * thread without a refetch.
         */
        // #region colorPalette
        get colorPalette(): MafColorPalette {
          return getMafColorPalette(getPaletteHost(self).palette)
        },
        // #endregion
        /**
         * #getter
         * Genomic bp the GPU encoder merges into one cell: the foundation's
         * `settledSubPixelBinBp`. Zoomed in this is `1`; once a base falls
         * below half a CSS pixel the encoder samples one per bin.
         */
        get encodeBinBp() {
          return self.settledSubPixelBinBp
        },
      }))
      .views(self => ({
        /**
         * #method
         * Where the rows sit on screen: the row height plus the scroll offset
         * and viewport. Every rows layer reads this one method.
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
         * The fetch inputs both tiers send through `rpcArgs` and cache under.
         * The focus is a row set since the worker ships only those genomes; the
         * row order is not, since the client places the rows. No
         * fetch-derived state belongs here (`singleFetchPerRegion.test.ts`).
         */
        rpcProps() {
          return {
            rowFocus: self.rowFocusKey,
            interbaseIndicators: self.interbaseIndicatorRule,
          }
        },
      }))
      .views(self => ({
        /**
         * #getter
         * `ScoreScaleMixin`'s hook: the depth range over the visible content
         * blocks, from the worker-shipped `coverage.coverageDepths`, widened
         * to the `coverage.encoding.y` rules.
         */
        get autoscaleRange(): [number, number] | undefined {
          return visibleStatsRange({
            active: self.coverageBandActive,
            view: self.view,
            payloadFor: index => self.rpcDataMap.get(index)?.coverage,
            itemsFor: coverage => [coverage],
            accumulate: entries => computeVisibleCoverageStats(entries),
            range: (stats, entries) =>
              widenRangeToRules(
                computeVisibleCoverageDomain({
                  stats,
                  quantile: self.fenceQuantile,
                  entries,
                }),
                self.scoreRules.map(rule => rule.value),
              ),
          })
        },
        /**
         * #getter
         * Depth floors at 0 while the axis reaches zero.
         */
        get defaultScoreDomain(): [number | undefined, number | undefined] {
          return [self.scaleZero ? 0 : undefined, undefined]
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The domain the coverage band draws against, a log scale's floor at
         * one read; the ticks and the marks both read it.
         */
        get coverageDepthDomain(): [number, number] | undefined {
          const domain = self.autoscaledDomain
          return domain
            ? coverageDepthDomain(domain, self.scaleType)
            : undefined
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Overrides `ScoreScaleMixin`'s: `coverage.encoding.y.rules` are depths, so they
         * draw on the coverage band, never on the fixed conservation scale.
         */
        get scoreRulesDrawn(): boolean {
          return self.coverageBandActive
        },
        /**
         * #getter
         * The scales the chrome places the axes from: coverage over its
         * autoscaled depth, and conservation over a fixed 0-100%.
         */
        get valueScales(): ValueScale[] {
          return mafValueScales({
            topBands: self.topBands,
            coverageDomain: self.coverageDepthDomain,
            scaleType: self.scaleType,
            symlogConstant: self.symlogConstant,
            guide: self.axisGuide,
          })
        },
        /**
         * #getter
         * The coverage band's palette slots, packed. Separate from
         * `renderState` so the nine-color CSS parse memoizes against the
         * palette.
         */
        get coverageBandColors() {
          return mafCoverageBandColors(getPaletteHost(self).palette)
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The coverage band as the shared marks and their hit test take it.
         * Height 0 draws no band: the setting is off or the summary tier owns
         * the view.
         */
        get coverageBandState(): CoverageBandState {
          const [domainMin, domainMax] = self.coverageDepthDomain ?? [0, 0]
          return {
            ...self.topBands.rects.coverage,
            domainMin,
            domainMax: self.coverageDepthDomain?.[1],
            scaleType: scaleTypeCode(self.scaleType),
            symlogConstant: resolveSymlogConstant(
              domainMin,
              domainMax,
              self.symlogConstant,
            ),
            minAlleleFraction: self.coverageMinAlleleFraction,
            showAlleles: self.showCoverageAlleles,
            showInterbase: self.showInterbase,
            colors: self.coverageBandColors,
          }
        },
      }))
      .views(self => ({
        /**
         * #method
         * Where the rows `[startRow, endRow)` sit in their genomes across
         * the reference bp range `[startBp, endBp)`, the loci an "open this
         * species here" navigation targets. A row contributes nothing with no
         * aligned base in the range, no fetched block covering it, or a genome
         * not loaded as an assembly (`MafSource.assemblyName` unset).
         *
         * Takes the whole row range at once, since the menu builds an entry per
         * row on every open.
         */
        rowNavigationTargets(
          displayedRegionIndex: number,
          startBp: number,
          endBp: number,
          startRow: number,
          endRow: number,
        ) {
          return rowNavigationTargetsOf({
            sources: self.sources,
            assemblies: getSession(self).assemblyManager,
            detail: self.detailOnScreen,
            displayedRegionIndex,
            startBp,
            endBp,
            startRow,
            endRow,
          })
        },
        /**
         * #method
         * The CDS frame record covering absolute genomic `bp` (uint32) on
         * display `rowIndex`, or undefined. Gated on `framesInUse`, so the gene
         * name reads on hover in codon view with the strip off.
         *
         * `bp` is a base index (`MafPointer.baseBp`), not a floored `gposFrac`,
         * matching the row hover and coverage tooltip on a reversed region.
         */
        frameHoverInfo(
          displayedRegionIndex: number,
          bp: number,
          rowIndex: number,
        ) {
          if (!self.framesInUse) {
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
         * The interbase bar or indicator triangle under a canvas point in the
         * coverage band, through the shared band's own hit test, or undefined
         * for the depth area and everywhere else.
         */
        coverageBandHit(displayedRegionIndex: number, x: number, y: number) {
          const coverage = self.rpcDataMap.get(displayedRegionIndex)?.coverage
          const block = self.renderBlocks.find(
            b => b.displayedRegionIndex === displayedRegionIndex,
          )
          return coverage && block
            ? hitCoverageBand(coverage, self.coverageBandState, block, x, y)
            : undefined
        },
        /**
         * #method
         * The depth and SNP tooltip bin at the base under the cursor, with the
         * percent identity at that position. Undefined when the region has no
         * fetched data or depth is zero.
         */
        coverageTooltipBin(
          displayedRegionIndex: number,
          basePos: number,
          bpPerPx: number,
          reversed = false,
        ) {
          const coverage = self.rpcDataMap.get(displayedRegionIndex)?.coverage
          return coverage
            ? coverageTooltipBinAt(
                coverage,
                basePos,
                bpPerPx,
                reversed,
                self.coverageBandState,
              )
            : undefined
        },
        /**
         * #method
         * The insertions at a band boundary the hit test named, summarized the
         * way the alignments band summarizes its interbase events.
         */
        interbaseTooltipBin(displayedRegionIndex: number, position: number) {
          const coverage = self.rpcDataMap.get(displayedRegionIndex)?.coverage
          const bin = coverage
            ? buildCoverageTooltipBin(
                position,
                coverage,
                coverage,
                {
                  interbasePositions: coverage.insertionPositions,
                  interbaseLengths: coverage.insertionLengths,
                },
                position,
              )
            : undefined
          return bin?.interbase.insertion
            ? { interbase: bin.interbase, interbaseDepth: bin.interbaseDepth }
            : undefined
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The orientation each (row, source chromosome) is measured against for
         * the inversion indicator (`consensusStrandByRowRefName`). Memoized because
         * it walks every block and row of every loaded region while its
         * consumer runs on every pan and zoom. Empty when the indicator is off.
         */
        get inversionConsensus(): StrandConsensus {
          return self.showInversions
            ? consensusStrandByRowRefName(self.rpcDataMap)
            : new Map<number, Map<string, number>>()
        },
      }))
      .views(self => {
        const overlayParams = () => ({
          view: self.host,
          rpcDataMap: self.detailOnScreen,
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
         * At base level each reference base spans at least a pixel (UCSC's
         * `zoomedToBaseLevel`). Reads the debounced `coarseBpPerPx` so the
         * rendering swap does not thrash mid-zoom. False until the view is
         * initialized.
         */
        get zoomedToBaseLevel() {
          const view = self.view
          return view.initialized && view.coarseBpPerPx <= 1
        },
      }))
      .views(self => {
        const superConfigProblemsOf = self.configProblemsOf
        const keepPlan = sameAsLast<RowPlan>()
        return {
          /**
           * #method
           * The schema's rules, then what the rows cannot paint as written: a
           * coverage layer filter test its layer does not make, a codon color
           * with no reading frames, and a range on a field that paints the
           * theme's colors.
           */
          configProblemsOf(conf: AnyConfigurationModel): string[] {
            const bases: MafBasesField | undefined = readConfObject(conf, [
              'alignments',
              'bases',
              'show',
            ])
              ? readConfObject(conf, [
                  'alignments',
                  'bases',
                  'encoding',
                  'color',
                  'field',
                ])
              : undefined
            return [
              ...superConfigProblemsOf(conf),
              ...coverageLayerProblems(conf.coverage),
              ...(bases === 'codon' && !self.framesAdapterConfig
                ? [
                    'alignments.bases.encoding.color.field: codon needs a framesAdapter on the MAF adapter to define reading frames, so the layer draws nothing',
                  ]
                : []),
            ]
          },
          /**
           * #getter
           * What the rows draw now (`resolveRowPlan`). The same object while
           * its members are, since every region's encode keys on it: crossing
           * base level with nothing to redraw re-encodes nothing.
           */
          get rowPlan(): RowPlan {
            const next = resolveRowPlan({
              field: self.colorField,
              y: self.yField,
              mismatches: self.showMismatches,
              bases: self.basesField,
              summaryTier: self.coarseTierActive,
              baseLevel: self.zoomedToBaseLevel,
              hasFrames: !!self.framesAdapterConfig,
            })
            return keepPlan(next)
          },
        }
      })
      .views(self => ({
        /**
         * #getter
         * Render state passed to the GPU/Canvas2D backend each frame.
         *
         * `canvasHeight` is the whole canvas, stacked bands plus rows viewport,
         * because the coverage band draws on the same canvas as the rows.
         * `rowsTop` and `rowsHeight` are the rows band inside it.
         */
        get renderState(): MafGPURenderState {
          // Never undefined: zero sources over a region with no blocks is valid
          // state, and withholding it leaves the loading overlay spinning. The
          // first-paint gate is `hasFetched`.
          return {
            canvasWidth: self.canvasWidthPx,
            canvasHeight: self.rowsTopOffset + self.rowsHeight,
            rowsTop: self.rowsTopOffset,
            rowsHeight: self.rowsHeight,
            coverage: self.coverageBandState,
            conservation: self.topBands.rects.conservation,
            rowHeight: self.effectiveRowHeight,
            rowProportion: self.rowProportion,
            scrollTop: self.scrollTop,
            cellsFill: self.rowPlan.color === undefined,
            palette: self.colorPalette,
          }
        },
      }))
      .views(self => ({
        /**
         * #method
         * The hover on `rowIndex` at the cursor's genomic position: an aligned
         * base, an insertion, a deletion or a bridged region, tagged with the
         * sample label. `bp` holds both readings of the cursor (`HoverBp`),
         * which differ on a reversed region.
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
              ? self.detailOnScreen.get(displayedRegionIndex)
              : undefined
          const hit = region
            ? findRowHoverAtBp(
                region,
                bp,
                rowIndex,
                bpPerPx,
                self.rowPlan.perBase ? self.encodeBinBp : undefined,
                drawnRowHeightPx(self.effectiveRowHeight, self.rowProportion),
              )
            : undefined
          if (!hit) {
            return undefined
          }
          const source = sources[rowIndex]!
          return {
            ...hit,
            sampleLabel: source.label,
          }
        },
        /**
         * #method
         * The mean identity of the window a heatmap cell or X-Y bar paints at
         * base `bp` on `rowIndex`, and how many bases it averages, while
         * identity draws.
         */
        identityHoverInfo(
          displayedRegionIndex: number,
          bp: number,
          rowIndex: number,
        ) {
          const { color, mark } = self.rowPlan
          const region =
            color === 'identity' || mark === 'bar'
              ? self.detailOnScreen.get(displayedRegionIndex)
              : undefined
          const binBp = self.encodeBinBp
          const start = Math.floor(bp / binBp) * binBp
          return region
            ? identityOver(region.blocks, rowIndex, start, start + binBp)
            : undefined
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Positioned per-base letters, over the bases only.
         */
        get visibleLabels() {
          return self.rowsVisible && !self.resizing && self.rowPlan.perBase
            ? computeVisibleLabels({
                view: self.host,
                rpcDataMap: self.detailOnScreen,
                ...self.rowGeometry(),
                paints: basePaintsOf(self.rowPlan),
              })
            : []
        },
        /**
         * #getter
         * Positioned deletion runs, labelled with their length where it fits.
         * Only the bases paint the gap cells the count is colored against.
         */
        get visibleDeletions() {
          return self.rowsVisible && self.rowPlan.perBase
            ? computeVisibleDeletions({
                view: self.host,
                rpcDataMap: self.detailOnScreen,
                ...self.rowGeometry(),
              })
            : []
        },
        /**
         * #getter
         * The summary records each region's rows draw as per-species presence
         * bars, keyed by displayedRegionIndex.
         *
         * Drawn on the summary tier and as the stand-in for a region whose
         * detail tier has not landed, so zooming in past the floor does not
         * blank the track. Suppressed per region, since tiers arrive per
         * region; `coarseTierActive` short-circuits it because both maps hold a
         * region side by side.
         */
        get summaryDataMap(): ReadonlyMap<number, MafSummaryRecord[]> {
          const shown = new Map<number, MafSummaryRecord[]>()
          if (self.rowsVisible) {
            for (const [i, entry] of self.coarseTier) {
              if (self.coarseTierActive || !self.rpcDataMap.has(i)) {
                shown.set(i, entry.data)
              }
            }
          }
          return shown
        },
        /**
         * #getter
         * Positioned per-species CDS frame boxes for the frames strip. Empty
         * unless a frames adapter is configured and the strip is on. Reuses the `src`-to-row mapping of the summary bars.
         */
        get visibleFrames(): FrameMarker[] {
          return self.rowsVisible && self.framesActive
            ? computeVisibleFrames({
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
            self.rowPlan.bases === 'codon' &&
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
            self.conservationBandActive &&
            self.conservationUnit === 'codon' &&
            !!self.framesAdapterConfig &&
            !!self.defaultCodonSpecies
          )
        },
      }))
      .views(self => {
        const keepRanks = sameAsLast<ReturnType<typeof perRowRefNameRanks>>()
        return {
          /**
           * #getter
           * Each row's source sequences ranked by aligned bp over the loaded
           * regions, so a pan within loaded data keeps every block's color.
           * Empty unless `refNameRank` fills the rows. The same object while
           * the ranks are, so a fetch that ranks nothing new re-encodes only
           * its own region.
           */
          get refNameRanks(): ReturnType<typeof perRowRefNameRanks> {
            const next =
              self.rowPlan.color === 'refNameRank'
                ? perRowRefNameRanks(self.rpcDataMap.values())
                : { ranks: new Map<number, Map<string, number>>(), maxRank: 0 }
            return keepRanks(next)
          },
        }
      })
      .views(self => ({
        /**
         * #getter
         * Titles for the stacked bands, with the y they sit at; empty unless
         * both bands reserve px. The on-screen labels and the SVG export both read
         * it.
         *
         * The conservation title names what the band draws
         * (`codonConservationActive`), not the mode asked for.
         */
        get bandLabels(): { text: string; top: number }[] {
          const { coverage, conservation } = self.topBands.rects
          return coverage.height > 0 && conservation.height > 0
            ? [
                { text: 'Coverage', top: coverage.top },
                {
                  text: self.codonConservationActive
                    ? 'Conservation (aa identity)'
                    : 'Conservation (% identity)',
                  top: conservation.top,
                },
              ]
            : []
        },
        /**
         * #getter
         * `LegendMixin`'s hook: the key for the fill `rowPlan` paints, the
         * codon layer's, then the CDS frame key while the strip draws, then
         * the row color key. Each key is built by the module that paints it,
         * so the swatches match the screen.
         */
        get colorScales(): ColorScale[] {
          return this.colorScalesIn(getPaletteHost(self).palette)
        },
        /**
         * #method
         * `colorScales` in another theme: the SVG export's, whose codon and
         * CDS-frame swatches follow it.
         */
        colorScalesIn(palette: JBrowsePalette): ColorScale[] {
          return self.host.initialized
            ? mafColorScales({
                palette,
                plan: self.rowPlan,
                colorEncoding: self.colorEncoding,
                colorKeyTitle: self.colorKeyTitle,
                oneBaseCells: self.encodeBinBp === 1,
                maxRefNameRank: self.refNameRanks.maxRank,
                showsFrames: self.visibleFrames.length > 0,
                rowColorScales: self.rowColorScales,
              })
            : []
        },
        /**
         * #getter
         * Whether this display has a color key, as opposed to whether one is
         * drawn now: the question "Legend" is offered on. A constant fill
         * and the bases key nothing; a field, the bars' height, the codon
         * layer and the frame strip key what they paint. Read off the
         * settings rather than `rowPlan` or the frames on screen, so the row
         * stays put through zoom and pan.
         *
         * Overrides `LegendMixin`'s, whose scale reads decline on an
         * uninitialized view and would drop the row while a track loads.
         */
        get hasLegendKey(): boolean {
          return (
            self.colorField !== undefined ||
            self.yField !== undefined ||
            (self.basesField === 'codon' && !!self.framesAdapterConfig) ||
            self.framesActive ||
            self.rowColorScales.length > 0
          )
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
              ...editPlotMenuItems(self),
              ...mafLaunchMenuItems({
                session: getSession(self),
                model: self,
                view: containingLgv(self),
                pluginManager: getEnv(self).pluginManager,
              }),
            ]
          },
        }
      })
      // #endregion
      .views(self => ({
        /**
         * #method
         * What a region's rows encode reads beyond the region, in a given
         * palette, since the SVG export's theme need not be the session's. A
         * mode flip lives here so it re-encodes every region as a declared
         * input.
         */
        rowsEncodePropsIn(colorPalette: MafColorPalette): MafRowsEncodeProps {
          return {
            plan: self.rowPlan,
            value: self.colorValue,
            identityColors: self.identityColors,
            gpu: {
              palette: colorPalette,
              binBp: self.encodeBinBp,
            },
            refNameRanks: self.refNameRanks.ranks,
            refNameRankPalette: self.refNameRankPalette,
            rowIndexBySrc: self.rowIndexBySrc,
            codons:
              (self.codonCellsActive || self.codonConservationActive) &&
              self.defaultCodonSpecies !== undefined
                ? {
                    anchor: self.defaultCodonSpecies,
                    cells: self.codonCellsActive,
                    band: self.codonConservationActive,
                    refRowIndex: self.referenceRowIndex,
                  }
                : undefined,
            conservation:
              self.conservationBandActive && !self.codonConservationActive,
          }
        },
        /**
         * #method
         * `rowsEncodePropsIn` in the session's palette, for the on-screen
         * encode.
         */
        rowsEncodeProps(): MafRowsEncodeProps {
          return this.rowsEncodePropsIn(self.colorPalette)
        },
      }))
      .views(self => {
        const join = createRowsSourceJoin()
        return {
          /**
           * #getter
           * Each region's detail and summary tiers, paired: what its rows
           * draw from. A pair keeps its identity while neither tier moved.
           */
          get rowsSources(): ReadonlyMap<number, MafRowsSource> {
            return join(
              self.detailOnScreen,
              self.summaryDataMap,
              self.framesDataMap,
            )
          },
        }
      })
      .views(self => {
        const encoded = createEncodeMemo(
          () => self.rowsSources,
          () => self.rowsEncodeProps(),
          (source, props): MafUploadPayload => ({
            ...encodeMafRows(source, props),
            coverage: source.detail?.coverage ?? EMPTY_MAF_COVERAGE,
          }),
        )
        return {
          /**
           * #getter
           * Every loaded region's upload payload, the rows band's `span`
           * channels beside the coverage band's buffers, keyed by
           * displayedRegionIndex. Held here rather than in the upload's setup
           * thunk so a theme or color change re-encodes without an RPC
           * roundtrip and the memo outlives a context-loss recovery.
           */
          get encodedUpload(): ReadonlyMap<number, MafUploadPayload> {
            return encoded()
          },
        }
      })
      .views(self => ({
        /**
         * #method
         * The codon under the cursor on `rowIndex` at base `bp`, while the
         * codon view draws, from the codons its cells were encoded from.
         */
        codonHoverInfo(
          displayedRegionIndex: number,
          bp: number,
          rowIndex: number,
        ) {
          return self.rowPlan.bases === 'codon'
            ? findCodonAt(
                self.encodedUpload.get(displayedRegionIndex)?.codons,
                bp,
                rowIndex,
              )
            : undefined
        },
        /**
         * #getter
         * The amino-acid letters over the codon view's cells.
         */
        get visibleCodonGlyphs(): CodonGlyph[] {
          return self.codonCellsActive
            ? computeVisibleCodonGlyphs(
                self.host,
                {
                  get: (i: number) => self.encodedUpload.get(i)?.codons,
                },
                self.rowGeometry(),
              )
            : []
        },
        /**
         * #method
         * The conservation bar painted over base `bp`, read from the bars the
         * band draws, so a binned window or a codon answers as it paints.
         */
        conservationHoverInfo(displayedRegionIndex: number, bp: number) {
          const bars =
            self.encodedUpload.get(displayedRegionIndex)?.conservation
          const bar = bars ? conservationBarAt(bars, bp) : undefined
          return bar
            ? { ...bar, codons: self.codonConservationActive }
            : undefined
        },
        /**
         * #method
         * The summary record whose bar is drawn at canvas x `x` on display row
         * `rowIndex`, or undefined: the hover on the summary tier.
         */
        summaryHoverInfo(rowIndex: number, x: number) {
          return summaryAt(
            self.encodedUpload,
            self.renderBlocks,
            self.renderState,
            rowIndex,
            x,
          )
        },
      }))
      .actions(self => ({
        /**
         * #action
         * The picker Color by's Solid color... opens, on the theme's match
         * tone until a constant is written.
         */
        openSolidColorDialog() {
          const written = self.colorValue
          getDialogHost(self).queueDialog(handleClose => [
            SolidColorDialog,
            {
              label: 'Alignment color',
              color: written ?? self.colorPalette.matchColor,
              written,
              onChange: (color: string) => {
                self.setColorValue(color)
              },
              onReset: () => {
                self.setColorValue(undefined)
              },
              handleClose,
            },
          ])
        },
        /**
         * #action
         * The reference row the last detail batch named — see
         * `refSampleIdVolatile`. Written beside `setSamples` in the batch
         * commit, so a stale batch names nothing.
         */
        setRefSampleId(id: string | undefined) {
          self.refSampleIdVolatile = id
        },
        /**
         * #action
         * Record whether the last frames read was declined as over budget. Set
         * both ways by every fetch pass that reaches the frames adapter, so
         * zooming back in clears it without anything else having to.
         */
        setFramesGateBlocked(blocked: boolean) {
          self.framesGateBlocked = blocked
        },
        /**
         * #action
         * Clears the verdict with the data: it describes a read of the viewport
         * just thrown away, and chromosome nav would otherwise show "too much
         * data" for an unmeasured region.
         */
        clearDisplaySpecificData() {
          self.framesGateBlocked = false
        },
        /**
         * #action
         */
        startRenderingBackend(backend: MafRenderingBackend) {
          installUpload(self, backend, {
            cells: () => self.encodedUpload,
            render: (b, encoded) => {
              const hasFetched =
                self.sourcesKnown ||
                self.hasRegionData ||
                self.coarseTierRead !== undefined
              // One call whatever the rows do: this canvas carries the coverage
              // band too.
              return hasFetched
                ? b.renderBlocks(
                    self.renderBlocks,
                    encoded,
                    self.renderState,
                  ) || !self.rowPlan.perBase
                : false
            },
          })
        },
      }))
      .actions(self => ({
        /**
         * #action
         * The detail fetch. The summary tier's is `fetchCoarseTier` below, and
         * `CoarseTierMixin` suspends this one while the tier is up.
         */
        fetchNeeded(needed: IndexedRegion[]) {
          return fetchMafAlignmentData(self, needed)
        },
        /**
         * #action
         */
        fetchCoarseTier(
          read: CoarseTierRead,
          ctx: FetchContext,
        ): Promise<CoarseTierResult<MafRegionPayload<MafSummaryRecord[]>>> {
          return fetchMafSummaryData(self, read.regions, ctx)
        },
      }))
      .views(() => ({
        /**
         * #getter
         * Enables byte-estimate gating: a MAF-aware estimate (per-species
         * sequence x span) is checked against `fetchSizeLimit` inside the
         * tier's own RPC, blocking the fetch with a force-load prompt.
         *
         * On for both tiers: each RPC measures the file it reads, the alignment
         * index on detail and the `summaryAdapter` sub-adapter on summary
         * (`CoarseTierMixin`), since the summary read is a whole-feature
         * download over every zoom from 20kb up.
         */
        get gateEnabled() {
          return true
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
        afterAttach() {
          // A memo because pointer handlers consume `rpcDataMap`, and MobX
          // discards an unobserved computed's value.
          namedAutorun(
            self,
            () => {
              void self.rpcDataMap
            },
            { name: 'Maf:placedRows' },
          )
          setupTreeSidebarAutoruns(self, {
            name: 'Maf',
            sortRows: (refName, pos) => self.sortRowsByBaseAt(refName, pos),
            clustering: {
              run: async args => {
                const { runMafClustering } =
                  await import('./runMafClustering.ts')
                await runMafClustering({ model: self, ...args })
              },
            },
          })
        },
      }))
  )
}

export type LinearMafDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearMafDisplayModel = Instance<LinearMafDisplayStateModel>
