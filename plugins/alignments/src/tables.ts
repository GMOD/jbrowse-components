import {
  INDICATOR_TRIANGLE_H,
  INDICATOR_TRIANGLE_HW,
  computeCoverageTicks,
  computeVisibleCoverageDomain,
  computeVisibleCoverageStats,
  coverageDepthDomain,
  LABEL_FADE_FLOOR,
  LABEL_FADE_HI_RATIO,
  LABEL_FADE_LO_RATIO,
  MIN_HEIGHT_FOR_TEXT,
  interbaseEdgePx,
  labelFont,
  pairDirectionOfNum,
  readIdAt,
  readInterbaseSegments,
  readModCovSegments,
  readSnpSegments,
} from '@jbrowse/alignments-core'
import { fullConfSnapshot, readConfObject } from '@jbrowse/core/configuration'
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
import {
  getNiceDomain,
  resolveSymlogConstant,
  widenRangeToRules,
} from '@jbrowse/wiggle-core'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'

import BamAdapterF from './BamAdapter/index.ts'
import CramAdapterF from './CramAdapter/index.ts'
import { sortOf } from './LinearAlignmentsDisplay/alignmentsSortConfigSchema.ts'
import {
  bakedColorExtent,
  bakedColorScale,
  linearFieldExtent,
} from './LinearAlignmentsDisplay/bakedColorScale.ts'
import { attachChainFields } from './LinearAlignmentsDisplay/chainFields.ts'
import {
  READ_COLOR_CATEGORY_BY_INDEX,
  framesUnpairedChainStrand,
  readColorFromCategoryIndex,
} from './LinearAlignmentsDisplay/colorUtils.ts'
import { buildColorPaletteFromPalette } from './LinearAlignmentsDisplay/components/alignmentComponentUtils.ts'
import { buildLaidOutChainMap } from './LinearAlignmentsDisplay/computeChainLayout.ts'
import displayConfigSchemaFactory from './LinearAlignmentsDisplay/configSchema.ts'
import {
  applyChainStrandFrames,
  applyReadColorsByGroup,
  collectAcrossGroups,
} from './LinearAlignmentsDisplay/groupLayout.ts'
import { orderedGroups } from './LinearAlignmentsDisplay/groupedDataMaps.ts'
import { featureSpacingForHeight } from './LinearAlignmentsDisplay/menus/compactnessPresets.ts'
import {
  baseQualitySpanAcrossGroups,
  presentMapqs,
} from './LinearAlignmentsDisplay/qualitySpans.ts'
import { readFilterOf } from './LinearAlignmentsDisplay/readFilterConfigSchema.ts'
import { intronAlpha } from './LinearAlignmentsDisplay/renderers/rendererTypes.ts'
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
import { effectiveBaseColors } from './features/mismatch/baseColors.ts'
import {
  BASE_QUALITY_UNAVAILABLE,
  qualityAbgr,
} from './features/perBaseQuality/colors.ts'
import {
  sashimiArcHeightFraction,
  sashimiStrokeWidth,
} from './features/sashimi/bandFeed.ts'
import { mergeJunctions } from './features/sashimi/junctions.ts'
import {
  isNonCanonicalSpliceMotif,
  spliceMotifLabel,
} from './features/sashimi/motif.ts'
import { arcSlotCategory, buildArcColorPalette } from './shaders/palettes.ts'
import { CONNECTING_LINE_ALPHA } from './shaders/slang/connectingLine.consts.generated.ts'
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
import { paintsModifications } from './shared/colorSchemes.ts'
import { sectionOrder, workerFacet } from './shared/groupFeatures.ts'
import { joinSections } from './shared/joinSections.ts'
import { keySectionOrder } from './shared/keySectionOrder.ts'
import {
  READS_RAMP_ID,
  arcLegendTitle,
  colorRampScales,
  getArcLegendItems,
  getReadDisplayLegendItems,
  sashimiLegendItems,
} from './shared/legendUtils.ts'
import { getModificationName } from './shared/modificationData.ts'
import {
  INTERBASE_INSERTION,
  INTERBASE_SOFTCLIP,
  interbaseTypeName,
} from './shared/types.ts'
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
import type { ColorPalette } from './shaders/colors.ts'
import type {
  ArcColorField,
  BaseLayer,
  InterbaseTypeName,
  ModificationColorBy,
} from './shared/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { ValueScaleRuleConfig } from '@jbrowse/wiggle-core'

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
  /**
   * The most bp the region may span, refused before anything is fetched.
   * The coverage band holds every base of the span in memory whatever the
   * file holds, so a sparse file read across a whole contig is bounded here
   * rather than by `byteLimit`. 10 Mb by default.
   */
  spanLimit?: number
}

