import {
  INDICATOR_TRIANGLE_H,
  INDICATOR_TRIANGLE_HW,
  coverageDepthDomain,
  LABEL_FADE_FLOOR,
  LABEL_FADE_HI_RATIO,
  LABEL_FADE_LO_RATIO,
  MIN_HEIGHT_FOR_TEXT,
  MIN_PX_PER_BP_FOR_TEXT,
  interbaseEdgePx,
  labelFont,
  pairDirectionOfNum,
  readIdAt,
  readInterbaseSegments,
  readNameAt,
  readModCovSegments,
  readSnpSegments,
} from '@jbrowse/alignments-core'
import { fullConfSnapshot, readConfObject } from '@jbrowse/core/configuration'
import { isSequenceAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { tablesFeatureAdapter } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import {
  DEFAULT_BYTE_LIMIT,
  joinTables,
  lociOf,
  numberByFirstAppearance,
} from '@jbrowse/core/data_adapters/tables'
import { ungatedResult } from '@jbrowse/core/rpc/byteBudget'
import { rampKeyOf } from '@jbrowse/core/ui/rampKey'
import {
  abgrAlpha,
  abgrToHex,
  cssColorToHex,
  normalizedRgbToHex,
} from '@jbrowse/core/util/colorBits'
import {
  byteGatedFetchRegions,
  regionBlocks,
  windowFrames,
} from '@jbrowse/display-kit/regionHost'
import { resolveSymlogConstant } from '@jbrowse/wiggle-core'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'
import { runInAction } from 'mobx'

import BamAdapterF from './BamAdapter/index.ts'
import CramAdapterF from './CramAdapter/index.ts'
import { sortOf } from './LinearAlignmentsDisplay/alignmentsSortConfigSchema.ts'
import {
  READ_COLOR_CATEGORY_BY_INDEX,
  readColorFromCategoryIndex,
} from './LinearAlignmentsDisplay/colorUtils.ts'
import {
  MAX_LAYOUT_ROWS,
  groupClipSource,
} from './LinearAlignmentsDisplay/groupLayout.ts'
import { junctionKeyOf } from './LinearAlignmentsDisplay/keyWindows.ts'
import {
  intronAlpha,
  shouldDrawOverlaps,
} from './LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { executeRenderAlignmentData } from './RenderAlignmentDataRPC/executeRenderAlignmentData.ts'
import { appliedPileupSort } from './RenderAlignmentDataRPC/sortLayout.ts'
import {
  footRegion,
  arcLevelOf,
  readConnectionTables,
  pooledLaneBands,
  sectionConnectors,
  connectorColumns,
} from './connectionTables.ts'
import {
  junctionColor,
  junctionArcHeightFraction,
  junctionStrokeWidth,
} from './features/junctions/bandFeed.ts'
import { visibleRegionJunctions } from './features/junctions/computeOverlay.ts'
import {
  junctionClass,
  junctionSource,
} from './features/junctions/junctionClass.ts'
import {
  mergeJunctions,
  passesJunctionFilter,
} from './features/junctions/junctions.ts'
import { spliceMotifLabel } from './features/junctions/motif.ts'
import { effectiveBaseColors } from './features/mismatch/baseColors.ts'
import { byOverlapKind } from './features/overlap/types.ts'
import {
  BASE_QUALITY_UNAVAILABLE,
  qualityAbgr,
} from './features/perBaseQuality/colors.ts'
import { buildArcColorPalette } from './shaders/palettes.ts'
import { GAP_SKIP } from './shaders/slang/gap.consts.generated.ts'
import { isBakedField, paintedLevelOf } from './shared/alignmentsColor.ts'
import {
  colorFieldKindOf,
  paintsModifications,
} from './shared/colorFieldDefs.ts'
import { countedEventsOf } from './shared/drawnReads.ts'
import { facetUnitNotices } from './shared/groupFeatures.ts'
import {
  junctionLegendItems,
  JUNCTION_LEGEND_TITLE,
  junctionLegend,
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
import { rowsWhere, rowsAt, spanTouches } from './tableRows.ts'
import { NO_KEYS, AlignmentsTablesHost } from './tablesHost.ts'

import type { RefNamePosition } from './LinearAlignmentsDisplay/colorTagUtils.ts'
import type { ReadColorCategory } from './LinearAlignmentsDisplay/colorUtils.ts'
import type { RegionBounds } from './RenderAlignmentDataRPC/sortLayout.ts'
import type {
  GroupedAlignmentsResult,
  LaidOutPileupData,
  WorkerPileupData,
} from './RenderAlignmentDataRPC/types.ts'
import type { RegionInfo } from './features/arcs/arcTypes.ts'
import type {
  MergedJunction,
  RegionJunctions,
} from './features/junctions/junctions.ts'
import type { ColorPalette } from './shaders/colors.ts'
import type {
  BaseLayer,
  InterbaseTypeName,
  LayoutOrder,
  JunctionFilter,
  SortColumn,
} from './shared/types.ts'
import type { AlignmentsTablesHostModel } from './tablesHost.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { TablesRegion } from '@jbrowse/core/data_adapters/tables'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

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
   * The regions the view displays, which `regions` are windows into: one
   * locus's whole contig, as the browser shows a locus. The display fetches
   * over each window and the view's margin around it, clamped to the region
   * displayed, which `byteLimit` applies to. Unset, `regions` themselves.
   */
  displayedRegions?: TablesRegion[]
  /**
   * The display's config as a track's `displays` entry writes it for a
   * `LinearAlignmentsDisplay`. The tables read its `encoding.color`,
   * `filter`, `sort` and `facet` objects, and its four
   * bands: `coverage`, `pileup` (with `pileup.bases`), `junctions` and
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

/**
 * One section's tables in one region, listing of the reads fetched with the
 * view's margin the ones touching `region` and the ones a listed connector
 * joins, which the display draws partly off screen, each with its marks.
 */
function windowedPart<
  C extends Record<string, unknown>,
  T extends {
    reads: { key: ArrayLike<number> }
    connectors: { key: readonly number[]; mateKey: readonly number[] }
  },
>(
  columns: C,
  d: WorkerPileupData,
  region: { start: number; end: number },
  tables: T,
) {
  const joined = new Set([
    ...tables.connectors.key,
    ...tables.connectors.mateKey,
  ])
  return {
    columns,
    tables,
    keep: {
      reads: (read: number) =>
        (d.readPositions[read * 2]! < region.end &&
          d.readPositions[read * 2 + 1]! > region.start) ||
        joined.has(tables.reads.key[read]!),
    },
  }
}

/**
 * The joined tables with each read's `key` renumbered from 0 in the order the
 * reads list them, the connectors' with them: the margin's reads take keys as
 * they are read and leave the tables after.
 */
function denseKeys<
  T extends {
    reads: { key: number[] }
    connectors: { key: number[]; mateKey: number[] }
  },
>(tables: T) {
  const renumber = numberByFirstAppearance<number>()
  return {
    ...tables,
    reads: { ...tables.reads, key: tables.reads.key.map(renumber) },
    connectors: {
      ...tables.connectors,
      key: tables.connectors.key.map(renumber),
      mateKey: tables.connectors.mateKey.map(renumber),
    },
  }
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
 * and each junction as the junctions band paints it (`junctionColor`).
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

/**
 * The display's color pipeline over its laid-out sections, run as the display
 * runs it (`alignmentsColorViews`): each read painted the color the display
 * paints it, with the level it classifies into, and the key the display
 * shows beside them.
 */
function colorReads(host: AlignmentsTablesHostModel) {
  const palette = host.colors
  const levelOf = readLevelOf(host.colorField)
  const sections = new Map(
    [...host.laidOutByGroupColored].map(([key, map]) => [
      key,
      new Map(
        [...map].map(([idx, data]) => {
          const color = Array.from(data.readColorCategories, (c, i) =>
            cssColorToHex(readColorFromCategoryIndex(c, i, data, palette)),
          )
          const level = Array.from(data.readColorCategories, (c, i) =>
            levelOf(data, i, READ_COLOR_CATEGORY_BY_INDEX[c]!),
          )
          return [idx, { color, level }]
        }),
      ),
    ]),
  )
  // A swatch-only row (collapsed lanes' overlap tint) has no color, and no
  // table carries the tint it keys, so the key leaves it out.
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
 * The junctions the reads' skips, deletions of `SV_INDEL_MIN_BP` or more and
 * split reads support, merged as the junctions band merges them: each once,
 * with its supporting-read count, its `class` and `source` as the filter's
 * `junction` fields name them, a split junction's `level` (the
 * `insertSizeAndOrientation` level its color paints, '' for any other), the
 * strand its reads' tags or its splice motif give a splice junction (0 where
 * neither says, and for any other), and the motif where the reference
 * was read. Every junction, down to a single
 * read, with `shown` false where the display's `junction` filter fields hide it; a
 * junction whose motif was never read counts as canonical, as the display
 * counts it. `arcHeight` is the apex as a fraction
 * of the band and `strokeWidth` the stroke in px, the junctions marks' own.
 * `band` is the band its arc draws in (`junctionBandOf`).
 * A junction the reads of several regions show is merged once, as the
 * junctions band merges it, and `startRegion` and `endRegion` name the region
 * holding each foot, -1 where none does.
 */
export function junctionColumns(
  merged: MergedJunction[],
  regionInfos: RegionInfo[],
  paint: Pick<MarkColors, 'junction'>,
  thresholds: Pick<MarkThresholds, 'junctions'>,
  bandOf: (junction: MergedJunction) => JunctionBand,
) {
  return {
    start: merged.map(j => j.start),
    end: merged.map(j => j.end),
    count: merged.map(j => j.count),
    class: merged.map(j => junctionClass(j.kind)),
    level: merged.map(j => (j.split ? arcLevelOf(j.split) : '')),
    source: merged.map(j => junctionSource(j.kind)),
    strand: merged.map(j => j.strand),
    motif: merged.map(j => spliceMotifLabel(j.motif) ?? ''),
    color: merged.map(j => paint.junction(j)),
    shown: merged.map(j => passesJunctionFilter(j, thresholds.junctions)),
    arcHeight: merged.map(j =>
      junctionArcHeightFraction(Math.abs(j.end - j.start)),
    ),
    strokeWidth: merged.map(j => junctionStrokeWidth(j.count)),
    band: merged.map(j => bandOf(j)),
    refName: merged.map(j => j.refName),
    startRegion: merged.map(j => footRegion(regionInfos, j.refName, j.start)),
    endRegion: merged.map(j => footRegion(regionInfos, j.refName, j.end)),
  }
}

/**
 * Every junction the regions' reads support, down to a single read, merged
 * once as the junctions band merges them, in contig then position order.
 */
function mergedJunctions(
  perRegion: RegionJunctions[],
  regionInfos: RegionInfo[],
) {
  const contigOrder = new Map<string, number>()
  for (const { refName } of regionInfos) {
    if (!contigOrder.has(refName)) {
      contigOrder.set(refName, contigOrder.size)
    }
  }
  return [...mergeJunctions(perRegion, { minReads: 0 }).values()].sort(
    (a, b) =>
      contigOrder.get(a.refName)! - contigOrder.get(b.refName)! ||
      a.start - b.start ||
      a.end - b.end,
  )
}

type JunctionBand = 'coverage' | 'junctions'

/**
 * The band a section's junction draws in, as `bandStack` names it:
 * `junctions`, the arcs' own strip, where `junctions.placement` sends the
 * junction there (`junctionsStripKeysByGroup`), and `coverage`, over the
 * histogram, otherwise. A junction the display hides is in no lane's set, so
 * it takes the band its placement gives every junction, and `coverage` under
 * `auto`.
 */
function junctionBandOf(host: AlignmentsTablesHostModel, section: string) {
  const strip = host.junctionsStripKeysByGroup.get(section) ?? NO_KEYS
  const placement = host.effectiveJunctionsPlacement
  const everyJunction = placement === 'above' || placement === 'below'
  return (junction: MergedJunction): JunctionBand =>
    everyJunction || strip.has(junction.key) ? 'junctions' : 'coverage'
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

/** The overlaps the window shows. */
function overlapsInWindow(
  { overlaps }: ReturnType<typeof overlapTables>,
  window: { start: number; end: number },
) {
  return {
    overlaps: rowsAt(overlaps, i =>
      spanTouches(window, overlaps.start[i]!, overlaps.end[i]!),
    ),
  }
}

/**
 * The bands a section stacks above its pileup, top to bottom as the display
 * orders them (`laneBandOrder`), each with the px it reserves: 0 for a band
 * that is hidden, has nothing to draw, or draws over the coverage band.
 */
function bandStackOf(host: AlignmentsTablesHostModel) {
  const { stack } = pooledLaneBands(host)
  return {
    key: [...stack.order],
    heightPx: stack.order.map(key => stack.reserved[key]),
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

/**
 * The coverage band's depth axis as the display autoscales it
 * (`coverageStatsViews`): every shown section's visible depths in every
 * region under `coverage.encoding.y`'s fence, rules and bounds, nice-rounded,
 * with a log scale floored at one read, and the ticks the display labels it
 * with at its height. A band the display does not draw has no ticks.
 * `heightPx` is the px the display draws the band at, 0 while it is off; with
 * the pileup hidden it is the band's share of a section's slot.
 */
function coverageScale(host: AlignmentsTablesHostModel) {
  const type = host.scaleType
  const domain = host.coverageDepthDomain ?? coverageDepthDomain([0, 0], type)
  return {
    domain,
    type,
    heightPx: pooledLaneBands(host).stack.reserved.coverage,
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
 * names its `region`'s index. `arcScale` is the read-connection band's y
 * scale (`arcBandScale`): the read cloud's log `domain`, or for arcs none,
 * as their linear domain is `[0, reachPx / pxPerBp]` at the host's own
 * scale, and the band they draw in. `bandStack` is where each band sits: the
 * bands a section stacks above its pileup, top to bottom, with the px each
 * reserves, so a read-connection or junctions strip listed before `coverage`
 * sits above it, its arcs rising from its floor, and one after it sits below.
 * `warnings` names what the config asked
 * for that the tables dropped. For a host that draws them itself, such as R
 * through V8. The adapters must be registered on `pluginManager`
 * (`registerAlignmentsAdapters`).
 */
export async function alignmentTables(
  pluginManager: PluginManager,
  {
    adapterConfig,
    sequenceAdapter,
    regions,
    displayedRegions,
    display = {},
    refNames,
    refNamePosition,
    byteLimit = DEFAULT_BYTE_LIMIT,
    spanLimit = DEFAULT_SPAN_LIMIT,
  }: AlignmentTablesArgs,
) {
  const several = regions.length > 1
  const span = regions.reduce((sum, r) => sum + r.end - r.start, 0)
  if (span > spanLimit) {
    throw new Error(
      `${lociOf(regions)} ${several ? 'span' : 'spans'} ${span} bp of alignments${several ? ' in total' : ''}, over the ${spanLimit}-bp limit; read a smaller region or raise spanLimit`,
    )
  }
  const dataAdapter = await tablesFeatureAdapter(
    pluginManager,
    adapterConfig,
    sequenceAdapter,
  )
  const { fetchRegions } = await byteGatedFetchRegions({
    adapter: dataAdapter,
    regions,
    displayedRegions,
    byteLimit,
    what: 'alignments',
  })
  const host = AlignmentsTablesHost.create({
    type: 'LinearAlignmentsDisplay',
    configuration: {
      ...display,
      type: 'LinearAlignmentsDisplay',
      displayId: 'tables',
    },
  })
  const args = runInAction(() => {
    host.setSortColumn(
      sortOf(
        host.configuration.sort,
        refName =>
          regions.find(r => r.originalRefName === refName)?.refName ?? refName,
        regions[0]!.refName,
      ).sortColumn,
    )
    return {
      sessionId: 'tables',
      adapterConfig,
      sequenceAdapter,
      regions: fetchRegions,
      ...host.rpcProps(),
      showCoverage: true,
      statusCallback: () => {},
    } satisfies RpcExecuteArgs<'RenderAlignmentData'>
  })
  // the worker reads one region a call
  const run = (facet: typeof args.facet) =>
    Promise.all(
      fetchRegions.map(async r => {
        const { value } = ungatedResult(
          await executeRenderAlignmentData({
            pluginManager,
            args: { ...args, regions: [r], facet },
          }),
          'RenderAlignmentData',
        )
        return value
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
      frames: windowFrames(regions, displayedRegions),
      fetchedRegions: fetchRegions,
      fetched,
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
    frames,
    fetchedRegions,
    fetched,
    paintedRefNamePosition,
  }: {
    regions: TablesRegion[]
    frames: TablesRegion[]
    fetchedRegions: TablesRegion[]
    fetched: ReadonlyMap<number, GroupedAlignmentsResult>
    paintedRefNamePosition: RefNamePosition | undefined
  },
) {
  host.setInputs({
    rpcDataMap: fetched,
    fetchedRegions,
    regionInfos: regionBlocks(regions),
    frames: regionBlocks(frames),
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
  if (
    [...laidByGroup.values()].some(map => groupClipSource(map) === 'ceiling')
  ) {
    throw new Error(
      `${lociOf(regions)} stacks reads more than ${MAX_LAYOUT_ROWS} rows deep, the pileup’s row limit; read a smaller region`,
    )
  }
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
  const readPitch = host.rowHeight
  const connectorsBySection = sectionConnectors(host, readPitch)
  const slotRgb = buildArcColorPalette(colors.palette)
  const connections = readConnectionTables(
    host,
    colors,
    slotRgb.map(normalizedRgbToHex),
  )
  const keyOf = numberByFirstAppearance<WorkerPileupData['readKeys'][number]>()
  const plainRead = normalizedRgbToHex(colors.palette.readCategoryColors.plain)
  const pileups = regions.flatMap((r, i) =>
    order.flatMap(({ key, label }) => {
      const laid = laidByGroup.get(key)!.get(i)
      return laid
        ? [
            windowedPart({ section: label, region: i }, dataFor(key, i), r, {
              ...connectorColumns(
                connectorsBySection.get(key)?.get(i) ?? [],
                slotRgb,
                colors.palette,
                keyOf,
              ),
              ...overlapsInWindow(
                overlapTables(
                  laid,
                  drawsOverlaps,
                  byOverlapKind(
                    normalizedRgbToHex(colors.palette.colorOverlap),
                    normalizedRgbToHex(colors.palette.colorMateOverlap),
                  ),
                ),
                r,
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
            }),
          ]
        : []
    }),
  )
  const junctionsBySection = new Map(
    order.map(({ key }) => [
      key,
      mergedJunctions(
        visibleRegionJunctions(sectionData.get(key)!, regionInfos),
        regionInfos,
      ),
    ]),
  )
  const tables = drawnBands(host, {
    ...denseKeys(joinTables(pileups, { read: 'reads' })),
    ...joinTables(
      regions.flatMap((_, i) =>
        order.map(({ key, label }) => ({
          columns: { section: label, region: i },
          tables: connections.bySection.get(key)!.get(i)!,
        })),
      ),
    ),
    ...joinTables(
      order.map(({ key, label }) => ({
        columns: { section: label },
        tables: {
          junctions: junctionColumns(
            junctionsBySection.get(key)!,
            regionInfos,
            paint,
            thresholds,
            junctionBandOf(host, key),
          ),
        },
      })),
    ),
  })
  return {
    ...tables,
    ...markLegends(
      tables,
      paint,
      host.theme,
      junctionKeyOf(
        host.showJunctions
          ? [...junctionsBySection.values()]
              .flat()
              .filter(j => passesJunctionFilter(j, thresholds.junctions))
          : [],
        host.keyWindows,
      ),
    ),
    sections: {
      key: order.map(g => g.key),
      label: order.map(g => g.label),
    },
    // apart where the display's one legend box merges them: a host drawing
    // reads and arcs as separate layers keys each, so merging here was reverted
    legend: colors.legend,
    legendTitle: colors.legendTitle,
    ramps: colors.ramps,
    arcLegend: connections.arcLegend,
    arcLegendTitle: connections.arcLegendTitle,
    arcSpanMax: connections.arcSpanMax,
    arcScale: connections.arcScale,
    bandStack: bandStackOf(host),
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
      interbaseTop: interbaseEdgePx(0, 0, 0),
    },
    readPitch: {
      featureHeight,
      featureSpacing: host.featureSpacing,
    },
    config: resolvedConfig(host),
    warnings: [
      ...facetUnitNotices(host.facet, unit),
      ...layoutWarnings({
        sortField: readConfObject(host.configuration.sort, 'field'),
        sortColumn: host.sortColumn,
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
 * What the layout drops of the display's `sort` and `pileup.softclips`
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
        `under unit 'chain' the reads lay out by chain, so pileup.softclips is dropped`,
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
 * splice junction strands and split junction classes shown in the window, as
 * the junctions band keys them, and the interbase histogram's events.
 */
function markLegends(
  tables: {
    mismatches: { base: string[] }
    alleleCoverage: { base: string[]; shown: boolean[] }
    interbaseCoverage: { type: InterbaseTypeName[] }
    indicators: { type: InterbaseTypeName[] }
  },
  paint: MarkColors,
  theme: JBrowsePalette,
  junctionKey: ReturnType<typeof junctionKeyOf>,
) {
  const bases = new Set([
    ...tables.mismatches.base,
    ...tables.alleleCoverage.base.filter(
      (_, i) => tables.alleleCoverage.shown[i] === true,
    ),
  ])
  const keyedBases = paint.muted ? [] : BASES.filter(b => bases.has(b))
  const junctionItems = junctionLegendItems(
    junctionLegend(junctionKey.strands, theme.alignmentFill, {
      kinds: junctionKey.kinds,
      palette: paint.palette,
    }),
  )
  const events = new Set([
    ...tables.interbaseCoverage.type,
    ...tables.indicators.type,
  ])
  const keyedEvents = INTERBASE_TYPE_NAMES.filter(t => events.has(t))
  return {
    baseLegend: {
      label: keyedBases,
      color: keyedBases.map(b => paint.base[b]!),
    },
    baseLegendTitle: 'Base',
    junctionLegend: {
      label: junctionItems.map(item => item.label),
      color: junctionItems.map(item => cssColorToHex(item.color!)),
    },
    junctionLegendTitle: JUNCTION_LEGEND_TITLE,
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
type DrawnBandsHost = Pick<
  AlignmentsTablesHostModel,
  | 'showPileup'
  | 'showMismatches'
  | 'showCoverage'
  | 'showInterbase'
  | 'showCoverageAlleles'
  | 'showJunctions'
>

const BAND_TABLES: readonly {
  shown: keyof DrawnBandsHost
  tables: readonly string[]
}[] = [
  {
    shown: 'showPileup',
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
    shown: 'showMismatches',
    tables: ['mismatches', 'insertions'],
  },
  {
    shown: 'showCoverage',
    tables: [
      'coverage',
      'alleleCoverage',
      'modificationCoverage',
      'interbaseCoverage',
      'indicators',
    ],
  },
  {
    shown: 'showInterbase',
    tables: ['interbaseCoverage', 'indicators'],
  },
  {
    shown: 'showCoverageAlleles',
    tables: ['alleleCoverage'],
  },
  {
    shown: 'showJunctions',
    tables: ['junctions'],
  },
]

/**
 * The tables, each of a band the display does not draw left empty. Under
 * `pileup.mismatches.show: false` the display drops the deletions and keeps
 * the skips, which join a spliced read's blocks, so `gaps` keeps its skips.
 */
function drawnBands<
  T extends Record<string, Record<string, unknown[]>> & {
    gaps: { type: string[] }
  },
>(host: DrawnBandsHost, tables: T) {
  const hidden = new Set<string>(
    BAND_TABLES.flatMap(({ shown, tables }) => (host[shown] ? [] : tables)),
  )
  const drawn = Object.fromEntries(
    Object.entries(tables).map(([name, table]) => [
      name,
      hidden.has(name)
        ? Object.fromEntries(Object.keys(table).map(column => [column, []]))
        : table,
    ]),
  ) as T
  return host.showMismatches
    ? drawn
    : {
        ...drawn,
        gaps: rowsAt(drawn.gaps, i => drawn.gaps.type[i] === 'skip'),
      }
}

export type AlignmentTables = Awaited<ReturnType<typeof alignmentTables>>

export {
  alignmentConnectorCurves,
  alignmentMarkAlpha,
} from './tablesGeometry.ts'
