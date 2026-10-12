import {
  pairDirectionOfNum,
  readModCovSegments,
  readSnpSegments,
} from '@jbrowse/alignments-core'
import { readConfObject } from '@jbrowse/core/configuration'
import { isSequenceAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { rampKeyOf } from '@jbrowse/core/ui/rampKey'
import {
  abgrAlpha,
  abgrToHex,
  cssColorToHex,
  normalizedRgbToHex,
} from '@jbrowse/core/util/colorBits'
import { withPreset } from '@jbrowse/core/util/colorScale'
import {
  colorSettingOf,
  colorSnapshotOf,
} from '@jbrowse/display-kit/colorConfigSchema'
import { facetSettingOf } from '@jbrowse/display-kit/facetConfigSchema'
import { SCALE_TYPE_LOG } from '@jbrowse/render-core/scoreScale'
import { linkStrokeWidthPx } from '@jbrowse/render-core/shaders/linkMark'
import { LINK_SIZE_SCALED } from '@jbrowse/render-core/shaders/linkMarkConsts'

import BamAdapterF from './BamAdapter/index.ts'
import CramAdapterF from './CramAdapter/index.ts'
import { sortOf } from './LinearAlignmentsDisplay/alignmentsSortConfigSchema.ts'
import {
  bakedColorExtent,
  bakedColorScale,
  linearFieldExtent,
} from './LinearAlignmentsDisplay/bakedColorScale.ts'
import {
  READ_COLOR_CATEGORY_BY_INDEX,
  readColorFromCategoryIndex,
} from './LinearAlignmentsDisplay/colorUtils.ts'
import { buildColorPaletteFromPalette } from './LinearAlignmentsDisplay/components/alignmentComponentUtils.ts'
import displayConfigSchemaFactory from './LinearAlignmentsDisplay/configSchema.ts'
import {
  applyReadColorsByGroup,
  collectAcrossGroups,
} from './LinearAlignmentsDisplay/groupLayout.ts'
import { orderedGroups } from './LinearAlignmentsDisplay/groupedDataMaps.ts'
import {
  baseQualitySpanAcrossGroups,
  presentMapqs,
} from './LinearAlignmentsDisplay/qualitySpans.ts'
import { readFilterOf } from './LinearAlignmentsDisplay/readFilterConfigSchema.ts'
import { executeRenderAlignmentData } from './RenderAlignmentDataRPC/executeRenderAlignmentData.ts'
import { buildLaidOutPileupMap } from './RenderAlignmentDataRPC/sortLayout.ts'
import {
  ARC_COLOR_INTERCHROM,
  arcColorSlot,
} from './features/arcs/arcColors.ts'
import { arcStrokeScale } from './features/arcs/arcLineWidth.ts'
import { ordinaryPairsShown } from './features/arcs/arcTypes.ts'
import { arcOpacity } from './features/arcs/bandFeed.ts'
import { computeArcsByGroup } from './features/arcs/compute.ts'
import { emptyArcsUploadData } from './features/arcs/types.ts'
import {
  BASE_QUALITY_UNAVAILABLE,
  qualityAbgr,
} from './features/perBaseQuality/colors.ts'
import { mergeJunctions } from './features/sashimi/junctions.ts'
import { spliceMotifLabel } from './features/sashimi/motif.ts'
import { arcSlotCategory, buildArcColorPalette } from './shaders/palettes.ts'
import { GAP_SKIP } from './shaders/slang/gap.consts.generated.ts'
import {
  ALIGNMENTS_FIELD_PRESETS,
  alignmentsColorEncoding,
  baseLayerOf,
  bodyColorScheme,
  colorByOf,
  colorFieldOf,
  declaredReadLabels,
  isBakedScheme,
  pinnedInsertSizeBand,
  writtenReadCategoryColors,
} from './shared/alignmentsColor.ts'
import { arcColorFieldOf } from './shared/arcColorOptions.ts'
import { sectionOrder, workerFacet } from './shared/groupFeatures.ts'
import { joinSections } from './shared/joinSections.ts'
import { keySectionOrder } from './shared/keySectionOrder.ts'
import {
  READS_RAMP_ID,
  arcLegendTitle,
  colorRampScales,
  getArcLegendItems,
  getReadDisplayLegendItems,
} from './shared/legendUtils.ts'
import { getModificationName } from './shared/modificationData.ts'
import { INTERBASE_INSERTION, INTERBASE_SOFTCLIP } from './shared/types.ts'
import { getColorForModification } from './util.ts'

import type { RefNamePosition } from './LinearAlignmentsDisplay/colorTagUtils.ts'
import type { ReadColorCategory } from './LinearAlignmentsDisplay/colorUtils.ts'
import type { LinearAlignmentsDisplayConfigModel as DisplayConf } from './LinearAlignmentsDisplay/configSchema.ts'
import type { ReadConnectionsMode } from './LinearAlignmentsDisplay/constants.ts'
import type {
  LaidOutPileupData,
  WorkerPileupData,
} from './RenderAlignmentDataRPC/types.ts'
import type { ArcsUploadData } from './features/arcs/types.ts'
import type {
  ArcColorField,
  BaseLayer,
  ModificationColorBy,
} from './shared/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

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
  const adapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId: 'tables',
    adapterConfig: sequenceAdapter,
  })
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
  region: {
    refName: string
    start: number
    end: number
    /**
     * The contig's name in the reference, where the file spells it another
     * way (`1` in the BAM, `chr1` in the FASTA): what a read with no MD tag
     * is compared against, as the browser's `originalRefName` is.
     */
    originalRefName?: string
  }
  /**
   * The display's config as a track's `displays` entry writes it for a
   * `LinearAlignmentsDisplay`. The tables read its `color`, `filter`,
   * `baseColor`, `modifications`, `sort` and `facet` objects, and its read
   * connections: `readConnections` (`'arc'` or `'cloud'`), `arcColor`,
   * `showInterchrom`, `showLongRange`, `showOrdinaryPairs`,
   * `minInterchromSupport` and `readConnectionsLineWidth`. Unset reads the
   * default display.
   */
  display?: Record<string, unknown>
  /**
   * The assembly's contigs in its own order, spelled as the file spells them,
   * which `color: { field: "mateRefName" }` deals its palette by: a read's
   * mate reference is matched as written, where the browser canonicalizes it
   * through the assembly first. Unset, the file header's order stands in.
   */
  refNames?: readonly string[]
  /**
   * The most compressed bytes the region may need, refused off the index
   * before any read is fetched. 200 MB by default; a host holds the whole
   * table in memory, where the browser draws it in pieces.
   */
  byteLimit?: number
}