const DEFAULT_BYTE_LIMIT = 200_000_000
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

const BASES = ['A', 'C', 'G', 'T', 'N'] as const

const INTERBASE_LABELS: Record<InterbaseTypeName, string> = {
  insertion: 'Insertion',
  softclip: 'Soft clip',
  hardclip: 'Hard clip',
}

/**
 * The colors the display paints its per-base and coverage marks in, off its
 * palette: each base through `effectiveBaseColors`, so a modifications or
 * bisulfite layer mutes them, the interbase histogram in its band variants,
 * and a junction in its transcript strand's.
 */
function markColors(palette: ColorPalette, baseLayer: BaseLayer | undefined) {
  const muted = paintsModifications(baseLayer)
  const bases = effectiveBaseColors({
    colors: palette,
    showModifications: muted,
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
    junction: (strand: number) =>
      hex(
        strand === 1
          ? palette.colorFwdStrand
          : strand === -1
            ? palette.colorRevStrand
            : palette.colorPairLR,
      ),
  }
}

type MarkColors = ReturnType<typeof markColors>

/** What the display hides of the coverage band's stacks and the sashimi arcs. */
interface MarkThresholds {
  coverageSnpMinFrequency: number
  minSashimiScore: number
  showNonCanonicalJunctions: boolean
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
  readColorOpts: { chainMode?: boolean; framesChainStrand?: boolean },
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
    readColorOpts,
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
 * The splice junctions the reads' skips support, merged as the sashimi band
 * merges them: each once, with its supporting-read count, the strand its
 * reads' tags or its splice motif give it (0 where neither says), and the
 * motif where the reference was read. Every junction, down to a single
 * read, with `shown` false where the display's `minSashimiScore` or
 * `showNonCanonicalJunctions` hides it; a junction whose motif was never read
 * stays shown, as the display keeps it. `arcHeight` is the apex as a fraction
 * of the band and `strokeWidth` the stroke in px, the sashimi marks' own.
 */
function junctions(
  d: WorkerPileupData,
  refName: string,
  paint: MarkColors,
  thresholds: MarkThresholds,
) {
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
    color: merged.map(j => paint.junction(j.strand)),
    shown: merged.map(
      j =>
        j.count >= thresholds.minSashimiScore &&
        (thresholds.showNonCanonicalJunctions ||
          !isNonCanonicalSpliceMotif(j.motif)),
    ),
    arcHeight: merged.map(j =>
      sashimiArcHeightFraction(Math.abs(j.end - j.start)),
    ),
    strokeWidth: merged.map(j => sashimiStrokeWidth(j.count)),
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
 * The chains that join more than one read: the span of each, on the row its
 * reads share, with the hairline's color and opacity; and the spans where two
 * of a chain's reads both align, in the neutral the display fills them with.
 * Both are empty unless the display's unit is a chain.
 */
function chainTables(
  laid: LaidOutPileupData | undefined,
  color: string,
  overlapColor: string,
) {
  const [start, end] = pairs(laid?.connectingLinePositions ?? new Uint32Array())
  const [overlapStart, overlapEnd] = pairs(
    laid?.overlapPositions ?? new Uint32Array(),
  )
  return {
    chains: {
      start,
      end,
      row: Array.from(laid?.connectingLineYs ?? []),
      color: Array.from(start, () => color),
      opacity: Array.from(start, () => CONNECTING_LINE_ALPHA),
    },
    overlaps: {
      start: overlapStart,
      end: overlapEnd,
      row: Array.from(laid?.overlapYs ?? []),
      color: Array.from(overlapStart, () => overlapColor),
    },
  }
}

/**
 * Every lane's chain-laid reads with the strand frames the colors read: the
 * display settles which way "same strand" points across every chain on
 * screen, so the lanes go through together.
 */
function chainLaidOut(
  laidByGroup: Map<string, Map<number, LaidOutPileupData>>,
  framed: boolean,
) {
  const out = applyChainStrandFrames(laidByGroup, true, framed)
  return new Map([...out].map(([key, map]) => [key, map.get(0)!]))
}

/**
 * One section's reads as the alignments display draws them, as columns. Every
 * coordinate is 0-based genomic; `read` in the other tables is a 0-based index
 * into `reads`, which holds within one call. A read's `id` is the record's own
 * (`feature.id()`), the same in every call, where its `name` is shared by its
 * mate and its supplementary segments.
 */
function sectionTables(
  d: WorkerPileupData,
  readYs: ArrayLike<number>,
  colors: { color: string[]; category: string[] },
  region: { refName: string; start: number; end: number },
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
    ...coverageBand(d, region, paint, thresholds.coverageSnpMinFrequency),
    junctions: junctions(d, region.refName, paint, thresholds),
  }
}

/**
 * The coverage band's tables over the region alone. The worker counts depth
 * and stacks wherever its reads reach, which past the region's ends is a
 * partial count of the reads that also cross into it. A bin straddling an end
 * is cut at it.
 */
function coverageBand(
  d: WorkerPileupData,
  region: { start: number; end: number },
  paint: MarkColors,
  snpMinFrequency: number,
) {
  const bin = d.coverageBinSize
  const first = Math.max(
    0,
    Math.floor((region.start - d.coverageStartPos) / bin),
  )
  const last = Math.min(
    d.coverageDepths.length,
    Math.ceil((region.end - d.coverageStartPos) / bin),
  )
  const bins = Array.from(
    { length: Math.max(0, last - first) },
    (_, i) => first + i,
  )
  const binStart = (i: number) => d.coverageStartPos + i * bin
  const inside = (position: number) =>
    position >= region.start && position < region.end
  const stacks = {
    ...coverageStacks(d, paint, snpMinFrequency),
    ...interbaseStacks(d, paint),
  }
  return {
    coverage: {
      start: bins.map(i => Math.max(region.start, binStart(i))),
      end: bins.map(i => Math.min(region.end, binStart(i) + bin)),
      depth: bins.map(i => d.coverageDepths[i]!),
      forward: bins.map(i => d.coverageFwdDepths[i]!),
      reverse: bins.map(i => d.coverageRevDepths[i]!),
      color: bins.map(() => paint.coverage),
    },
    alleleCoverage: rowsWhere(stacks.alleleCoverage, inside),
    modificationCoverage: rowsWhere(stacks.modificationCoverage, inside),
    interbaseCoverage: rowsWhere(stacks.interbaseCoverage, inside),
    indicators: rowsWhere(stacks.indicators, inside),
  }
}

/** A table's rows whose `position` passes `keep`. */
function rowsWhere<T extends { position: ArrayLike<number> }>(
  table: T,
  keep: (position: number) => boolean,
) {
  const rows = Array.from(table.position, (p, i) => (keep(p) ? i : -1)).filter(
    i => i >= 0,
  )
  return Object.fromEntries(
    Object.entries(table).map(([name, column]) => [
      name,
      rows.map(i => (column as ArrayLike<unknown>)[i]),
    ]),
  ) as { [K in keyof T]: T[K] extends ArrayLike<infer V> ? V[] : never }
}

/**
 * The coverage band's depth axis as the display autoscales it: every shown
 * section's visible depths under `scales.y`'s quantile, rules and bounds,
 * nice-rounded, with a log scale floored at one read, and the ticks the
 * display labels it with at its height.
 */
function coverageScale(
  conf: DisplayConf,
  sections: WorkerPileupData[],
  region: { start: number; end: number },
) {
  const scale = conf.scales.y
  const type: string = readConfObject(scale, 'type')
  const zero: boolean = readConfObject(scale, 'zero')
  const entries = sections.map(data => ({
    visStart: Math.floor(region.start),
    visEnd: Math.ceil(region.end),
    data,
  }))
  const stats = computeVisibleCoverageStats(entries)
  const range =
    stats &&
    widenRangeToRules(
      computeVisibleCoverageDomain({
        stats,
        quantile: readConfObject(scale, 'domainQuantile'),
        entries,
      }),
      scale.rules.map((rule: ValueScaleRuleConfig) =>
        readConfObject(rule, 'value'),
      ),
    )
  const domain = coverageDepthDomain(
    range
      ? getNiceDomain({
          domain: range,
          bounds: [
            readConfObject(scale, 'domainMin') ?? (zero ? 0 : undefined),
            readConfObject(scale, 'domainMax'),
          ],
          scaleType: type,
          zero,
        })
      : [0, 0],
    type,
  )
  const symlogConstant: number = readConfObject(scale, 'symlogConstant')
  return {
    domain,
    type,
    symlogConstant: resolveSymlogConstant(domain[0], domain[1], symlogConstant),
    ticks: computeCoverageTicks(
      domain,
      readConfObject(conf, 'coverageHeight'),
      type,
      symlogConstant,
      readConfObject(scale, 'minimalTicks'),
    ).items.map(tick => tick.value),
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
    spanLimit = DEFAULT_SPAN_LIMIT,
  }: AlignmentTablesArgs,
) {
  const where = `${region.refName}:${region.start}-${region.end}`
  const span = region.end - region.start
  if (span > spanLimit) {
    throw new Error(
      `${where} spans ${span} bp of alignments, over the ${spanLimit}-bp limit; read a smaller region or raise spanLimit`,
    )
  }
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
  const chain = readConfObject(conf, 'unit') === 'chain'
  const featureHeight: number = readConfObject(conf, 'featureHeight')
  const showSoftClipping: boolean =
    !chain && readConfObject(conf, 'showSoftClipping')
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
    sortTag: chain ? undefined : sortTag,
    facet: workerFacet(facetSetting, chain ? 'chain' : 'read'),
    showSoftClipping,
    byteLimit,
    statusCallback: () => {},
  }
  const run = async (facet: typeof args.facet) => {
    const result = await executeRenderAlignmentData({
      pluginManager,
      args: { ...args, facet },
    })
    if ('regionTooLarge' in result) {
      throw new Error(
        `${where} needs ${result.bytes} bytes of alignments, over the ${byteLimit}-byte limit; read a smaller region or raise byteLimit`,
      )
    }
    return result.value
  }
  const faceted = await run(args.facet)
  const noReads = !faceted.groups.length
  // a facet partitions no reads into no sections; the region still has one
  const fetched = noReads ? await run(undefined) : faceted
  const order = orderedGroups(
    new Map([[0, fetched]]),
    noReads ? undefined : new Set<string>(readConfObject(facetNode, 'hidden')),
    sectionOrder(facetSetting?.field ?? '', facetSetting?.domain),
  )
  if (!order.length) {
    throw new Error(
      `every section at ${where} is hidden; facet.hidden lists them all`,
    )
  }
  const dataOf = new Map(fetched.groups.map(g => [g.key, g.data]))
  const regions = new Map([[0, region]])
  const chained = chain
    ? attachChainFields(
        new Map(
          order.map(({ key }) => [key, new Map([[0, dataOf.get(key)!]])]),
        ),
      )
    : undefined
  const dataFor = (key: string) =>
    chained ? chained.get(key)!.get(0)! : dataOf.get(key)!
  const framesChainStrand = framesUnpairedChainStrand(
    bodyColorScheme(colorBy, baseLayer),
    chain,
  )
  const laidByGroup = chain
    ? chainLaidOut(
        new Map(
          order.map(({ key }) => [
            key,
            buildLaidOutChainMap({ dataMap: chained!.get(key)!, regions }),
          ]),
        ),
        framesChainStrand,
      )
    : new Map(
        order.map(({ key }) => [
          key,
          buildLaidOutPileupMap({
            dataMap: new Map([[0, dataOf.get(key)!]]),
            sortColumn,
            layoutOrder,
            showSoftClipping,
            regions,
          }).get(0)!,
        ]),
      )
  const colors = colorReads(
    conf.color,
    baseLayer,
    laidByGroup,
    chain ? { chainMode: true, framesChainStrand } : {},
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
  const paint = markColors(colors.palette, baseLayer)
  const thresholds: MarkThresholds = {
    coverageSnpMinFrequency: readConfObject(conf, 'coverageSnpMinFrequency'),
    minSashimiScore: readConfObject(conf, 'minSashimiScore'),
    showNonCanonicalJunctions: readConfObject(
      conf,
      'showNonCanonicalJunctions',
    ),
  }
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
  const tables = drawnBands(
    conf,
    joinSections(
      order.map(({ key, label }) => ({
        label,
        tables: {
          ...chainTables(
            chain ? laidByGroup.get(key) : undefined,
            normalizedRgbToHex(colors.palette.colorConnectingLine),
            normalizedRgbToHex(colors.palette.colorOverlap),
          ),
          ...sectionTables(
            dataFor(key),
            laidByGroup.get(key)!.readYs,
            colors.sections.get(key)!,
            region,
            normalizedRgbToHex(colors.palette.readCategoryColors.plain),
            paint,
            thresholds,
          ),
          ...connections.bySection.get(key)!,
        },
      })),
      tables => tables.reads.start.length,
    ),
  )
  return {
    ...tables,
    ...markLegends(tables, paint),
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
    coverageScale: coverageScale(
      conf,
      order.map(({ key }) => dataOf.get(key)!),
      region,
    ),
    glyph: {
      intronAlpha: intronAlpha(featureHeight),
      label: {
        minHeight: MIN_HEIGHT_FOR_TEXT,
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
    settings: Object.fromEntries(
      COMPOSING_SLOTS.map(slot => [slot, readConfObject(conf, slot)]),
    ) as Record<(typeof COMPOSING_SLOTS)[number], unknown>,
    readPitch: {
      featureHeight,
      featureSpacing: featureSpacingForHeight(featureHeight),
    },
    config: fullConfSnapshot(conf),
  }
}

/**
 * The keys of the marks the reads' own `legend` leaves out, each over what the
 * tables paint: the bases (none while a modifications layer mutes them), the
 * junction strands of the junctions shown, as the sashimi band keys them, and
 * the interbase histogram's events.
 */
function markLegends(
  tables: {
    mismatches: { base: string[] }
    alleleCoverage: { base: string[] }
    junctions: { strand: number[]; shown: boolean[] }
    interbaseCoverage: { type: InterbaseTypeName[] }
    indicators: { type: InterbaseTypeName[] }
  },
  paint: MarkColors,
) {
  const bases = new Set([
    ...tables.mismatches.base,
    ...tables.alleleCoverage.base,
  ])
  const keyedBases = paint.muted ? [] : BASES.filter(b => bases.has(b))
  const junctionKey = sashimiLegendItems(
    new Set(
      tables.junctions.strand.filter((_, i) => tables.junctions.shown[i]),
    ),
    resolvePalette().alignmentFill,
  )
  const events = new Set([
    ...tables.interbaseCoverage.type,
    ...tables.indicators.type,
  ])
  const keyedEvents = (
    Object.keys(INTERBASE_LABELS) as InterbaseTypeName[]
  ).filter(t => events.has(t))
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
    junctionLegendTitle: 'Splice junctions',
    interbaseLegend: {
      label: keyedEvents.map(t => INTERBASE_LABELS[t]),
      color: keyedEvents.map(t => paint.interbase[t]),
    },
    interbaseLegendTitle: 'Insertions and clips',
  }
}

/**
 * The tables each `show*` slot turns off with its band, as the display then
 * draws none of them.
 */
const BAND_TABLES = {
  showPileup: [
    'reads',
    'mismatches',
    'gaps',
    'insertions',
    'clips',
    'modifications',
    'qualities',
    'chains',
    'overlaps',
  ],
  showMismatches: ['mismatches'],
  showCoverage: [
    'coverage',
    'alleleCoverage',
    'modificationCoverage',
    'interbaseCoverage',
    'indicators',
  ],
  showInterbaseIndicators: ['interbaseCoverage', 'indicators'],
  showSashimiArcs: ['junctions'],
} as const

/** The tables, each of a band the display does not draw left empty. */
function drawnBands<T extends Record<string, Record<string, unknown[]>>>(
  conf: DisplayConf,
  tables: T,
) {
  const hidden = new Set<string>(
    (Object.keys(BAND_TABLES) as (keyof typeof BAND_TABLES)[]).flatMap(slot =>
      readConfObject(conf, slot) ? [] : BAND_TABLES[slot],
    ),
  )
  return Object.fromEntries(
    Object.entries(tables).map(([name, table]) => [
      name,
      hidden.has(name)
        ? Object.fromEntries(Object.keys(table).map(column => [column, []]))
        : table,
    ]),
  ) as T
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
  'showInterbaseIndicators',
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
