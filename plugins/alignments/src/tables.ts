import {
  pairDirectionOfNum,
  readModCovSegments,
  readSnpSegments,
} from '@jbrowse/alignments-core'
import { readConfObject } from '@jbrowse/core/configuration'
import { isSequenceAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import {
  abgrAlpha,
  abgrBlue,
  abgrGreen,
  abgrRed,
} from '@jbrowse/core/util/colorBits'
import { withPreset } from '@jbrowse/core/util/colorScale'
import { colorSnapshotOf } from '@jbrowse/display-kit/colorConfigSchema'
import { facetSettingOf } from '@jbrowse/display-kit/facetConfigSchema'
import { sectionFacetConfigSchema } from '@jbrowse/display-kit/sectionFacetConfigSchema'

import BamAdapterF from './BamAdapter/index.ts'
import CramAdapterF from './CramAdapter/index.ts'
import { alignmentsBaseColorConfigSchema } from './LinearAlignmentsDisplay/alignmentsBaseColorConfigSchema.ts'
import { alignmentsColorConfigSchema } from './LinearAlignmentsDisplay/alignmentsColorConfigSchema.ts'
import { alignmentsModificationsConfigSchema } from './LinearAlignmentsDisplay/alignmentsModificationsConfigSchema.ts'
import { alignmentsSortConfigSchema } from './LinearAlignmentsDisplay/alignmentsSortConfigSchema.ts'
import {
  bakedColorExtent,
  bakedColorScale,
} from './LinearAlignmentsDisplay/bakedColorScale.ts'
import {
  READ_COLOR_CATEGORY_BY_INDEX,
  readColorFromCategoryIndex,
} from './LinearAlignmentsDisplay/colorUtils.ts'
import { buildColorPaletteFromPalette } from './LinearAlignmentsDisplay/components/alignmentComponentUtils.ts'
import {
  applyReadColorsByGroup,
  collectAcrossGroups,
} from './LinearAlignmentsDisplay/groupLayout.ts'
import { orderedGroups } from './LinearAlignmentsDisplay/groupedDataMaps.ts'
import { presentMapqs } from './LinearAlignmentsDisplay/qualitySpans.ts'
import {
  readFilterConfigSchema,
  readFilterOf,
} from './LinearAlignmentsDisplay/readFilterConfigSchema.ts'
import { executeRenderAlignmentData } from './RenderAlignmentDataRPC/executeRenderAlignmentData.ts'
import { buildLaidOutPileupMap } from './RenderAlignmentDataRPC/sortLayout.ts'
import { mergeJunctions } from './features/sashimi/junctions.ts'
import { spliceMotifLabel } from './features/sashimi/motif.ts'
import { GAP_SKIP } from './shaders/slang/gap.consts.generated.ts'
import {
  ALIGNMENTS_FIELD_PRESETS,
  alignmentsColorEncoding,
  baseLayerOf,
  bodyColorScheme,
  colorByOf,
  declaredReadLabels,
  isBakedScheme,
  pinnedInsertSizeBand,
  writtenReadCategoryColors,
} from './shared/alignmentsColor.ts'
import { sectionOrder, workerFacet } from './shared/groupFeatures.ts'
import { getReadDisplayLegendItems } from './shared/legendUtils.ts'
import { getModificationName } from './shared/modificationData.ts'
import {
  INTERBASE_INSERTION,
  INTERBASE_SOFTCLIP,
  isLayoutOrder,
} from './shared/types.ts'
import { getColorForModification } from './util.ts'

import type { ReadColorCategory } from './LinearAlignmentsDisplay/colorUtils.ts'
import type {
  LaidOutPileupData,
  WorkerPileupData,
} from './RenderAlignmentDataRPC/types.ts'
import type {
  BaseLayer,
  ModificationColorBy,
  SortColumn,
  SortType,
} from './shared/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

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
  /** The display's `color` object, as a config writes it; unset reads plain. */
  color?: SnapshotIn<typeof alignmentsColorConfigSchema>
  /** The display's `filter` object, as a config writes it. */
  filter?: SnapshotIn<typeof readFilterConfigSchema>
  /**
   * The display's `baseColor` object: the per-base layer painted over the
   * reads, `{ field: 'modifications' }` for the reads' base modifications.
   */
  baseColor?: SnapshotIn<typeof alignmentsBaseColorConfigSchema>
  /** The display's `modifications` object, the settings that layer reads. */
  modifications?: SnapshotIn<typeof alignmentsModificationsConfigSchema>
  /**
   * The display's `sort` object: a whole-window order (`position`, `length`,
   * `spliced`, `split`), or a column sort (`strand`, `basePair`, `tag`,
   * `insertion`, `softclip`, `hardclip`) over `pos`, on the region's contig
   * where `refName` is left out, ranking by `tag` under `tag`.
   */
  sort?: SnapshotIn<typeof alignmentsSortConfigSchema>
  /**
   * The display's `facet` object: the field that splits the reads into
   * stacked sections, the `domain` they stack in, and the sections `hidden`.
   */
  facet?: SnapshotIn<typeof sectionFacetConfigSchema>
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

function hex(n: number) {
  return n.toString(16).padStart(2, '0')
}

/** A CSS color as the palette and the bake spell them, as `#rrggbb`. */
function hexOf(css: string) {
  if (css.startsWith('#')) {
    return css.length === 4
      ? `#${css[1]}${css[1]}${css[2]}${css[2]}${css[3]}${css[3]}`
      : css.slice(0, 7)
  }
  const [r, g, b] = css
    .slice(css.indexOf('(') + 1, css.indexOf(')'))
    .split(',')
    .map(Number)
  return `#${hex(r!)}${hex(g!)}${hex(b!)}`
}

/**
 * The display's color pipeline over one laid-out section: the `color` object
 * resolved as the display resolves it, the worker's reads baked through the
 * same scale and classified into the same buckets, each painted the color the
 * display paints it, and the key the display shows beside them.
 */
/** The display's `sort` object as the layout and the worker read it. */
function sortFor(sort: AlignmentTablesArgs['sort'], refName: string) {
  const node = alignmentsSortConfigSchema.create(sort ?? {})
  const type: SortType = readConfObject(node, 'type')
  const pos: number | undefined = readConfObject(node, 'pos')
  const column: SortColumn | undefined =
    isLayoutOrder(type) || pos === undefined
      ? undefined
      : {
          type,
          pos,
          refName: readConfObject(node, 'refName') ?? refName,
          tag: readConfObject(node, 'tag'),
        }
  return {
    layoutOrder: isLayoutOrder(type) ? type : undefined,
    sortColumn: column,
    sortTag: column?.type === 'tag' ? column.tag : undefined,
  }
}

/** The display's per-base layer, from its `baseColor` and `modifications` objects. */
function baseLayerFor({
  baseColor,
  modifications,
}: Pick<AlignmentTablesArgs, 'baseColor' | 'modifications'>) {
  const base = alignmentsBaseColorConfigSchema.create(baseColor ?? {})
  const mods = alignmentsModificationsConfigSchema.create(modifications ?? {})
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

function colorReads(
  colorSnapshot: AlignmentTablesArgs['color'],
  baseLayer: BaseLayer | undefined,
  laidByGroup: ReadonlyMap<string, LaidOutPileupData>,
) {
  const node = alignmentsColorConfigSchema.create(colorSnapshot ?? {})
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
        undefined,
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
        hexOf(
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
    bakedScale,
    labels: declaredReadLabels(encoding, labels ?? []),
    descending: withPreset(
      { ...setting, descending: readConfObject(node, 'descending') },
      ALIGNMENTS_FIELD_PRESETS,
    ).descending,
  }).filter(item => item.color !== undefined)
  return {
    sections,
    legend: {
      label: legend.map(item => item.label),
      color: legend.map(item => hexOf(item.color!)),
    },
    legendTitle:
      withPreset({ ...setting, title }, ALIGNMENTS_FIELD_PRESETS).title ??
      'Read colors',
  }
}

/**
 * The insertions on the reads and the clips at their ends, which the worker
 * ships as one interbase list: an insertion with its length and, where the
 * reader kept it, its sequence; a clip with its length and whether the clipped
 * bases are in the file (`soft`) or not (`hard`).
 */
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
    color: Array.from(
      d.modificationColors,
      c => `#${hex(abgrRed(c))}${hex(abgrGreen(c))}${hex(abgrBlue(c))}`,
    ),
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
      color: modifications.map(
        m =>
          `#${hex(abgrRed(m.packedColor))}${hex(abgrGreen(m.packedColor))}${hex(abgrBlue(m.packedColor))}`,
      ),
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
    ...coverageStacks(d),
    junctions: junctions(d, refName),
  }
}