const DEFAULT_BYTE_LIMIT = 200_000_000

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

function readNames(d: WorkerPileupData) {
  const off = d.readNameOffsets
  const names: string[] = []
  for (let i = 0; i + 1 < off.length; i++) {
    names.push(d.readNameBlock.slice(off[i], off[i + 1]))
  }
  return names
}

/**
 * Each mismatch's base as a share of the depth at its position: how many reads
 * there carry that base, over the coverage. The worker's own
 * `mismatchFrequencies` is a display fade, zeroed below a depth-dependent
 * threshold, so it is not this.
 */
function alleleFrequencies(d: WorkerPileupData) {
  const key = (i: number) => d.mismatchPositions[i]! * 256 + d.mismatchBases[i]!
  const counts = new Map<number, number>()
  for (let i = 0; i < d.mismatchPositions.length; i++) {
    counts.set(key(i), (counts.get(key(i)) ?? 0) + 1)
  }
  return Array.from(d.mismatchPositions, (position, i) => {
    const bin = Math.floor((position - d.coverageStartPos) / d.coverageBinSize)
    const depth = d.coverageDepths[bin] ?? 0
    return depth > 0 ? Math.min(1, counts.get(key(i))! / depth) : 0
  })
}

function positionIn(refNames: readonly string[]): RefNamePosition {
  const position = new Map(refNames.map((name, i) => [name, i]))
  return refName => position.get(refName)
}

