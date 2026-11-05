import {
  INDICATOR_TRIANGLE_H,
  INDICATOR_TRIANGLE_HW,
  coverageDepthDomain,
  LABEL_FADE_FLOOR,
  LABEL_FADE_HI_RATIO,
  LABEL_FADE_LO_RATIO,
  LONG_INSERTION_MIN_LENGTH,
  MIN_HEIGHT_FOR_TEXT,
  MIN_PX_PER_BP_FOR_TEXT,
  insertionBarWidth,
  insertionSizeAlpha,
  interbaseEdgePx,
  labelFont,
  pairDirectionOfNum,
  readIdAt,
  readInterbaseSegments,
  readNameAt,
  readModCovSegments,
  readSnpSegments,
} from '@jbrowse/alignments-core'
import {
  COVERAGE_Y_PATHS,
  coverageBandSlotViews,
} from '@jbrowse/alignments-core/coverageBandConfigSchema'
import {
  fullConfSnapshot,
  getConf,
  readConfObject,
  refusingUndeclaredKeys,
} from '@jbrowse/core/configuration'
import { isSequenceAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { tablesFeatureAdapter } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import {
  DEFAULT_BYTE_LIMIT,
  lociOf,
  overByteLimitError,
} from '@jbrowse/core/data_adapters/tables'
import { overByteBudget, totalRegionBytes } from '@jbrowse/core/rpc/byteBudget'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { rampKeyOf } from '@jbrowse/core/ui/rampKey'
import { adapterRefNameText } from '@jbrowse/core/util'
import {
  abgrAlpha,
  abgrToHex,
  cssColorToHex,
  normalizedRgbToHex,
} from '@jbrowse/core/util/colorBits'
import { heightModeViews } from '@jbrowse/display-kit/HeightModeMixin'
import { hiddenGroupsViews } from '@jbrowse/display-kit/HiddenGroupsMixin'
import { keyWindowsOf } from '@jbrowse/display-kit/keyWindows'
import { types } from '@jbrowse/mobx-state-tree'
import { connectorPlacement } from '@jbrowse/render-core/marks/connectorPlacement'
import {
  SCALE_TYPE_LINEAR,
  SCALE_TYPE_LOG,
} from '@jbrowse/render-core/scoreScale'
import {
  CONNECTOR_ARROW,
  CONNECTOR_BOW,
  CONNECTOR_LEADING_2,
  CONNECTOR_MINUS_1,
  CONNECTOR_MINUS_2,
  CONNECTOR_STRAIGHT,
} from '@jbrowse/render-core/shaders/connectorMarkConsts'
import { linkStrokeWidthPx } from '@jbrowse/render-core/shaders/linkMark'
import { LINK_SIZE_SCALED } from '@jbrowse/render-core/shaders/linkMarkConsts'
import {
  ScoreScaleMixin,
  resolveSymlogConstant,
  ungroupedAutoscaleViews,
} from '@jbrowse/wiggle-core'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'
import { runInAction } from 'mobx'

import BamAdapterF from './BamAdapter/index.ts'
import CramAdapterF from './CramAdapter/index.ts'
import {
  alignmentsColorViews,
  detectedModificationsOf,
  readPaletteViews,
} from './LinearAlignmentsDisplay/alignmentsColorViews.ts'
import { sortOf } from './LinearAlignmentsDisplay/alignmentsSortConfigSchema.ts'
import {
  READ_COLOR_CATEGORY_BY_INDEX,
  readColorFromCategoryIndex,
} from './LinearAlignmentsDisplay/colorUtils.ts'
import { linearAlignmentsDisplayConfigSchema } from './LinearAlignmentsDisplay/configSchema.ts'
import { configSlotViews } from './LinearAlignmentsDisplay/configSlotViews.ts'
import {
  bandPlotViews,
  coverageAutoscaleViews,
  coverageDomainViews,
  coverageStatsViews,
  coverageTicksViews,
} from './LinearAlignmentsDisplay/coverageScaleViews.ts'
import { groupMaxY } from './LinearAlignmentsDisplay/groupLayout.ts'
import { arcSlotsInWindows } from './LinearAlignmentsDisplay/keyWindows.ts'
import { featureSpacingForHeight } from './LinearAlignmentsDisplay/menus/compactnessPresets.ts'
import { pileupConfigSchema } from './LinearAlignmentsDisplay/pileupConfigSchema.ts'
import {
  connectorSettingViews,
  connectorViews,
  facetLayoutViews,
  groupLayoutViews,
  pileupLayoutViews,
} from './LinearAlignmentsDisplay/pileupLayoutViews.ts'
import { pileupMismatchesOpacityConfigSchema } from './LinearAlignmentsDisplay/pileupMismatchesOpacityConfigSchema.ts'
import {
  intronAlpha,
  shouldDrawOverlaps,
} from './LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { boundCoverageHeight } from './LinearAlignmentsDisplay/sectionLayout.ts'
import { executeRenderAlignmentData } from './RenderAlignmentDataRPC/executeRenderAlignmentData.ts'
import { appliedPileupSort } from './RenderAlignmentDataRPC/sortLayout.ts'
import { UNCAPPED } from './RenderAlignmentDataRPC/types.ts'
import {
  ARC_COLOR_INTERCHROM,
  arcColorSlot,
} from './features/arcs/arcColors.ts'
import {
  arcsToRegionResult,
  regionIndexOf,
} from './features/arcs/arcRegions.ts'
import {
  ARC_SPLIT_SWATCH,
  isArcSplitCategory,
} from './features/arcs/arcSplitCategory.ts'
import { arcOpacity } from './features/arcs/bandFeed.ts'
import { collectArcs, computeArcsByGroup } from './features/arcs/compute.ts'
import { emptyArcsUploadData } from './features/arcs/types.ts'
import {
  connectorArrowPx,
  connectorInstance,
  linePassInstance,
} from './features/linkedReads/connectorFeed.ts'
import { effectiveBaseColors } from './features/mismatch/baseColors.ts'
import {
  qualityOpacityOf,
  resolvedMismatchOpacity,
} from './features/mismatch/qualityOpacity.ts'
import { byOverlapKind } from './features/overlap/types.ts'
import {
  BASE_QUALITY_UNAVAILABLE,
  qualityAbgr,
} from './features/perBaseQuality/colors.ts'
import {
  junctionColor,
  sashimiArcHeightFraction,
  sashimiStrokeWidth,
} from './features/sashimi/bandFeed.ts'
import { visibleRegionJunctions } from './features/sashimi/computeOverlay.ts'
import {
  SPLIT_JUNCTION_CLASSES,
  junctionClass,
  junctionSource,
} from './features/sashimi/junctionClass.ts'
import {
  mergeJunctions,
  passesJunctionFilter,
} from './features/sashimi/junctions.ts'
import { spliceMotifLabel } from './features/sashimi/motif.ts'
import { arcSlotCategory, buildArcColorPalette } from './shaders/palettes.ts'
import {
  frequencyFadeGate,
  sizeAlpha,
} from './shaders/slang/alignmentsUniforms.js.generated.ts'
import { GAP_SKIP } from './shaders/slang/gap.consts.generated.ts'
import { QUAL_UNAVAILABLE } from './shaders/slang/mismatch.consts.generated.ts'
import { qualityFade } from './shaders/slang/mismatch.js.generated.ts'
import { isBakedField, paintedLevelOf } from './shared/alignmentsColor.ts'
import {
  colorFieldKindOf,
  paintsModifications,
} from './shared/colorFieldDefs.ts'
import { countedEventsOf } from './shared/drawnReads.ts'
import { fieldTag } from './shared/facetLabels.ts'
import { facetUnitNotices, workerFacet } from './shared/groupFeatures.ts'
import { joinSections } from './shared/joinSections.ts'
import {
  arcLegendTitle,
  getArcLegendItems,
  sashimiLegendItems,
  SASHIMI_LEGEND_TITLE,
  sashimiLegend,
  titledReadColorKey,
} from './shared/legendUtils.ts'
import { getModificationName } from './shared/modificationData.ts'
import {
  INTERBASE_INSERTION,
  INTERBASE_SOFTCLIP,
  INTERBASE_TYPE_NAMES,
  getCigarTypeLabel,
  interbaseTypeName,
  isLayoutOrder,
} from './shared/types.ts'
import { getOrCreate } from './shared/util.ts'

import type { RefNamePosition } from './LinearAlignmentsDisplay/colorTagUtils.ts'
import type { ReadColorCategory } from './LinearAlignmentsDisplay/colorUtils.ts'
import type { LinearAlignmentsDisplayConfigModel as DisplayConf } from './LinearAlignmentsDisplay/configSchema.ts'
import type { PileupMismatchesOpacitySnapshot } from './LinearAlignmentsDisplay/pileupMismatchesOpacityConfigSchema.ts'
import type { RegionBounds } from './RenderAlignmentDataRPC/sortLayout.ts'
import type {
  GroupedAlignmentsResult,
  LaidOutPileupData,
  RowCap,
  WorkerPileupData,
} from './RenderAlignmentDataRPC/types.ts'
import type { CrossRegionArc, RegionInfo } from './features/arcs/arcTypes.ts'
import type { ArcsUploadData } from './features/arcs/types.ts'
import type { LinkedPair } from './features/linkedReads/compute.ts'
import type {
  MergedJunction,
  RegionJunctions,
} from './features/sashimi/junctions.ts'
import type { ColorPalette } from './shaders/colors.ts'
import type { ArcCategory } from './shaders/palettes.ts'
import type {
  BaseLayer,
  InterbaseTypeName,
  LayoutOrder,
  JunctionFilter,
  SortColumn,
} from './shared/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { TablesRegion } from '@jbrowse/core/data_adapters/tables'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { KeyWindow } from '@jbrowse/display-kit/keyWindows'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { SettledBlocksView } from '@jbrowse/wiggle-core'

/**
 * #api
 * A region of the reference, as the sequence adapter a track's assembly names
 * reads it: the bases as one string, for a host drawing them under a pileup.
 */
export async function referenceSequence(
  pluginManager: PluginManager,
  {
    sequenceAdapter,
    region,
  }: {
    sequenceAdapter: Record<string, unknown>
    region: { refName: string; start: number; end: number }
  },
) {
  const adapter = await tablesFeatureAdapter(
    pluginManager,
    sequenceAdapter,
    undefined,
  )
  if (!isSequenceAdapter(adapter)) {
    throw new Error(`${String(sequenceAdapter.type)} serves no sequence`)
  }
  return (await adapter.getSequence(region)) ?? ''
}

/** Registers the adapters `alignmentTables` reads through, BAM and CRAM. */
export function registerAlignmentsAdapters(pluginManager: PluginManager) {
  BamAdapterF(pluginManager)
  CramAdapterF(pluginManager)
}

export interface AlignmentTablesArgs {
  adapterConfig: Record<string, unknown>
  /** The assembly's sequence adapter, for CRAM and for reads without MD. */
  sequenceAdapter?: Record<string, unknown>
  /**
   * The regions read as a view lays them side by side: one pileup layout
   * across them, so a read crossing regions keeps its row, one depth axis and
   * one key. Each table's rows name their region's index.
   */
  regions: TablesRegion[]
  /**
   * The display's config as a track's `displays` entry writes it for a
   * `LinearAlignmentsDisplay`. The tables read its `encoding.color`,
   * `filter`, `sort` and `facet` objects, and its four
   * bands: `coverage`, `pileup` (with `pileup.bases`), `sashimi` and
   * `readConnections`, each with its own `show`. `filter` holds the tests on reads, on junctions
   * (the `junction` filter fields) and on connections (the `connection` fields). Unset
   * reads the default display.
   */
  display?: Record<string, unknown>
  /**
   * The assembly's contigs in its own order, spelled as the file spells them,
   * which `encoding.color: "mateRefName"` deals its palette by where no
   * `refNamePosition` is given: a read's mate reference is matched as
   * written. Unset, the file header's order stands in.
   */
  refNames?: readonly string[]
  /**
   * Where a mate reference sits in the assembly's order, canonicalized
   * through its aliases, as the browser's `Assembly.getRefNamePosition`
   * answers it: what `mateRefName` deals its palette by, before `refNames`.
   * The tables engine sets it from the call's `assembly`.
   */
  refNamePosition?: RefNamePosition
  /**
   * The most compressed bytes the regions may need together, refused off the
   * index before any read is fetched. 200 MB by default; a host holds the
   * whole table in memory, where the browser draws it in pieces.
   */
  byteLimit?: number
  /**
   * The most bp the regions may span together, refused before anything is
   * fetched.
   * The coverage band holds every base of the span in memory whatever the
   * file holds, so a sparse file read across a whole contig is bounded here
   * rather than by `byteLimit`. 10 Mb by default.
   */
  spanLimit?: number
}

const DEFAULT_SPAN_LIMIT = 10_000_000

const BASE_OF_CODE: Record<number, string> = {
  65: 'A',
  67: 'C',
  71: 'G',
  84: 'T',
  78: 'N',
}

function pairs(a: ArrayLike<number>) {
  const first = new Float64Array(a.length / 2)
  const second = new Float64Array(a.length / 2)
  for (let i = 0; i < first.length; i++) {
    first[i] = a[2 * i]!
    second[i] = a[2 * i + 1]!
  }
  return [first, second] as const
}

/**
 * Each mismatch's base as a share of the depth at its position: how many reads
 * there carry that base, over the coverage. The worker's own
 * `mismatchFrequencies` is a display fade, zeroed below a depth-dependent
 * threshold, so it is not this.
 */
function alleleFrequencies(d: WorkerPileupData) {
  const counted = countedEventsOf(d)
  const counts = new Map<number, number>()
  for (let i = 0; i < counted.mismatchPositions.length; i++) {
    const key = counted.mismatchPositions[i]! * 256 + counted.mismatchBases[i]!
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from(d.mismatchPositions, (position, i) => {
    const depth = d.coverageDepths[position - d.coverageStartPos] ?? 0
    const count = counts.get(position * 256 + d.mismatchBases[i]!) ?? 0
    return depth > 0 ? Math.min(1, count / depth) : 0
  })
}

const BASES = ['A', 'C', 'G', 'T', 'N'] as const

/**
 * The colors the display paints its per-base and coverage marks in, off its
 * palette: each base through `effectiveBaseColors`, so a modifications or
 * bisulfite layer mutes them, the interbase histogram in its band variants,
 * and each junction as the sashimi band paints it (`junctionColor`).
 */
function markColors(palette: ColorPalette, baseLayer: BaseLayer | undefined) {
  const muted = paintsModifications(baseLayer)
  const bases = effectiveBaseColors({
    colors: palette,
    basesField: baseLayer?.field,
  })
  const hex = normalizedRgbToHex
  return {
    muted,
    base: Object.fromEntries(BASES.map(b => [b, hex(bases[b])])) as Record<
      string,
      string
    >,
    gap: { skip: hex(palette.colorSkip), deletion: hex(palette.colorDeletion) },
    insertion: hex(palette.colorInsertion),
    clip: {
      soft: hex(palette.colorSoftclip),
      hard: hex(palette.colorHardclip),
    },
    coverage: hex(palette.colorCoverage),
    interbase: {
      insertion: hex(palette.colorInsertionIndicator),
      softclip: hex(palette.colorSoftclipIndicator),
      hardclip: hex(palette.colorHardclipIndicator),
    } as Record<InterbaseTypeName, string>,
    junction: (j: MergedJunction) => abgrToHex(junctionColor(j, palette)),
    palette,
  }
}

type MarkColors = ReturnType<typeof markColors>

/** What the display leaves uncolored of the coverage band's stacks, and hides of the junctions. */
interface MarkThresholds {
  minAlleleFraction: number
  junctions: JunctionFilter
}

function positionIn(refNames: readonly string[]): RefNamePosition {
  const position = new Map(refNames.map((name, i) => [name, i]))
  return refName => position.get(refName)
}

/**
 * A read's value under the color field as `scale.domain` spells it: a
 * level field's level (`short`, `RL`, `-1`), a MAPQ, or a tag's or mate
 * reference's value, `''` where the field gives the read none.
 */
function readLevelOf(colorField: string | undefined) {
  const kind = colorFieldKindOf(colorField)
  const levels = paintedLevelOf(kind)
  return kind === 'mapq'
    ? (data: WorkerPileupData, i: number) => `${data.readMapqs[i]}`
    : isBakedField(colorField)
      ? (data: WorkerPileupData, i: number) => data.readTagValues?.[i] ?? ''
      : (_data: WorkerPileupData, _i: number, category: ReadColorCategory) =>
          levels.get(category) ?? ''
}

/** What `alignmentTables` fetched, and the regions it reads them in. */
interface AlignmentsTablesInputs {
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>
  regionInfos: RegionInfo[]
  sortColumn: SortColumn | undefined
  paintedRefNamePosition: RefNamePosition | undefined
}

const NO_KEYS: ReadonlySet<string> = new Set()
const NO_ROW_CAPS: ReadonlyMap<string, RowCap> = new Map()

/**
 * The alignments display reduced to what its tables decide from: its config,
 * the fetched reads with the regions as the frame, the default theme, and
 * the views the display installs over its config-slot views, from its facet
 * and section layout through its connectors to its coverage scale and read
 * colors. No session, view or autoruns, and so no autoscale group. A
 * viewport's row caps, a lane's coverage-only chevron and a lane's dragged
 * size are the view's, so the tables lay every row out, at the configured
 * read height, and always build the key.
 */
const AlignmentsTablesHost = types
  .compose(
    'AlignmentsTablesHost',
    ScoreScaleMixin(COVERAGE_Y_PATHS),
    types.model({
      type: types.literal('LinearAlignmentsDisplay'),
      configuration: linearAlignmentsDisplayConfigSchema,
    }),
  )
  .volatile((): AlignmentsTablesInputs & { theme: JBrowsePalette } => ({
    rpcDataMap: new Map(),
    regionInfos: [],
    sortColumn: undefined,
    paintedRefNamePosition: undefined,
    theme: resolvePalette(),
  }))
  .actions(self => ({
    setInputs(inputs: AlignmentsTablesInputs) {
      self.rpcDataMap = inputs.rpcDataMap
      self.regionInfos = inputs.regionInfos
      self.sortColumn = inputs.sortColumn
      self.paintedRefNamePosition = inputs.paintedRefNamePosition
    },
  }))
  .views(heightModeViews)
  .views(ungroupedAutoscaleViews)
  .views(coverageBandSlotViews)
  .views(configSlotViews)
  .views(self => ({
    get loadedRegions(): ReadonlyMap<number, RegionBounds> {
      return new Map(self.regionInfos.map((r, i) => [i, r]))
    },
    get host() {
      return { displayedRegions: self.regionInfos }
    },
    get view(): SettledBlocksView {
      return {
        initialized: self.regionInfos.length > 0,
        settledDynamicBlocks: self.regionInfos,
      }
    },
    get keyWindows(): readonly KeyWindow[] {
      return keyWindowsOf(self.regionInfos)
    },
    get featureHeight() {
      return self.markHeight
    },
    get featureSpacing() {
      return featureSpacingForHeight(self.markHeight)
    },
    get collapsedGroups() {
      return NO_KEYS
    },
    get groupRowCaps() {
      return NO_ROW_CAPS
    },
    get fitDefaultCap() {
      return UNCAPPED
    },
    get fitCeilingRows() {
      return UNCAPPED.rows
    },
    get canonicalRefName() {
      return adapterRefNameText
    },
    get showLegend() {
      return true
    },
    get detectedModifications() {
      return detectedModificationsOf(self.rpcDataMap)
    },
    get fitTargetHeight(): number {
      return getConf(self, 'height')
    },
  }))
  .views(self => connectorSettingViews(self))
  .views(self => facetLayoutViews(self))
  .views(self => hiddenGroupsViews(self))
  .views(self => groupLayoutViews(self))
  .views(self => ({
    get arcCollection() {
      return collectArcs(self.rawDataByGroup, self.regionInfos, {
        filter: self.connectionFilter,
      })
    },
  }))
  .views(self => pileupLayoutViews(self))
  .views(self => connectorViews(self))
  .views(self => bandPlotViews(self))
  .views(self => ({
    get bandHeights() {
      return {
        coverageHeight: boundCoverageHeight(self.coverageHeight, self.bandPlot),
      }
    },
  }))
  .views(self => coverageStatsViews(self))
  .views(self => coverageAutoscaleViews(self))
  .views(self => coverageDomainViews(self))
  .views(self => coverageTicksViews(self))
  .views(self => alignmentsColorViews(self))
  .views(self => readPaletteViews(self))
  .views(self => ({
    get colors() {
      return self.colorsIn(self.theme)
    },
  }))

interface AlignmentsTablesHostModel extends Instance<
  typeof AlignmentsTablesHost
> {}

/**
 * The display's color pipeline over its laid-out sections, run as the display
 * runs it (`alignmentsColorViews`): each read painted the color the display
 * paints it, in the bucket and level it classifies into, and the key the
 * display shows beside them.
 */
function colorReads(host: AlignmentsTablesHostModel) {
  const palette = host.colors
  const levelOf = readLevelOf(host.colorField)
  const sections = new Map(
    [...host.laidOutByGroupColored].map(([key, map]) => [
      key,
      new Map(
        [...map].map(([idx, data]) => {
          const category = Array.from(
            data.readColorCategories,
            i => READ_COLOR_CATEGORY_BY_INDEX[i]!,
          )
          const color = category.map((_, i) =>
            cssColorToHex(
              readColorFromCategoryIndex(
                data.readColorCategories[i]!,
                i,
                data,
                palette,
              ),
            ),
          )
          const level = category.map((c, i) => levelOf(data, i, c))
          return [idx, { color, category, level }]
        }),
      ),
    ]),
  )
  const legend = host
    .legendItems(palette)
    .filter(item => item.color !== undefined)
  const { ramps, readTitle } = titledReadColorKey(
    host.colorRamps,
    host.colorKeyTitle,
  )
  return {
    sections,
    palette,
    declared: host.declaredReadLabels,
    keyLabels: host.keyReadLabels,
    readField: host.colorField,
    legend: {
      label: legend.map(item => item.label),
      color: legend.map(item => cssColorToHex(item.color!)),
    },
    legendTitle: readTitle ?? 'Read colors',
    ramps: ramps.map(rampKeyOf),
  }
}

/**
 * The reads' base modifications as the display's modifications layer paints
 * them: each call at its position on its read, its type code and name, its
 * probability, whether it is the call that the base is unmodified, the color
 * the display paints it and the opacity it paints it at, which follows the
 * probability.
 */
function modifications(d: WorkerPileupData) {
  const types = d.modificationTypes ?? []
  const n = d.modificationPositions.length
  const type = Array.from(
    { length: n },
    (_, i) => types[d.modificationTypeIndices?.[i] ?? 0] ?? '',
  )
  const unmodified = Array.from(
    { length: n },
    (_, i) => d.modificationNoMod?.[i] === 1,
  )
  return {
    position: d.modificationPositions,
    read: d.modificationReadIndices,
    type,
    name: type.map((t, i) =>
      unmodified[i]
        ? `Unmodified ${getModificationName(t)}`
        : getModificationName(t),
    ),
    probability: Array.from(
      { length: n },
      (_, i) => (d.modificationProbabilities?.[i] ?? 0) / 255,
    ),
    unmodified,
    color: Array.from(d.modificationColors, c => abgrToHex(c)),
    opacity: Array.from(d.modificationColors, c => abgrAlpha(c) / 255),
  }
}

/**
 * The coverage band's stacked segments, as the worker packs them for the
 * display: at each position with a mismatch, each allele's share of the bar
 * from the bottom up, and under the modifications layer each modification
 * state's share, with the color and opacity it paints in. `from` and `to` are
 * fractions of the position's depth, which `depth` gives.
 */
function coverageStacks(
  d: WorkerPileupData,
  paint: MarkColors,
  minFrequency: number,
) {
  const depthOf = (relDepth: number) => relDepth * d.coverageMaxDepth
  const alleles = readSnpSegments(d.snpPackedBuffer)
  const modifications = readModCovSegments(d.modCovPackedBuffer)
  const base = alleles.map(a => 'ACGTN'[a.colorType - 1] ?? 'N')
  return {
    alleleCoverage: {
      position: alleles.map(a => a.position),
      base,
      from: alleles.map(a => a.yOffset),
      to: alleles.map(a => a.yOffset + a.height),
      depth: alleles.map(a => depthOf(a.relDepth)),
      color: base.map(b => paint.base[b]!),
      shown: alleles.map(a => a.height >= minFrequency),
    },
    modificationCoverage: {
      position: modifications.map(m => m.position),
      from: modifications.map(m => m.yOffset),
      to: modifications.map(m => m.yOffset + m.height),
      depth: modifications.map(m => depthOf(m.relDepth)),
      color: modifications.map(m => abgrToHex(m.packedColor)),
      opacity: modifications.map(m => abgrAlpha(m.packedColor) / 255),
    },
  }
}

/**
 * The coverage band's interbase histogram and its indicators, as the worker
 * packs them for the display. `interbaseCoverage` stacks each position's
 * insertions, soft clips and hard clips in that order, `from` and `to` in
 * reads, which the display hangs from the band's top at half a depth unit per
 * read. `indicators` are the positions where those events pass the display's
 * share of the local depth, each with its most common `type`.
 */
function interbaseStacks(d: WorkerPileupData, paint: MarkColors) {
  const segments = readInterbaseSegments(d.interbasePackedBuffer)
  const reads = (fraction: number) => Math.round(fraction * d.interbaseMaxCount)
  const n = segments.count
  const type = Array.from({ length: n }, (_, i) =>
    interbaseTypeName(segments.colorType(i)),
  )
  const indicatorType = Array.from(d.indicatorTypes, interbaseTypeName)
  return {
    interbaseCoverage: {
      position: Array.from({ length: n }, (_, i) => segments.position(i)),
      type,
      from: Array.from({ length: n }, (_, i) => reads(segments.stackStart(i))),
      to: Array.from({ length: n }, (_, i) => reads(segments.stackEnd(i))),
      color: type.map(t => paint.interbase[t]),
    },
    indicators: {
      position: d.indicatorPositions,
      type: indicatorType,
      color: indicatorType.map(t => paint.interbase[t]),
    },
  }
}

/**
 * The share of the depth a mark's site holds, as the display fades a
 * sub-pixel mark by it: the worker's byte, zeroed below its depth-dependent
 * threshold, so a sequencing error on a deep pileup fades to the floor.
 */
function fades(bytes: Uint8Array) {
  return Array.from(bytes, b => b / 255)
}

/**
 * The insertions on the reads and the clips at their ends, which the worker
 * ships as one interbase list: an insertion with its length and, where the
 * reader kept it, its sequence; a clip with its length and whether the clipped
 * bases are in the file (`soft`) or not (`hard`).
 */
function interbase(d: WorkerPileupData, paint: MarkColors) {
  const insertions = {
    position: [] as number[],
    length: [] as number[],
    sequence: [] as string[],
    read: [] as number[],
    fade: [] as number[],
    color: [] as string[],
  }
  const clips = {
    position: [] as number[],
    length: [] as number[],
    type: [] as string[],
    read: [] as number[],
    fade: [] as number[],
    color: [] as string[],
  }
  for (let i = 0; i < d.interbasePositions.length; i++) {
    const type = d.interbaseTypes[i]!
    const fade = d.interbaseFrequencies[i]! / 255
    if (type === INTERBASE_INSERTION) {
      insertions.position.push(d.interbasePositions[i]!)
      insertions.length.push(d.interbaseLengths[i]!)
      insertions.sequence.push(d.interbaseSequences[i] ?? '')
      insertions.read.push(d.interbaseReadIndices[i]!)
      insertions.fade.push(fade)
      insertions.color.push(paint.insertion)
    } else {
      clips.position.push(d.interbasePositions[i]!)
      clips.length.push(d.interbaseLengths[i]!)
      const soft = type === INTERBASE_SOFTCLIP
      clips.type.push(soft ? 'soft' : 'hard')
      clips.read.push(d.interbaseReadIndices[i]!)
      clips.fade.push(fade)
      clips.color.push(soft ? paint.clip.soft : paint.clip.hard)
    }
  }
  return { insertions, clips }
}

/**
 * The junctions the reads' skips and split reads support, merged as the
 * sashimi band merges them: each once, with its supporting-read count, its
 * `class` and `source` as the filter's `junction` fields name them, a split
 * junction's `level` (the `insertSizeAndOrientation` level its color paints,
 * '' for a splice junction), the
 * strand its reads' tags or its splice motif give a splice junction (0 where
 * neither says, and for a split junction), and the motif where the reference
 * was read. Every junction, down to a single
 * read, with `shown` false where the display's `junction` filter fields hide it; a
 * junction whose motif was never read counts as canonical, as the display
 * counts it. `arcHeight` is the apex as a fraction
 * of the band and `strokeWidth` the stroke in px, the sashimi marks' own.
 * A junction the reads of several regions show is merged once, as the
 * sashimi band merges it, and `startRegion` and `endRegion` name the region
 * holding each foot, -1 where none does.
 */
function junctions(
  perRegion: RegionJunctions[],
  regionInfos: RegionInfo[],
  paint: MarkColors,
  thresholds: MarkThresholds,
) {
  const contigOrder = new Map<string, number>()
  for (const { refName } of regionInfos) {
    if (!contigOrder.has(refName)) {
      contigOrder.set(refName, contigOrder.size)
    }
  }
  const merged = [...mergeJunctions(perRegion, { minReads: 0 }).values()].sort(
    (a, b) =>
      contigOrder.get(a.refName)! - contigOrder.get(b.refName)! ||
      a.start - b.start ||
      a.end - b.end,
  )
  return {
    start: merged.map(j => j.start),
    end: merged.map(j => j.end),
    count: merged.map(j => j.count),
    class: merged.map(j => junctionClass(j.split)),
    level: merged.map(j => (j.split ? arcLevelOf(j.split) : '')),
    source: merged.map(j => junctionSource(junctionClass(j.split))),
    strand: merged.map(j => j.strand),
    motif: merged.map(j => spliceMotifLabel(j.motif) ?? ''),
    color: merged.map(j => paint.junction(j)),
    shown: merged.map(j => passesJunctionFilter(j, thresholds.junctions)),
    arcHeight: merged.map(j =>
      sashimiArcHeightFraction(Math.abs(j.end - j.start)),
    ),
    strokeWidth: merged.map(j => sashimiStrokeWidth(j.count)),
    refName: merged.map(j => j.refName),
    startRegion: merged.map(j => footRegion(regionInfos, j.refName, j.start)),
    endRegion: merged.map(j => footRegion(regionInfos, j.refName, j.end)),
  }
}

/** The index of the region holding `bp`, -1 where none does. */
function footRegion(regionInfos: RegionInfo[], refName: string, bp: number) {
  return regionIndexOf(regionInfos, refName, bp) ?? -1
}

const ARC_SHAPE_NAMES = ['arc', 'flat', 'flatSplit', 'unplaced'] as const

const INSERT_SIZE_LEVEL_OF = paintedLevelOf('insertSizeAndOrientation')

/**
 * The `insertSizeAndOrientation` level whose color an arc paints: a pair's
 * own, and a split read's that of the pair twin it shares a color with.
 */
function arcLevelOf(category: ArcCategory) {
  return (
    INSERT_SIZE_LEVEL_OF.get(
      isArcSplitCategory(category) ? ARC_SPLIT_SWATCH[category] : category,
    ) ?? ''
  )
}

/** A split read's arc's `junction.class`, '' for a pair's. */
function arcClassOf(category: ArcCategory) {
  return isArcSplitCategory(category) ? junctionClass(category) : ''
}
const DPR_PAST_THE_ANTIALIASING_FLOOR = Number.POSITIVE_INFINITY

interface ArcPaint {
  slotColor: string[]
  widthOf: (support: number) => number
}

/** Arcs as the band paints them, each foot naming the region holding it. */
function arcRows(
  a: ArcsUploadData,
  { slotColor, widthOf }: ArcPaint,
  feet: (arc: number) => readonly [number, number],
) {
  const n = a.numArcs
  const start = Array.from(a.arcX1.subarray(0, n))
  const end = Array.from(a.arcX2.subarray(0, n))
  const shape = Array.from(a.arcShapeTypes.subarray(0, n))
  const colorSlot = Array.from(a.arcColorTypes.subarray(0, n), arcColorSlot)
  const support = Array.from(a.arcSupport.subarray(0, n))
  const arcFeet = start.map((_, i) => feet(i))
  return {
    start,
    end,
    shape: shape.map(s => ARC_SHAPE_NAMES[s] ?? 'arc'),
    level: colorSlot.map(c => arcLevelOf(arcSlotCategory(c))),
    class: colorSlot.map(c => arcClassOf(arcSlotCategory(c))),
    color: colorSlot.map(c => slotColor[c]!),
    opacity: shape.map(arcOpacity),
    y: Array.from(a.arcYBp.subarray(0, n)),
    span: Array.from(a.arcSpanBp.subarray(0, n)),
    support,
    width: support.map(widthOf),
    startRegion: arcFeet.map(f => f[0]),
    endRegion: arcFeet.map(f => f[1]),
  }
}

/**
 * One section's arcs and interchromosomal ticks in one region, in the band's
 * paint: the arcs the region draws, then those whose near foot it holds and
 * whose far foot another region holds, which the display draws across both.
 */
function sectionConnections(
  own: ArcsUploadData,
  crossing: CrossRegionArc[],
  ownFeet: (start: number, end: number) => [number, number],
  paint: ArcPaint,
) {
  const ownArcs = arcRows(own, paint, i =>
    ownFeet(own.arcX1[i]!, own.arcX2[i]!),
  )
  const crossArcs = arcRows(arcsToRegionResult(crossing, []), paint, i => [
    crossing[i]!.p1RegionIndex,
    crossing[i]!.p2RegionIndex,
  ])
  const ticks = own.numArcLines
  return {
    arcs: Object.fromEntries(
      Object.entries(ownArcs).map(([name, column]) => [
        name,
        [...column, ...crossArcs[name as keyof typeof crossArcs]],
      ]),
    ) as typeof ownArcs,
    arcTicks: {
      position: own.arcLinePositions.subarray(0, ticks),
      support: own.arcLineSupport.subarray(0, ticks),
      partners: own.arcLinePartnerRefNames
        .slice(0, ticks)
        .map(names => names.join(',')),
      color: new Array<string>(ticks).fill(
        paint.slotColor[ARC_COLOR_INTERCHROM]!,
      ),
      width: Array.from(own.arcLineSupport.subarray(0, ticks), paint.widthOf),
    },
  }
}

/** The config a table reports: the display's, its filter as it applied. */
function resolvedConfig(
  host: AlignmentsTablesHostModel,
): Record<string, unknown> {
  return {
    ...fullConfSnapshot(host.configuration),
    filter: host.filterPredicates,
  }
}

/**
 * The read-connection band the display draws under `readConnections`, from
 * the display's own arc pass over every section and region at once: each
 * section's mate-pair and split-read arcs, or the read cloud's bars, in the
 * colors and stroke widths the band paints them, its interchromosomal ticks,
 * and the band's key. `y` is where the band plots a connection, in bp: an
 * arc's genomic radius, or the read cloud's |TLEN| jittered as the display
 * jitters it so coincident pairs separate; `span` is the distance itself. An
 * arc is listed once, under the region holding its near foot, else its far
 * one, else the first its span crosses.
 */
function readConnectionTables(
  host: AlignmentsTablesHostModel,
  dataByGroup: ReadonlyMap<string, ReadonlyMap<number, WorkerPileupData>>,
  regionInfos: RegionInfo[],
  colors: ReturnType<typeof colorReads>,
  connectorSlots: ReadonlySet<number>,
) {
  const mode = host.drawnReadConnections
  const result =
    mode === 'off'
      ? undefined
      : computeArcsByGroup(
          new Map([...dataByGroup].map(([key, map]) => [key, new Map(map)])),
          { loaded: regionInfos, displayed: regionInfos },
          {
            cloud: mode === 'rule',
            filter: host.connectionFilter,
            showOrdinaryPairs: host.showOrdinaryPairs,
          },
        )
  const slotColor = buildArcColorPalette(colors.palette).map(normalizedRgbToHex)
  const stroke = host.readConnectionsStrokeScale
  const widthOf = (support: number) =>
    linkStrokeWidthPx(
      support,
      LINK_SIZE_SCALED,
      stroke.range[0],
      stroke.domain[0],
      stroke.domain[1],
      stroke.scale === 'log' ? SCALE_TYPE_LOG : SCALE_TYPE_LINEAR,
      stroke.range[0],
      stroke.range[1],
      DPR_PAST_THE_ANTIALIASING_FLOOR,
    )
  const paint = { slotColor, widthOf }
  const bySection = new Map(
    [...dataByGroup.keys()].map(key => [
      key,
      new Map(
        regionInfos.map(({ refName }, i) => [
          i,
          sectionConnections(
            result?.byGroup.get(key)?.get(i) ?? emptyArcsUploadData(),
            (result?.crossRegionByGroup.get(key) ?? []).filter(
              arc => arc.p1RegionIndex === i,
            ),
            (start, end) => [
              footRegion(regionInfos, refName, start),
              footRegion(regionInfos, refName, end),
            ],
            paint,
          ),
        ]),
      ),
    ]),
  )
  const legend = getArcLegendItems(
    new Set(
      [
        ...(result ? arcSlotsInWindows(result, keyWindowsOf(regionInfos)) : []),
        ...connectorSlots,
      ].map(slot => arcSlotCategory(slot)),
    ),
    colors.palette,
    colors.keyLabels.categories,
  ).filter(item => item.color !== undefined)
  return {
    bySection,
    arcLegend: {
      label: legend.map(item => item.label),
      color: legend.map(item => cssColorToHex(item.color!)),
    },
    arcLegendTitle: arcLegendTitle(mode),
    arcSpanMax: result?.maxFlatArcSpanBp ?? 0,
  }
}

/**
 * Each aligned base's Phred score under the per-base quality layer, at its
 * position on its read, in the ramp color the layer paints it; a base with no
 * score paints the plain read fill.
 */
function qualities(d: WorkerPileupData, plainRead: string) {
  return {
    position: d.perBaseQualPositions,
    read: d.perBaseQualReadIndices,
    score: d.perBaseQualScores,
    color: Array.from(d.perBaseQualScores, s =>
      s === BASE_QUALITY_UNAVAILABLE ? plainRead : abgrToHex(qualityAbgr[s]!),
    ),
  }
}

/**
 * The spans where two of a chain's reads both align, in the neutral the
 * display fills each kind with: the strong one for a split segment, the faint
 * one for two mates. Empty unless the display's unit is a chain, and where
 * `drawsOverlaps` is false, as the display draws none below a 3 px read.
 */
function overlapTables(
  laid: LaidOutPileupData | undefined,
  drawsOverlaps: boolean,
  overlapColors: readonly string[],
) {
  const overlapped = drawsOverlaps ? laid : undefined
  const [start, end] = pairs(overlapped?.overlapPositions ?? new Uint32Array())
  return {
    overlaps: {
      start,
      end,
      row: Array.from(overlapped?.overlapYs ?? []),
      color: Array.from(
        overlapped?.overlapKinds ?? [],
        kind => overlapColors[kind]!,
      ),
    },
  }
}

/**
 * Each section's connectors as the display draws them (`connectorsByGroup`):
 * the straight-line pass's pairs (`linePassInstance`) and the connector
 * mark's (`connectorInstance`), each filed by the region holding its first
 * end.
 */
function sectionConnectors(host: AlignmentsTablesHostModel, readPitch: number) {
  const regions = host.regionInfos
  const arrows = connectorArrowPx(host.featureHeight) > 0
  return new Map(
    [...host.laidOutByGroupFramed].map(([key, laid]) => {
      const pileupHeight = groupMaxY(laid) * readPitch
      const connectors = host.connectorsByGroup.get(key)
      const byRegion = new Map<number, PlacedConnector[]>()
      const file = (pair: LinkedPair, placed: PlacedConnector['placed']) => {
        getOrCreate(byRegion, placed.region, () => []).push({ pair, placed })
      }
      for (const pair of connectors?.linePairs ?? []) {
        const placed = linePassInstance(pair, regions, pileupHeight, readPitch)
        if (placed) {
          file(pair, placed)
        }
      }
      for (const pair of connectors?.overlayPairs ?? []) {
        const placed = connectorInstance(
          pair,
          regions,
          pileupHeight,
          readPitch,
          arrows,
        )
        if (placed) {
          file(pair, placed)
        }
      }
      return [key, byRegion]
    }),
  )
}

interface PlacedConnector {
  pair: LinkedPair
  placed: NonNullable<ReturnType<typeof connectorInstance>>
}

/**
 * One region's connectors as the connector mark draws them: each end's
 * position, row and region (the second end may sit in another), the color of
 * the connection's arc at `opacity`, the stroke `width` in px, and the shape:
 * `straight`, a `curve` dipping `dip` px below its rows, or bowing up over
 * them where `dip` is 0, or a `loop` where a read maps back over itself,
 * ending in an `arrow`; `dashed` where the junction steps over segments not
 * in view. `strand` and `endStrand` (1 or -1) and `leading`, the second end
 * being a split junction's leading edge, set which way each end's curve
 * leaves its read: `alignmentConnectorCurves` places the curve at a host's
 * scale. `key` and `mateKey` are the two reads' `key` in `reads`.
 */
function connectorColumns(
  connected: readonly PlacedConnector[],
  slotColor: readonly string[],
  keyOf: (readKey: WorkerPileupData['readKeys'][number]) => number,
) {
  const bits = connected.map(({ placed }) => placed.bits)
  return {
    connectors: {
      start: connected.map(({ placed }) => placed.x),
      end: connected.map(({ placed }) => placed.x2),
      endRegion: connected.map(({ placed }) => placed.x2Region),
      row: connected.map(({ placed }) => placed.row),
      endRow: connected.map(({ placed }) => placed.row2),
      color: connected.map(({ placed }) => slotColor[placed.slot]!),
      opacity: connected.map(({ placed }) => placed.alpha),
      width: connected.map(({ placed }) => placed.width),
      kind: connected.map(({ placed }) =>
        placed.straight ? 'straight' : placed.loop ? 'loop' : 'curve',
      ),
      dashed: connected.map(({ placed }) => placed.hidden),
      dip: connected.map(({ placed }) =>
        placed.straight || placed.bend === CONNECTOR_BOW ? 0 : placed.bend,
      ),
      strand: bits.map(b => ((b & CONNECTOR_MINUS_1) !== 0 ? -1 : 1)),
      endStrand: bits.map(b => ((b & CONNECTOR_MINUS_2) !== 0 ? -1 : 1)),
      leading: bits.map(b => (b & CONNECTOR_LEADING_2) !== 0),
      arrow: bits.map(b => (b & CONNECTOR_ARROW) !== 0),
      key: connected.map(({ pair: p }) =>
        keyOf(p.e1.data.readKeys[p.e1.readIdx]!),
      ),
      mateKey: connected.map(({ pair: p }) =>
        keyOf(p.e2.data.readKeys[p.e2.readIdx]!),
      ),
    },
  }
}

/**
 * One section's reads in one region as the alignments display draws them, as
 * columns. Every coordinate is 0-based genomic; `read` in the other tables is
 * a 0-based index into `reads`, which holds within one call. A read's `id` is
 * the record's own (`feature.id()`), the same in every call, where its `name`
 * is shared by its mate and its supplementary segments, and `key` is the
 * read's integer identity within the call, shared by its copies in other
 * regions.
 */
function sectionTables(
  d: WorkerPileupData,
  readYs: ArrayLike<number>,
  colors: { color: string[]; level: string[] },
  region: { start: number; end: number },
  keyOf: (readKey: WorkerPileupData['readKeys'][number]) => number,
  plainRead: string,
  paint: MarkColors,
  thresholds: MarkThresholds,
) {
  const [readStart, readEnd] = pairs(d.readPositions)
  const [gapStart, gapEnd] = pairs(d.gapPositions)
  const mismatchBase = Array.from(d.mismatchBases, b => BASE_OF_CODE[b] ?? 'N')
  const gapType = Array.from(d.gapTypes, t =>
    t === GAP_SKIP ? ('skip' as const) : ('deletion' as const),
  )
  return {
    reads: {
      id: Array.from(readStart, (_, i) => readIdAt(d, i) ?? ''),
      start: readStart,
      end: readEnd,
      row: Array.from(readYs),
      strand: d.readStrands,
      mapq: d.readMapqs,
      flags: d.readFlags,
      name: Array.from(readStart, (_, i) => readNameAt(d, i)),
      insertSize: d.readInsertSizes,
      pairOrientation: Array.from(
        d.readPairOrientations,
        v => pairDirectionOfNum(v) ?? '',
      ),
      color: colors.color,
      level: colors.level,
      key: Array.from(d.readKeys, keyOf),
    },
    mismatches: {
      position: d.mismatchPositions,
      base: mismatchBase,
      read: d.mismatchReadIndices,
      frequency: alleleFrequencies(d),
      fade: fades(d.mismatchFrequencies),
      quality: d.mismatchQuals,
      color: mismatchBase.map(b => paint.base[b]!),
    },
    gaps: {
      start: gapStart,
      end: gapEnd,
      type: gapType,
      read: d.gapReadIndices,
      fade: fades(d.gapFrequencies),
      color: gapType.map(t => paint.gap[t]),
    },
    ...interbase(d, paint),
    modifications: modifications(d),
    qualities: qualities(d, plainRead),
    ...coverageBand(d, region, paint, thresholds.minAlleleFraction),
  }
}

/**
 * The coverage band's tables over the region alone, one row per base:
 * `coverageDepths` is per-bp whatever `coverageBinSize`, the GPU bar width,
 * says. The worker counts depth and stacks wherever its reads reach, which
 * past the region's ends is a partial count of the reads that also cross into
 * it.
 */
function coverageBand(
  d: WorkerPileupData,
  region: { start: number; end: number },
  paint: MarkColors,
  minAlleleFraction: number,
) {
  const first = Math.max(0, region.start - d.coverageStartPos)
  const last = Math.min(
    d.coverageDepths.length,
    region.end - d.coverageStartPos,
  )
  const bases = Array.from(
    { length: Math.max(0, last - first) },
    (_, i) => first + i,
  )
  const inside = (position: number) =>
    position >= region.start && position < region.end
  const stacks = {
    ...coverageStacks(d, paint, minAlleleFraction),
    ...interbaseStacks(d, paint),
  }
  return {
    coverage: {
      start: bases.map(i => d.coverageStartPos + i),
      end: bases.map(i => d.coverageStartPos + i + 1),
      depth: bases.map(i => d.coverageDepths[i]!),
      forward: bases.map(i => d.coverageFwdDepths[i]!),
      reverse: bases.map(i => d.coverageRevDepths[i]!),
      color: bases.map(() => paint.coverage),
    },
    alleleCoverage: rowsWhere(stacks.alleleCoverage, inside),
    modificationCoverage: rowsWhere(stacks.modificationCoverage, inside),
    interbaseCoverage: rowsWhere(stacks.interbaseCoverage, inside),
    indicators: rowsWhere(stacks.indicators, inside),
  }
}

/** A table's rows whose `position` passes `keep`. */
function rowsWhere<
  T extends Record<string, ArrayLike<unknown>> & {
    position: ArrayLike<number>
  },
>(table: T, keep: (position: number) => boolean) {
  return rowsAt(table, i => keep(table.position[i]!))
}

/** A table's rows whose index passes `keep`. */
function rowsAt<T extends Record<string, ArrayLike<unknown>>>(
  table: T,
  keep: (row: number) => boolean,
) {
  const length = Math.max(0, ...Object.values(table).map(c => c.length))
  const rows = Array.from({ length }, (_, i) => i).filter(keep)
  return Object.fromEntries(
    Object.entries(table).map(([name, column]) => [
      name,
      rows.map(i => column[i]),
    ]),
  ) as { [K in keyof T]: T[K] extends ArrayLike<infer V> ? V[] : never }
}

/**
 * The coverage band's depth axis as the display autoscales it
 * (`coverageScaleViews`): every shown section's visible depths in every
 * region under `coverage.encoding.y`'s fence, rules and bounds, nice-rounded,
 * with a log scale floored at one read, and the ticks the display labels it
 * with at its height. A band the display does not draw has no ticks.
 */
function coverageScale(host: AlignmentsTablesHostModel) {
  const type = host.scaleType
  const domain = host.coverageDepthDomain ?? coverageDepthDomain([0, 0], type)
  return {
    domain,
    type,
    symlogConstant: resolveSymlogConstant(
      domain[0],
      domain[1],
      host.symlogConstant,
    ),
    ticks: host.coverageTicks?.items.map(tick => tick.value) ?? [],
  }
}

/**
 * #api
 * A region's reads, or several regions', as the alignments display fetches,
 * filters, lays out and colors them, as tables: the worker's reads,
 * mismatches, gaps, insertions, clips, modifications, per-base qualities,
 * coverage and splice junctions, each read on the row the display's pileup
 * layout gives it and in the color the display's `encoding.color` paints it,
 * with the key the display shows: `legend`, and `ramps`, its color bars
 * (`rampKeyOf`). Under a `facet` each section lays out separately, every row
 * has a `section`, and `sections` lists them in stacking order;
 * ungrouped, there is one section, labelled `''`. Several regions lay out as
 * the display lays out a view's regions, on one set of rows: a read crossing
 * regions is listed in each, under one `key` and on one `row`, and every row
 * names its `region`'s index. `warnings` names what the config asked for
 * that the tables dropped. For a host that draws them itself, such as R
 * through V8. The adapters must be registered on `pluginManager`
 * (`registerAlignmentsAdapters`).
 */
export async function alignmentTables(
  pluginManager: PluginManager,
  {
    adapterConfig,
    sequenceAdapter,
    regions,
    display = {},
    refNames,
    refNamePosition,
    byteLimit = DEFAULT_BYTE_LIMIT,
    spanLimit = DEFAULT_SPAN_LIMIT,
  }: AlignmentTablesArgs,
) {
  if (regions.length === 0) {
    throw new Error('alignmentTables reads a region, or regions')
  }
  const several = regions.length > 1
  const span = regions.reduce((sum, r) => sum + r.end - r.start, 0)
  if (span > spanLimit) {
    throw new Error(
      `${lociOf(regions)} ${several ? 'span' : 'spans'} ${span} bp of alignments${several ? ' in total' : ''}, over the ${spanLimit}-bp limit; read a smaller region or raise spanLimit`,
    )
  }
  const tooLarge = (bytes: number | undefined) =>
    overByteLimitError(regions, bytes, byteLimit, 'alignments')
  const dataAdapter = await tablesFeatureAdapter(
    pluginManager,
    adapterConfig,
    sequenceAdapter,
  )
  const fetchRegions = regions.map(r => ({ assemblyName: '', ...r }))
  const bytes = await totalRegionBytes(dataAdapter, fetchRegions)
  if (overByteBudget(bytes, byteLimit)) {
    throw tooLarge(bytes)
  }
  const host = AlignmentsTablesHost.create({
    type: 'LinearAlignmentsDisplay',
    configuration: {
      ...display,
      type: 'LinearAlignmentsDisplay',
      displayId: 'tables',
    },
  })
  const { args, sortColumn } = runInAction(() => {
    const sorted = sortOf(
      host.configuration.sort,
      refName =>
        regions.find(r => r.originalRefName === refName)?.refName ?? refName,
      regions[0]!.refName,
    )
    const chain = host.unit === 'chain'
    return {
      sortColumn: sorted.sortColumn,
      args: {
        sessionId: 'tables',
        adapterConfig,
        sequenceAdapter,
        regions: fetchRegions,
        filter: host.readPredicates,
        colorField: host.colorField,
        baseLayer: host.baseLayer,
        sortTag: chain ? undefined : fieldTag(sorted.sortColumn?.field),
        facet: workerFacet(
          host.effectiveFacet,
          host.unit,
          host.pinnedInsertSizeBand,
        ),
        showSoftClips: !chain && host.showSoftClips,
        interbaseIndicators: host.interbaseIndicatorRule,
        statusCallback: () => {},
      } satisfies RpcExecuteArgs<'RenderAlignmentData'>,
    }
  })
  // the worker reads one region a call
  const run = (facet: typeof args.facet) =>
    Promise.all(
      fetchRegions.map(async r => {
        const result = await executeRenderAlignmentData({
          pluginManager,
          args: { ...args, regions: [r], facet },
        })
        if ('regionTooLarge' in result) {
          throw tooLarge(result.bytes)
        }
        return result.value
      }),
    )
  const faceted = await run(args.facet)
  const noReads = faceted.every(f => !f.groups.length)
  // a facet partitions no reads into no sections; the regions still have one
  const fetched = new Map(
    (noReads ? await run(undefined) : faceted).map((f, i) => [i, f]),
  )
  const paintedRefNamePosition =
    args.colorField === 'mateRefName'
      ? (refNamePosition ??
        positionIn(refNames ?? (await dataAdapter.getRefNames())))
      : undefined
  return runInAction(() =>
    laidOutTables(host, {
      regions,
      fetched,
      sortColumn,
      paintedRefNamePosition,
    }),
  )
}

/**
 * The tables over what `alignmentTables` fetched, laid out and colored as
 * the display lays them out and colors them, every read of `host` in the
 * one batch its computeds are cached for.
 */
function laidOutTables(
  host: AlignmentsTablesHostModel,
  {
    regions,
    fetched,
    sortColumn,
    paintedRefNamePosition,
  }: {
    regions: TablesRegion[]
    fetched: ReadonlyMap<number, GroupedAlignmentsResult>
    sortColumn: SortColumn | undefined
    paintedRefNamePosition: RefNamePosition | undefined
  },
) {
  const conf = host.configuration
  host.setInputs({
    rpcDataMap: fetched,
    regionInfos: regions.map((r, i) => ({
      refName: r.refName,
      start: r.start,
      end: r.end,
      displayedRegionIndex: i,
    })),
    sortColumn,
    paintedRefNamePosition,
  })
  const { unit, featureHeight, regionInfos } = host
  const chain = unit === 'chain'
  const order = host.groupOrder
  if (!order.length) {
    throw new Error(
      `every section at ${lociOf(regions)} is hidden; facet.hidden lists them all`,
    )
  }
  const sectionData = host.rawDataByGroup
  const dataFor = (key: string, idx: number) =>
    host.chainedByGroup.get(key)!.get(idx)!
  const laidByGroup = host.laidOutByGroupFramed
  const drawsOverlaps = shouldDrawOverlaps({
    unit,
    collapseSections: host.collapseSections,
    featureHeight,
  })
  const colors = colorReads(host)
  const paint = markColors(colors.palette, host.baseLayer)
  const thresholds: MarkThresholds = {
    minAlleleFraction: host.coverageMinAlleleFraction,
    junctions: host.junctionFilter,
  }
  const readPitch = featureHeight + host.featureSpacing
  const connectorsBySection = sectionConnectors(host, readPitch)
  const connections = readConnectionTables(
    host,
    sectionData,
    regionInfos,
    colors,
    new Set(
      [...connectorsBySection.values()].flatMap(byRegion =>
        [...byRegion.values()].flatMap(list =>
          list.map(({ placed }) => placed.slot),
        ),
      ),
    ),
  )
  const connectorSlotColor = buildArcColorPalette(colors.palette).map(
    normalizedRgbToHex,
  )
  const keys = new Map<WorkerPileupData['readKeys'][number], number>()
  const keyOf = (readKey: WorkerPileupData['readKeys'][number]) => {
    let key = keys.get(readKey)
    if (key === undefined) {
      key = keys.size
      keys.set(readKey, key)
    }
    return key
  }
  const plainRead = normalizedRgbToHex(colors.palette.readCategoryColors.plain)
  const pileups = regions.flatMap((r, i) =>
    order.flatMap(({ key, label }) => {
      const laid = laidByGroup.get(key)!.get(i)
      return laid
        ? [
            {
              columns: { section: label, region: i },
              tables: {
                ...connectorColumns(
                  connectorsBySection.get(key)?.get(i) ?? [],
                  connectorSlotColor,
                  keyOf,
                ),
                ...overlapTables(
                  laid,
                  drawsOverlaps,
                  byOverlapKind(
                    normalizedRgbToHex(colors.palette.colorOverlap),
                    normalizedRgbToHex(colors.palette.colorMateOverlap),
                  ),
                ),
                ...sectionTables(
                  dataFor(key, i),
                  laid.readYs,
                  colors.sections.get(key)!.get(i)!,
                  r,
                  keyOf,
                  plainRead,
                  paint,
                  thresholds,
                ),
              },
            },
          ]
        : []
    }),
  )
  const tables = drawnBands(conf, {
    ...joinSections(pileups, t => t.reads.start.length),
    ...joinSections(
      regions.flatMap((_, i) =>
        order.map(({ key, label }) => ({
          columns: { section: label, region: i },
          tables: connections.bySection.get(key)!.get(i)!,
        })),
      ),
      () => 0,
    ),
    ...joinSections(
      order.map(({ key, label }) => ({
        columns: { section: label },
        tables: {
          junctions: junctions(
            visibleRegionJunctions(sectionData.get(key)!, regionInfos),
            regionInfos,
            paint,
            thresholds,
          ),
        },
      })),
      () => 0,
    ),
  })
  return {
    ...tables,
    ...markLegends(tables, paint, host.theme),
    sections: {
      key: order.map(g => g.key),
      label: order.map(g => g.label),
      dipReserve: order.map(({ key }) =>
        host.connectorDipReserve(
          key,
          groupMaxY(laidByGroup.get(key)!) * readPitch,
        ),
      ),
    },
    // apart where the display's one legend box merges them: a host drawing
    // reads and arcs as separate layers keys each, so merging here was reverted
    legend: colors.legend,
    legendTitle: colors.legendTitle,
    ramps: colors.ramps,
    arcLegend: connections.arcLegend,
    arcLegendTitle: connections.arcLegendTitle,
    arcSpanMax: connections.arcSpanMax,
    coverageScale: coverageScale(host),
    glyph: {
      intronAlpha: intronAlpha(featureHeight),
      label: {
        minHeight: MIN_HEIGHT_FOR_TEXT,
        minPxPerBp: MIN_PX_PER_BP_FOR_TEXT,
        digitPx: labelFont(featureHeight).measure('0'),
        fadeLo: LABEL_FADE_LO_RATIO,
        fadeHi: LABEL_FADE_HI_RATIO,
        fadeFloor: LABEL_FADE_FLOOR,
      },
      indicatorWidth: 2 * INDICATOR_TRIANGLE_HW,
      indicatorHeight: INDICATOR_TRIANGLE_H,
      coverageInset: YSCALEBAR_LABEL_OFFSET,
      interbaseTop: interbaseEdgePx(0, 0),
    },
    readPitch: {
      featureHeight,
      featureSpacing: host.featureSpacing,
    },
    config: resolvedConfig(host),
    warnings: [
      ...facetUnitNotices(host.facet, unit),
      ...layoutWarnings({
        sortField: readConfObject(conf.sort, 'field'),
        sortColumn,
        layoutOrder: host.layoutOrder,
        chain,
        softClippingAsked: host.showSoftClips,
        collapsed: host.collapseSections,
        sections: order.map(({ key }) => sectionData.get(key)!),
        regions: host.loadedRegions,
      }),
    ],
  }
}

/**
 * What the layout drops of the display's `sort` and `pileup.softClips`
 * without saying so, in words a host can show: a column sort with no `pos`,
 * a sort the regions' contigs or reads leave nowhere to apply, under
 * `unit: 'chain'` any sort or soft clipping, as chains lay out by chain, and
 * any sort of sections collapsed to one row.
 */
function layoutWarnings({
  sortField,
  sortColumn,
  layoutOrder,
  chain,
  softClippingAsked,
  collapsed,
  sections,
  regions,
}: {
  sortField: string
  sortColumn: SortColumn | undefined
  layoutOrder: LayoutOrder
  chain: boolean
  softClippingAsked: boolean
  collapsed: boolean
  sections: ReadonlyMap<number, WorkerPileupData>[]
  regions: ReadonlyMap<number, RegionBounds>
}) {
  const warnings = new Set<string>()
  const sorts = sortColumn !== undefined || layoutOrder !== 'position'
  if (!isLayoutOrder(sortField) && !sortColumn) {
    warnings.add(`the sort by ${sortField} names no pos, so it is dropped`)
  }
  if (chain) {
    if (sorts) {
      warnings.add(
        `under unit 'chain' the reads lay out by chain, so the sort by ${sortField} is dropped`,
      )
    }
    if (softClippingAsked) {
      warnings.add(
        `under unit 'chain' the reads lay out by chain, so pileup.softClips is dropped`,
      )
    }
  } else if (collapsed) {
    if (sorts) {
      warnings.add(
        `under pileup.collapsed each section lays its reads out on one row, so the sort by ${sortField} is dropped`,
      )
    }
  } else {
    for (const dataMap of sections) {
      if (sortColumn && !appliedPileupSort({ dataMap, sortColumn, regions })) {
        const withReads = [...dataMap]
          .filter(([, d]) => d.readKeys.length > 0)
          .map(([i]) => regions.get(i)!)
        const contigs = [...new Set(withReads.map(r => r.refName))]
        const why =
          contigs.length > 1
            ? `the regions with reads span several contigs (${contigs.join(', ')})`
            : contigs[0] !== sortColumn.refName
              ? `no region with reads is on ${sortColumn.refName}`
              : `no region with reads holds position ${sortColumn.pos}`
        warnings.add(
          `the sort by ${sortColumn.field} at ${sortColumn.refName}:${sortColumn.pos} is dropped: ${why}, so the reads lay out by position`,
        )
      }
    }
  }
  return [...warnings]
}

/**
 * The keys of the marks the reads' own `legend` leaves out, each over what the
 * tables paint: the bases (none while a modifications layer mutes them, and
 * no allele segment under the band's floor), the
 * splice junction strands and split junction classes shown, as the sashimi
 * band keys them, and the interbase histogram's events.
 */
function markLegends(
  tables: {
    mismatches: { base: string[] }
    alleleCoverage: { base: string[]; shown: boolean[] }
    junctions: {
      strand: number[]
      source: string[]
      class: string[]
      level: string[]
      shown: boolean[]
    }
    interbaseCoverage: { type: InterbaseTypeName[] }
    indicators: { type: InterbaseTypeName[] }
  },
  paint: MarkColors,
  theme: JBrowsePalette,
) {
  const shownJunction = (i: number) => tables.junctions.shown[i] === true
  const bases = new Set([
    ...tables.mismatches.base,
    ...tables.alleleCoverage.base.filter(
      (_, i) => tables.alleleCoverage.shown[i] === true,
    ),
  ])
  const keyedBases = paint.muted ? [] : BASES.filter(b => bases.has(b))
  const junctionKey = sashimiLegendItems(
    sashimiLegend(
      new Set(
        tables.junctions.strand.filter(
          (_, i) => shownJunction(i) && tables.junctions.source[i] === 'gap',
        ),
      ),
      theme.alignmentFill,
      {
        classes: new Set(
          SPLIT_JUNCTION_CLASSES.filter(split =>
            tables.junctions.class.some(
              (c, i) =>
                shownJunction(i) &&
                c === junctionClass(split) &&
                tables.junctions.level[i] === arcLevelOf(split),
            ),
          ),
        ),
        palette: paint.palette,
      },
    ),
  )
  const events = new Set([
    ...tables.interbaseCoverage.type,
    ...tables.indicators.type,
  ])
  const keyedEvents = INTERBASE_TYPE_NAMES.filter(t => events.has(t))
  return {
    baseLegend: {
      label: keyedBases.map(b => b as string),
      color: keyedBases.map(b => paint.base[b]!),
    },
    baseLegendTitle: 'Base',
    junctionLegend: {
      label: junctionKey.map(item => item.label),
      color: junctionKey.map(item => cssColorToHex(item.color!)),
    },
    junctionLegendTitle: SASHIMI_LEGEND_TITLE,
    interbaseLegend: {
      label: keyedEvents.map(t => getCigarTypeLabel(t)),
      color: keyedEvents.map(t => paint.interbase[t]),
    },
    interbaseLegendTitle: 'Insertions and clips',
  }
}

/**
 * The tables each band's or layer's `show` turns off with it, as the display
 * then draws none of them.
 */
const BAND_TABLES: readonly {
  shown: (conf: DisplayConf) => boolean
  tables: readonly string[]
}[] = [
  {
    shown: conf => readConfObject(conf.pileup, 'show'),
    tables: [
      'reads',
      'mismatches',
      'gaps',
      'insertions',
      'clips',
      'modifications',
      'qualities',
      'connectors',
      'overlaps',
    ],
  },
  {
    shown: mismatchesShown,
    tables: ['mismatches', 'insertions'],
  },
  {
    shown: conf => readConfObject(conf.coverage, 'show'),
    tables: [
      'coverage',
      'alleleCoverage',
      'modificationCoverage',
      'interbaseCoverage',
      'indicators',
    ],
  },
  {
    shown: conf => readConfObject(conf.coverage.interbase, 'show'),
    tables: ['interbaseCoverage', 'indicators'],
  },
  {
    shown: conf => readConfObject(conf.coverage.alleles, 'show'),
    tables: ['alleleCoverage'],
  },
  {
    shown: conf => readConfObject(conf.sashimi, 'show'),
    tables: ['junctions'],
  },
]

function mismatchesShown(conf: DisplayConf): boolean {
  return readConfObject(conf.pileup.mismatches, 'show')
}

/**
 * The tables, each of a band the display does not draw left empty. Under
 * `pileup.mismatches.show: false` the display drops the deletions and keeps
 * the skips, which join a spliced read's blocks, so `gaps` keeps its skips.
 */
function drawnBands<
  T extends Record<string, Record<string, unknown[]>> & {
    gaps: { type: string[] }
  },
>(conf: DisplayConf, tables: T) {
  const hidden = new Set<string>(
    BAND_TABLES.flatMap(({ shown, tables }) => (shown(conf) ? [] : tables)),
  )
  const drawn = Object.fromEntries(
    Object.entries(tables).map(([name, table]) => [
      name,
      hidden.has(name)
        ? Object.fromEntries(Object.keys(table).map(column => [column, []]))
        : table,
    ]),
  ) as T
  return mismatchesShown(conf)
    ? drawn
    : {
        ...drawn,
        gaps: rowsAt(drawn.gaps, i => drawn.gaps.type[i] === 'skip'),
      }
}

type MarkColumn = number | readonly number[]

/**
 * The columns `names` of one mark kind's table as arrays of one length, a
 * scalar read as one mark, as R's jsonlite unboxes a one-row table. A table
 * left out is no marks; a column left out takes `defaults`' value, or is
 * refused.
 */
function markColumns<N extends string>(
  kind: string,
  table: Partial<Record<N, MarkColumn | null>> | null | undefined,
  names: readonly N[],
  defaults: Partial<Record<N, number>> = {},
) {
  const given: Partial<Record<N, MarkColumn | null>> = table ?? {}
  const none = table === undefined || table === null
  const arrays = names.map(name => {
    const column: MarkColumn | null | undefined = given[name]
    if (column === undefined || column === null) {
      return undefined
    }
    if (typeof column === 'number') {
      return [column]
    }
    if (!Array.isArray(column)) {
      throw new Error(`${kind}.${name} is a number or an array of numbers`)
    }
    return column as readonly number[]
  })
  const rows = none ? 0 : Math.max(0, ...arrays.map(a => a?.length ?? 0))
  return Object.fromEntries(
    names.map((name, i) => {
      const column = arrays[i]
      if (column === undefined) {
        const fallback = defaults[name]
        if (fallback === undefined && !none) {
          throw new Error(`${kind}.${name} is missing`)
        }
        return [name, Array.from({ length: rows }, () => fallback!)]
      }
      if (column.length !== rows) {
        const longest = names[arrays.findIndex(a => a?.length === rows)]!
        throw new Error(
          `${kind}.${name} has ${column.length} rows where ${kind}.${longest} has ${rows}`,
        )
      }
      return [name, column]
    }),
  ) as Record<N, readonly number[]>
}

/**
 * #api
 * Each connector of a `connectors` table as the pileup places its cubic at
 * `pxPerBp`, through the connector mark's own placement, for a host drawing
 * the table at its figure's scale. Both ends lie in one region, `reversed`
 * where it is flipped; `featureHeight` and `featureSpacing` are `readPitch`'s.
 * Returns each curve's two control points, `handle` and `endHandle` in bp
 * with `handleRow` and `endHandleRow` in rows as `row` counts them, a
 * straight connector's at its ends; and, where an arrowhead fits at this
 * scale, `arrow` true and `arrowBack`, the bp its arms reach back to, which
 * stand `arrowRows` rows off the row.
 */
export function alignmentConnectorCurves({
  pxPerBp,
  reversed = false,
  featureHeight,
  featureSpacing,
  connectors,
}: {
  pxPerBp: number
  reversed?: boolean
  featureHeight: number
  featureSpacing: number
  connectors: {
    start: readonly number[]
    end: readonly number[]
    row: readonly number[]
    endRow: readonly number[]
    kind: readonly ('straight' | 'curve' | 'loop')[]
    dip: readonly number[]
    strand: readonly number[]
    endStrand: readonly number[]
    leading: readonly boolean[]
    arrow: readonly boolean[]
  }
}) {
  if (!Number.isFinite(pxPerBp) || pxPerBp <= 0) {
    throw new Error(`pxPerBp is ${pxPerBp}; it takes a finite number > 0`)
  }
  const { start, end, row, endRow, kind, dip, strand, endStrand } = connectors
  const count = start.length
  const signedPxPerBp = reversed ? -pxPerBp : pxPerBp
  const rowPitchPx = featureHeight + featureSpacing
  const arrowPx = connectorArrowPx(featureHeight)
  const channels = {
    x: Uint32Array.from(start),
    x2: Uint32Array.from(end),
    x2Region: new Uint32Array(count),
    row: Uint32Array.from(row),
    row2: Uint32Array.from(endRow),
    bend: Float32Array.from(kind, (k, i) =>
      k !== 'straight' && dip[i] === 0 ? CONNECTOR_BOW : dip[i]!,
    ),
    width: new Float32Array(count).fill(1),
    color: new Uint32Array(count),
    bits: Uint8Array.from(
      kind,
      (k, i) =>
        (strand[i]! < 0 ? CONNECTOR_MINUS_1 : 0) |
        (endStrand[i]! < 0 ? CONNECTOR_MINUS_2 : 0) |
        (connectors.leading[i] ? CONNECTOR_LEADING_2 : 0) |
        (k === 'straight' ? CONNECTOR_STRAIGHT : 0) |
        (connectors.arrow[i] ? CONNECTOR_ARROW : 0),
    ),
    count,
  }
  const params = {
    regions: [{ anchorPx: 0, anchorBp: 0, signedPxPerBp }],
    rowOffsetPx: 0,
    rowPitchPx,
    arrowPx,
  }
  const placed = Array.from({ length: count }, (_, i) =>
    connectorPlacement(channels, params, 0, i),
  )
  const bp = (px: number) => px / signedPxPerBp
  const rows = (px: number) => px / rowPitchPx
  return {
    handle: placed.map(p => bp(p!.x1)),
    handleRow: placed.map(p => rows(p!.y1)),
    endHandle: placed.map(p => bp(p!.x2)),
    endHandleRow: placed.map(p => rows(p!.y2)),
    arrow: placed.map(p => p!.arrow),
    arrowBack: placed.map(p => bp(p!.x3 + p!.back)),
    arrowRows: rows(arrowPx),
  }
}

let pileupDefaults: Instance<typeof pileupConfigSchema> | undefined

/**
 * #api
 * Each insertion's width in px and each insertion's, deletion's, mismatch's
 * and clip's alpha as the pileup draws them at `pxPerBp`, through the
 * shaders' generated twins, for a host that draws the marks at its figure's
 * scale. `fade` is a mark's `fade` column, `length` its length in bp (a
 * deletion's `end - start`) and `quality` a mismatch's, 255 where the read
 * has none. A column may be a number, for one mark. `featureHeight` is
 * `readPitch.featureHeight`, `fadeLowFrequency` the display's
 * `pileup.fadeLowFrequency`, and `mismatchOpacity` its
 * `pileup.mismatches.encoding.opacity` as a config writes it; each of the
 * three takes the pileup config's default when left out.
 *
 * - An insertion's `widthPx` is `insertionBarWidthPx`, and its `alpha`
 *   `insertionSizeAlpha` times, under `LONG_INSERTION_MIN_LENGTH`,
 *   `frequencyFadeGate` over `pxPerBp` squared.
 * - A deletion's `alpha` is `sizeAlpha` of its width in px times
 *   `frequencyFadeGate` over that width squared.
 * - A mismatch's `alpha` is `qualityFade` times `frequencyFadeGate` over
 *   `pxPerBp`, and a clip's that gate alone. `quality` may be left out
 *   while `mismatchOpacity` is a constant.
 */
export function alignmentMarkAlpha({
  pxPerBp,
  featureHeight,
  fadeLowFrequency,
  mismatchOpacity = {},
  insertions,
  deletions,
  mismatches,
  clips,
}: {
  pxPerBp: number
  featureHeight?: number
  fadeLowFrequency?: boolean
  mismatchOpacity?: PileupMismatchesOpacitySnapshot
  insertions?: { length: MarkColumn; fade: MarkColumn }
  deletions?: { length: MarkColumn; fade: MarkColumn }
  mismatches?: { fade: MarkColumn; quality?: MarkColumn }
  clips?: { fade: MarkColumn }
}) {
  if (!Number.isFinite(pxPerBp) || pxPerBp < 0) {
    throw new Error(`pxPerBp is ${pxPerBp}; it takes a finite number >= 0`)
  }
  pileupDefaults ??= pileupConfigSchema.create()
  const height: number =
    featureHeight ?? readConfObject(pileupDefaults, ['mark', 'height'])
  if (!Number.isFinite(height) || height < 0) {
    throw new Error(
      `featureHeight is ${featureHeight}; it takes a finite number >= 0`,
    )
  }
  const byFrequency: boolean =
    fadeLowFrequency ?? readConfObject(pileupDefaults, 'fadeLowFrequency')
  const opacity = refusingUndeclaredKeys(() =>
    pileupMismatchesOpacityConfigSchema.create(
      typeof mismatchOpacity === 'string'
        ? { field: mismatchOpacity }
        : typeof mismatchOpacity === 'number'
          ? { value: mismatchOpacity }
          : mismatchOpacity,
    ),
  )
  const setting = resolvedMismatchOpacity({
    value: readConfObject(opacity, 'value'),
    field: readConfObject(opacity, 'field'),
    scale: {
      domainMin: readConfObject(opacity, ['scale', 'domainMin']),
      domainMax: readConfObject(opacity, ['scale', 'domainMax']),
      range: readConfObject(opacity, ['scale', 'range']),
      clamp: readConfObject(opacity, ['scale', 'clamp']),
    },
  })
  const byQuality = setting.field === 'baseQuality'
  const { zero, slope, min, max } = qualityOpacityOf(setting)
  const ins = markColumns('insertions', insertions, ['length', 'fade'])
  const del = markColumns('deletions', deletions, ['length', 'fade'])
  const mis = markColumns(
    'mismatches',
    mismatches,
    ['fade', 'quality'],
    byQuality ? {} : { quality: QUAL_UNAVAILABLE },
  )
  const clip = markColumns('clips', clips, ['fade'])
  const gate = (base: number, fade: number) =>
    frequencyFadeGate(base, fade, byFrequency)
  return {
    insertions: {
      widthPx: ins.length.map(length =>
        insertionBarWidth(length, pxPerBp, height),
      ),
      alpha: ins.length.map(
        (length, i) =>
          insertionSizeAlpha(length, pxPerBp) *
          (length < LONG_INSERTION_MIN_LENGTH
            ? gate(pxPerBp * pxPerBp, ins.fade[i]!)
            : 1),
      ),
    },
    deletions: {
      alpha: del.length.map((length, i) => {
        const widthPx = length * pxPerBp
        return sizeAlpha(widthPx) * gate(widthPx * widthPx, del.fade[i]!)
      }),
    },
    mismatches: {
      alpha: mis.fade.map(
        (fade, i) =>
          qualityFade(mis.quality[i]!, zero, slope, min, max) *
          gate(pxPerBp, fade),
      ),
    },
    clips: {
      alpha: clip.fade.map(fade => gate(pxPerBp, fade)),
    },
  }
}

export type AlignmentTables = Awaited<ReturnType<typeof alignmentTables>>