type SectionTables = ReturnType<typeof sectionTables>

/**
 * The sections' tables as one set, each row naming its `section` and each
 * `read` column offset to index the joined `reads`.
 */
function joinSections(sections: { label: string; tables: SectionTables }[]) {
  const joined: Record<string, Record<string, unknown[]>> = {}
  let readOffset = 0
  for (const { label, tables } of sections) {
    for (const [name, table] of Object.entries(tables)) {
      const out = (joined[name] ??= { section: [] })
      let rows = 0
      for (const [column, values] of Object.entries(table)) {
        const list = Array.from(values as ArrayLike<unknown>)
        rows = list.length
        ;(out[column] ??= []).push(
          ...(column === 'read'
            ? list.map(r => (r as number) + readOffset)
            : list),
        )
      }
      out.section!.push(...new Array<string>(rows).fill(label))
    }
    readOffset += tables.reads.start.length
  }
  return joined as {
    [K in keyof SectionTables]: {
      [C in keyof SectionTables[K]]: SectionTables[K][C] extends ArrayLike<
        infer V
      >
        ? V[]
        : never
    } & { section: string[] }
  }
}

/**
 * #api
 * A region's reads as the alignments display fetches, filters, lays out and
 * colors them, as tables: the worker's reads, mismatches, gaps, insertions,
 * clips, coverage and splice junctions, each read on the row the display's
 * pileup layout gives it and in the color the display's `color` object paints
 * it, with the key the display shows. Under a `facet` each section lays out
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
    color,
    filter,
    baseColor,
    modifications,
    sort,
    facet,
    byteLimit = DEFAULT_BYTE_LIMIT,
  }: AlignmentTablesArgs,
) {
  const colorBy = colorByOf(
    alignmentsColorEncoding(
      colorSnapshotOf(alignmentsColorConfigSchema.create(color ?? {})),
    ),
  )
  const baseLayer = baseLayerFor({ baseColor, modifications })
  const { layoutOrder, sortColumn, sortTag } = sortFor(sort, region.refName)
  const facetNode = sectionFacetConfigSchema.create(facet ?? {})
  const facetSetting = facetSettingOf({
    field: readConfObject(facetNode, 'field'),
    domain: readConfObject(facetNode, 'domain'),
  })
  const args: RpcExecuteArgs<'RenderAlignmentData'> = {
    sessionId: 'tables',
    adapterConfig,
    sequenceAdapter,
    regions: [{ assemblyName: '', ...region }],
    filterBy: readFilterOf(readFilterConfigSchema.create(filter ?? {})),
    colorBy,
    baseLayer,
    sortTag,
    facet: workerFacet(facetSetting, 'read'),
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
    throw new Error(`no reads came back for ${where}`)
  }
  const dataOf = new Map(result.value.groups.map(g => [g.key, g.data]))
  const laidByGroup = new Map(
    order.map(({ key }) => [
      key,
      buildLaidOutPileupMap({
        dataMap: new Map([[0, dataOf.get(key)!]]),
        sortColumn,
        layoutOrder,
        showSoftClipping: false,
        regions: new Map([[0, region]]),
      }).get(0)!,
    ]),
  )
  const colors = colorReads(color, baseLayer, laidByGroup)
  return {
    ...joinSections(
      order.map(({ key, label }) => ({
        label,
        tables: sectionTables(
          dataOf.get(key)!,
          laidByGroup.get(key)!.readYs,
          colors.sections.get(key)!,
          region.refName,
        ),
      })),
    ),
    sections: {
      key: order.map(g => g.key),
      label: order.map(g => g.label),
    },
    legend: colors.legend,
    legendTitle: colors.legendTitle,
  }
}

export type AlignmentTables = Awaited<ReturnType<typeof alignmentTables>>