/** The display's per-base layer, from its `baseColor` and `modifications` objects. */
function baseLayerFor(conf: DisplayConf) {
  const base = conf.baseColor
  const mods = conf.modifications
  const settings: ModificationColorBy = {
    threshold: readConfObject(mods, 'threshold'),
    unmodified: readConfObject(mods, 'unmodified'),
    cytosineContext: readConfObject(mods, 'cytosineContext'),
    shownModifications: readConfObject(mods, 'shownModifications'),
  }
  return baseLayerOf(
    {
      field: readConfObject(base, 'field'),
      scale: readConfObject(base, 'scale'),
    },
    settings,
  )
}

/**
 * The display's color pipeline over its laid-out sections: the `color` object
 * resolved as the display resolves it, the worker's reads baked through one
 * scale and classified into the same buckets, each painted the color the
 * display paints it, and the key the display shows beside them.
 */
function colorReads(
  node: AnyConfigurationModel,
  baseLayer: BaseLayer | undefined,
  laidByGroup: ReadonlyMap<string, LaidOutPileupData>,
  facet: { field: string; domain?: readonly string[] } | undefined,
  refNamePosition: RefNamePosition | undefined,
) {
  const { labels, title, ...setting } = colorSnapshotOf(node)
  const encoding = alignmentsColorEncoding(setting)
  const colorBy = colorByOf(encoding)
  const band = pinnedInsertSizeBand(encoding)
  const byGroup = new Map(
    [...laidByGroup].map(([key, laid]) => [
      key,
      new Map([[0, band ? { ...laid, insertSizeStats: band } : laid]]),
    ]),
  )
  const bakedScale = isBakedScheme(colorBy)
    ? bakedColorScale(
        colorBy,
        encoding,
        refNamePosition,
        bakedColorExtent(encoding, colorBy, byGroup),
      )
    : undefined
  const colored = applyReadColorsByGroup(byGroup, {
    colorBy,
    bodyScheme: bodyColorScheme(colorBy, baseLayer),
    readColorOpts: {},
    bakedScale,
  })
  const palette = buildColorPaletteFromPalette(resolvePalette(), {
    declared: writtenReadCategoryColors(setting.value, encoding),
  })
  const sections = new Map(
    [...colored].map(([key, map]) => {
      const data = map.get(0)!
      const category: string[] = Array.from(
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
      return [key, { color, category }]
    }),
  )
  const declared = declaredReadLabels(encoding, labels ?? [])
  const presentTagValues = !isBakedScheme(colorBy)
    ? undefined
    : colorBy.type === 'mappingQuality'
      ? presentMapqs(colored)
      : collectAcrossGroups(colored, d => d.readTagValues)
  const detectedModifications = new Map(
    [...collectAcrossGroups(colored, d => d.detectedModifications)].map(
      type => [type, getColorForModification(type)],
    ),
  )
  const legend = getReadDisplayLegendItems({
    colorBy,
    baseLayer,
    detectedModifications,
    presentModifications: collectAcrossGroups(
      colored,
      d => d.modificationTypes,
    ),
    presentCategories: new Set(
      [...sections.values()].flatMap(s => s.category) as ReadColorCategory[],
    ),
    palette,
    presentTagValues,
    refNamePosition,
    bakedScale,
    sectionOrder: keySectionOrder(facet, colorBy),
    labels: declared,
    descending: withPreset(
      { ...setting, descending: readConfObject(node, 'descending') },
      ALIGNMENTS_FIELD_PRESETS,
    ).descending,
  }).filter(item => item.color !== undefined)
  const colorTitle = withPreset(
    { ...setting, title },
    ALIGNMENTS_FIELD_PRESETS,
  ).title
  const ramps = colorRampScales({
    colorBy,
    baseLayer,
    bakedScale,
    tagValueExtent: linearFieldExtent(encoding, colorBy, byGroup),
    baseQualityExtent:
      baseLayer?.type === 'perBaseQuality'
        ? baseQualitySpanAcrossGroups(byGroup).extent
        : undefined,
  })
  const readRamp = ramps.some(r => r.id === READS_RAMP_ID)
  return {
    sections,
    palette,
    declared,
    readField: colorFieldOf(colorBy),
    insertSizeBand: band,
    legend: {
      label: legend.map(item => item.label),
      color: legend.map(item => cssColorToHex(item.color!)),
    },
    legendTitle: (readRamp ? undefined : colorTitle) ?? 'Read colors',
    ramps: ramps.map(r =>
      rampKeyOf(
        r.id === READS_RAMP_ID && colorTitle !== undefined
          ? { ...r, title: colorTitle }
          : r,
      ),
    ),
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
function coverageStacks(d: WorkerPileupData) {
  const depthOf = (relDepth: number) => relDepth * d.coverageMaxDepth
  const alleles = readSnpSegments(d.snpPackedBuffer)
  const modifications = readModCovSegments(d.modCovPackedBuffer)
  return {
    alleleCoverage: {
      position: alleles.map(a => a.position),
      base: alleles.map(a => 'ACGTN'[a.colorType - 1] ?? 'N'),
      from: alleles.map(a => a.yOffset),
      to: alleles.map(a => a.yOffset + a.height),
      depth: alleles.map(a => depthOf(a.relDepth)),
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
function interbase(d: WorkerPileupData) {
  const insertions = {
    position: [] as number[],
    length: [] as number[],
    sequence: [] as string[],
    read: [] as number[],
    fade: [] as number[],
  }
  const clips = {
    position: [] as number[],
    length: [] as number[],
    type: [] as string[],
    read: [] as number[],
    fade: [] as number[],
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
    } else {
      clips.position.push(d.interbasePositions[i]!)
      clips.length.push(d.interbaseLengths[i]!)
      clips.type.push(type === INTERBASE_SOFTCLIP ? 'soft' : 'hard')
      clips.read.push(d.interbaseReadIndices[i]!)
      clips.fade.push(fade)
    }
  }
  return { insertions, clips }
}

/**
 * The splice junctions the reads' skips support, merged as the sashimi band
 * merges them: each once, with its supporting-read count, the strand its
 * reads' tags or its splice motif give it (0 where neither says), and the
 * motif where the reference was read. Every junction, down to a single
 * read; the display hides those under its `minSashimiScore`.
 */
function junctions(d: WorkerPileupData, refName: string) {
  const merged = [
    ...mergeJunctions([{ refName, data: d }], {
      minSashimiScore: 0,
      showNonCanonicalJunctions: true,
    }).values(),
  ].sort((a, b) => a.start - b.start || a.end - b.end)
  return {
    start: merged.map(j => j.start),
    end: merged.map(j => j.end),
    count: merged.map(j => j.count),
    strand: merged.map(j => j.strand),
    motif: merged.map(j => spliceMotifLabel(j.motif) ?? ''),
  }
}

const ARC_SHAPE_NAMES = ['arc', 'flat', 'flatSplit', 'unplaced'] as const
const DPR_PAST_THE_ANTIALIASING_FLOOR = Number.POSITIVE_INFINITY

/** One section's arcs and interchromosomal ticks, in the band's paint. */
function sectionConnections(
  a: ArcsUploadData,
  {
    slotColor,
    colorField,
    widthOf,
  }: {
    slotColor: string[]
    colorField: ArcColorField
    widthOf: (support: number) => number
  },
) {
  const n = a.numArcs
  const shape = Array.from(a.arcShapeTypes.subarray(0, n))
  const colorSlot = Array.from(a.arcColorTypes.subarray(0, n), arcColorSlot)
  const support = Array.from(a.arcSupport.subarray(0, n))
  const ticks = a.numArcLines
  return {
    arcs: {
      start: a.arcX1.subarray(0, n),
      end: a.arcX2.subarray(0, n),
      shape: shape.map(s => ARC_SHAPE_NAMES[s] ?? 'arc'),
      category: colorSlot.map(c => arcSlotCategory(c, colorField)),
      color: colorSlot.map(c => slotColor[c]!),
      opacity: shape.map(arcOpacity),
      y: a.arcYBp.subarray(0, n),
      span: a.arcSpanBp.subarray(0, n),
      support,
      width: support.map(widthOf),
    },
    arcTicks: {
      position: a.arcLinePositions.subarray(0, ticks),
      support: a.arcLineSupport.subarray(0, ticks),
      partners: a.arcLinePartnerRefNames
        .slice(0, ticks)
        .map(names => names.join(',')),
      color: new Array<string>(ticks).fill(slotColor[ARC_COLOR_INTERCHROM]!),
      width: Array.from(a.arcLineSupport.subarray(0, ticks), widthOf),
    },
  }
}

/**
 * The read-connection band the display draws under `readConnections`, from
 * the display's own arc pass over every section at once: each section's
 * mate-pair and split-read arcs, or the read cloud's bars, in the colors and
 * stroke widths the band paints them, its interchromosomal ticks, and the
 * band's key. `y` is where the band plots a connection, in bp: an arc's
 * genomic radius, or the read cloud's |TLEN| jittered as the display jitters
 * it so coincident pairs separate; `span` is the distance itself.
 */
function readConnectionTables(
  conf: DisplayConf,
  dataByGroup: ReadonlyMap<string, WorkerPileupData>,
  region: AlignmentTablesArgs['region'],
  colors: ReturnType<typeof colorReads>,
) {
  const mode: ReadConnectionsMode = readConfObject(conf, 'readConnections')
  const cloud = mode === 'cloud'
  const colorField = arcColorFieldOf(
    readConfObject(conf.arcColor, 'field'),
    colors.readField,
  )
  const regionInfo = { ...region, displayedRegionIndex: 0 }
  const result =
    mode === 'off'
      ? undefined
      : computeArcsByGroup(
          new Map(
            [...dataByGroup].map(([key, data]) => [key, new Map([[0, data]])]),
          ),
          { loaded: [regionInfo], displayed: [regionInfo] },
          {
            colorField,
            cloud,
            showInterchrom: readConfObject(conf, 'showInterchrom'),
            showLongRange: readConfObject(conf, 'showLongRange'),
            showOrdinaryPairs: ordinaryPairsShown(
              readConfObject(conf, 'showOrdinaryPairs'),
              cloud,
            ),
            minInterchromSupport: readConfObject(conf, 'minInterchromSupport'),
          },
        )
  const slotColor = buildArcColorPalette(colors.palette, colorField).map(
    normalizedRgbToHex,
  )
  const lineWidth: number = readConfObject(conf, 'readConnectionsLineWidth')
  const stroke = arcStrokeScale(lineWidth)
  const widthOf = (support: number) =>
    linkStrokeWidthPx(
      support,
      LINK_SIZE_SCALED,
      lineWidth,
      stroke.domain[0],
      stroke.domain[1],
      SCALE_TYPE_LOG,
      stroke.range[0],
      stroke.range[1],
      DPR_PAST_THE_ANTIALIASING_FLOOR,
    )
  const paint = { slotColor, colorField, widthOf }
  const bySection = new Map(
    [...dataByGroup.keys()].map(key => [
      key,
      sectionConnections(
        result?.byGroup.get(key)?.get(0) ?? emptyArcsUploadData(),
        paint,
      ),
    ]),
  )
  const legend = result
    ? getArcLegendItems(
        new Set(
          [...result.colorSlots].map(slot => arcSlotCategory(slot, colorField)),
        ),
        colors.palette,
        result.interchromFromMatePair,
        colors.declared.categories,
      ).filter(item => item.color !== undefined)
    : []
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
 * One section's reads as the alignments display draws them, as columns. Every
 * coordinate is 0-based genomic; `read` in the other tables is a 0-based index
 * into `reads`.
 */
function sectionTables(
  d: WorkerPileupData,
  readYs: ArrayLike<number>,
  colors: { color: string[]; category: string[] },
  refName: string,
  plainRead: string,
) {
  const [readStart, readEnd] = pairs(d.readPositions)
  const [gapStart, gapEnd] = pairs(d.gapPositions)
  const bin = d.coverageBinSize
  const n = d.coverageDepths.length
  const coverageStart = Float64Array.from(
    { length: n },
    (_, i) => d.coverageStartPos + i * bin,
  )
  return {
    reads: {
      start: readStart,
      end: readEnd,
      row: Array.from(readYs),
      strand: d.readStrands,
      mapq: d.readMapqs,
      flags: d.readFlags,
      name: readNames(d),
      insertSize: d.readInsertSizes,
      pairOrientation: Array.from(
        d.readPairOrientations,
        v => pairDirectionOfNum(v) ?? '',
      ),
      color: colors.color,
      category: colors.category,
    },
    mismatches: {
      position: d.mismatchPositions,
      base: Array.from(d.mismatchBases, b => BASE_OF_CODE[b] ?? 'N'),
      read: d.mismatchReadIndices,
      frequency: alleleFrequencies(d),
      fade: fades(d.mismatchFrequencies),
      quality: d.mismatchQuals,
    },
    gaps: {
      start: gapStart,
      end: gapEnd,
      type: Array.from(d.gapTypes, t => (t === GAP_SKIP ? 'skip' : 'deletion')),
      read: d.gapReadIndices,
      fade: fades(d.gapFrequencies),
    },
    coverage: {
      start: coverageStart,
      end: coverageStart.map(s => s + bin),
      depth: d.coverageDepths,
      forward: d.coverageFwdDepths,
      reverse: d.coverageRevDepths,
    },
    ...interbase(d),
    modifications: modifications(d),
    qualities: qualities(d, plainRead),
    ...coverageStacks(d),
    junctions: junctions(d, refName),
  }
}

/**
 * #api
 * A region's reads as the alignments display fetches, filters, lays out and
 * colors them, as tables: the worker's reads, mismatches, gaps, insertions,
 * clips, modifications, per-base qualities, coverage and splice junctions,
 * each read on the row the display's
 * pileup layout gives it and in the color the display's `color` object paints
 * it, with the key the display shows: `legend`, and `ramps`, its color bars
 * (`rampKeyOf`). Under a `facet` each section lays out
 * on its own, every row names its `section`, and `sections` lists them in
 * stacking order; ungrouped, there is one section, labelled `''`. For a host
 * that draws them itself, such as R through V8. The adapters must be
 * registered on `pluginManager` (`registerAlignmentsAdapters`).
 */
export async function alignmentTables(
  pluginManager: PluginManager,
  {
    adapterConfig,
    sequenceAdapter,
    region,
    display = {},
    refNames,
    byteLimit = DEFAULT_BYTE_LIMIT,
  }: AlignmentTablesArgs,
) {
  const conf: DisplayConf = displayConfigSchemaFactory(pluginManager).create({
    ...display,
    type: 'LinearAlignmentsDisplay',
    displayId: 'tables',
  })
  const colorBy = colorByOf(alignmentsColorEncoding(colorSettingOf(conf.color)))
  const baseLayer = baseLayerFor(conf)
  const { layoutOrder, sortColumn } = sortOf(
    conf.sort,
    refName => (refName === region.originalRefName ? region.refName : refName),
    region.refName,
  )
  const sortTag = sortColumn?.type === 'tag' ? sortColumn.tag : undefined
  if (readConfObject(conf, 'unit') === 'chain') {
    throw new Error(
      'unit: "chain" joins a read to its mates and split segments, which the tables do not serve yet; read the region with unit "read"',
    )
  }
  const showSoftClipping: boolean = readConfObject(conf, 'showSoftClipping')
  const facetNode = conf.facet
  const facetSetting = facetSettingOf({
    field: readConfObject(facetNode, 'field'),
    domain: readConfObject(facetNode, 'domain'),
  })
  const args: RpcExecuteArgs<'RenderAlignmentData'> = {
    sessionId: 'tables',
    adapterConfig,
    sequenceAdapter,
    regions: [{ assemblyName: '', ...region }],
    filterBy: readFilterOf(conf.filter),
    colorBy,
    baseLayer,
    sortTag,
    facet: workerFacet(facetSetting, 'read'),
    showSoftClipping,
    byteLimit,
    statusCallback: () => {},
  }
  const result = await executeRenderAlignmentData({ pluginManager, args })
  const where = `${region.refName}:${region.start}-${region.end}`
  if ('regionTooLarge' in result) {
    throw new Error(
      `${where} needs ${result.bytes} bytes of alignments, over the ${byteLimit}-byte limit; read a smaller region or raise byteLimit`,
    )
  }
  const order = orderedGroups(
    new Map([[0, result.value]]),
    new Set<string>(readConfObject(facetNode, 'hidden')),
    sectionOrder(facetSetting?.field ?? '', facetSetting?.domain),
  )
  if (!order.length) {
    throw new Error(
      `every section at ${where} is hidden; facet.hidden lists them all`,
    )
  }
  const dataOf = new Map(result.value.groups.map(g => [g.key, g.data]))
  const laidByGroup = new Map(
    order.map(({ key }) => [
      key,
      buildLaidOutPileupMap({
        dataMap: new Map([[0, dataOf.get(key)!]]),
        sortColumn,
        layoutOrder,
        showSoftClipping,
        regions: new Map([[0, region]]),
      }).get(0)!,
    ]),
  )
  const colors = colorReads(
    conf.color,
    baseLayer,
    laidByGroup,
    facetSetting,
    colorBy.type === 'mateRefName'
      ? positionIn(
          refNames ??
            (await (
              await getFeatureAdapterOrThrow({
                pluginManager,
                sessionId: 'tables',
                adapterConfig,
                sequenceAdapter,
              })
            ).getRefNames()),
        )
      : undefined,
  )
  const connections = readConnectionTables(
    conf,
    new Map(
      order.map(({ key }) => {
        const data = dataOf.get(key)!
        const band = colors.insertSizeBand
        return [key, band ? { ...data, insertSizeStats: band } : data]
      }),
    ),
    region,
    colors,
  )
  return {
    ...joinSections(
      order.map(({ key, label }) => ({
        label,
        tables: {
          ...sectionTables(
            dataOf.get(key)!,
            laidByGroup.get(key)!.readYs,
            colors.sections.get(key)!,
            region.refName,
            normalizedRgbToHex(colors.palette.readCategoryColors.plain),
          ),
          ...connections.bySection.get(key)!,
        },
      })),
      tables => tables.reads.start.length,
    ),
    sections: {
      key: order.map(g => g.key),
      label: order.map(g => g.label),
    },
    legend: colors.legend,
    legendTitle: colors.legendTitle,
    ramps: colors.ramps,
    arcLegend: connections.arcLegend,
    arcLegendTitle: connections.arcLegendTitle,
    arcSpanMax: connections.arcSpanMax,
    settings: Object.fromEntries(
      COMPOSING_SLOTS.map(slot => [slot, readConfObject(conf, slot)]),
    ) as Record<(typeof COMPOSING_SLOTS)[number], unknown>,
  }
}

/**
 * The display's slots that decide which bands a host stacks, what each
 * hides and how many pixels each takes, resolved, so a host composes the
 * track from the config it was read with rather than restating the defaults.
 */
const COMPOSING_SLOTS = [
  'showCoverage',
  'showPileup',
  'showMismatches',
  'showSashimiArcs',
  'minSashimiScore',
  'coverageSnpMinFrequency',
  'showNonCanonicalJunctions',
  'fadeLowFrequencyMismatches',
  'fadeLowQualityMismatches',
  'readConnections',
  'featureHeight',
  'coverageHeight',
  'sashimiArcsHeight',
  'readConnectionsHeight',
] as const

export type AlignmentTables = Awaited<ReturnType<typeof alignmentTables>>
