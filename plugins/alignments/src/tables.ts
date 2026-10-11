import { pairDirectionOfNum } from '@jbrowse/alignments-core'
import { readConfObject } from '@jbrowse/core/configuration'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { withPreset } from '@jbrowse/core/util/colorScale'
import { colorSnapshotOf } from '@jbrowse/display-kit/colorConfigSchema'

import BamAdapterF from './BamAdapter/index.ts'
import CramAdapterF from './CramAdapter/index.ts'
import { alignmentsColorConfigSchema } from './LinearAlignmentsDisplay/alignmentsColorConfigSchema.ts'
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
import { presentMapqs } from './LinearAlignmentsDisplay/qualitySpans.ts'
import {
  readFilterConfigSchema,
  readFilterOf,
} from './LinearAlignmentsDisplay/readFilterConfigSchema.ts'
import { executeRenderAlignmentData } from './RenderAlignmentDataRPC/executeRenderAlignmentData.ts'
import { buildLaidOutPileupMap } from './RenderAlignmentDataRPC/sortLayout.ts'
import { GAP_SKIP } from './shaders/slang/gap.consts.generated.ts'
import {
  ALIGNMENTS_FIELD_PRESETS,
  alignmentsColorEncoding,
  bodyColorScheme,
  colorByOf,
  declaredReadLabels,
  isBakedScheme,
  pinnedInsertSizeBand,
  writtenReadCategoryColors,
} from './shared/alignmentsColor.ts'
import { getReadDisplayLegendItems } from './shared/legendUtils.ts'

import type { ReadColorCategory } from './LinearAlignmentsDisplay/colorUtils.ts'
import type {
  LaidOutPileupData,
  WorkerPileupData,
} from './RenderAlignmentDataRPC/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

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
function colorReads(
  colorSnapshot: AlignmentTablesArgs['color'],
  laid: LaidOutPileupData,
) {
  const node = alignmentsColorConfigSchema.create(colorSnapshot ?? {})
  const { labels, title, ...setting } = colorSnapshotOf(node)
  const encoding = alignmentsColorEncoding(setting)
  const colorBy = colorByOf(encoding)
  const band = pinnedInsertSizeBand(encoding)
  const byGroup = new Map([
    ['', new Map([[0, band ? { ...laid, insertSizeStats: band } : laid]])],
  ])
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
    bodyScheme: bodyColorScheme(colorBy, undefined),
    readColorOpts: {},
    bakedScale,
  })
  const data = colored.get('')!.get(0)!
  const palette = buildColorPaletteFromPalette(resolvePalette(), {
    declared: writtenReadCategoryColors(setting.value, encoding),
  })
  const category: string[] = Array.from(
    data.readColorCategories,
    i => READ_COLOR_CATEGORY_BY_INDEX[i]!,
  )
  const presentTagValues = !isBakedScheme(colorBy)
    ? undefined
    : colorBy.type === 'mappingQuality'
      ? presentMapqs(colored)
      : collectAcrossGroups(colored, d => d.readTagValues)
  const legend = getReadDisplayLegendItems({
    colorBy,
    presentCategories: new Set(category as ReadColorCategory[]),
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
    color: category.map((_, i) =>
      hexOf(
        readColorFromCategoryIndex(
          data.readColorCategories[i]!,
          i,
          data,
          palette,
        ),
      ),
    ),
    category,
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
 * One section's reads as the alignments display draws them, as columns. Every
 * coordinate is 0-based genomic; `read` in the other tables is a 0-based index
 * into `reads`.
 */
function sectionTables(
  d: WorkerPileupData,
  readYs: ArrayLike<number>,
  colors: ReturnType<typeof colorReads>,
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
      quality: d.mismatchQuals,
    },
    gaps: {
      start: gapStart,
      end: gapEnd,
      type: Array.from(d.gapTypes, t => (t === GAP_SKIP ? 'skip' : 'deletion')),
      read: d.gapReadIndices,
    },
    coverage: {
      start: coverageStart,
      end: coverageStart.map(s => s + bin),
      depth: d.coverageDepths,
      forward: d.coverageFwdDepths,
      reverse: d.coverageRevDepths,
    },
    legend: colors.legend,
    legendTitle: colors.legendTitle,
  }
}

export type AlignmentTables = ReturnType<typeof sectionTables>

/**
 * #api
 * A region's reads as the alignments display fetches, filters, lays out and
 * colors them, as tables: the worker's reads, mismatches, gaps and coverage,
 * each read on the row the display's pileup layout gives it and in the color
 * the display's `color` object paints it, with the key the display shows. For
 * a host that draws them itself, such as R through V8. The adapters must be
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
    byteLimit = DEFAULT_BYTE_LIMIT,
  }: AlignmentTablesArgs,
): Promise<AlignmentTables> {
  const colorBy = colorByOf(
    alignmentsColorEncoding(
      colorSnapshotOf(alignmentsColorConfigSchema.create(color ?? {})),
    ),
  )
  const args: RpcExecuteArgs<'RenderAlignmentData'> = {
    sessionId: 'tables',
    adapterConfig,
    sequenceAdapter,
    regions: [{ assemblyName: '', ...region }],
    filterBy: readFilterOf(readFilterConfigSchema.create(filter ?? {})),
    colorBy,
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
  const data = result.value.groups[0]?.data
  if (!data) {
    throw new Error(`no reads came back for ${where}`)
  }
  const laid = buildLaidOutPileupMap({
    dataMap: new Map([[0, data]]),
    sortColumn: undefined,
    showSoftClipping: false,
    regions: new Map([[0, region]]),
  }).get(0)!
  return sectionTables(data, laid.readYs, colorReads(color, laid))
}
