import { pairDirectionOfNum } from '@jbrowse/alignments-core'

import BamAdapterF from './BamAdapter/index.ts'
import CramAdapterF from './CramAdapter/index.ts'
import { executeRenderAlignmentData } from './RenderAlignmentDataRPC/executeRenderAlignmentData.ts'
import { buildLaidOutPileupMap } from './RenderAlignmentDataRPC/sortLayout.ts'
import { GAP_SKIP } from './shaders/slang/gap.consts.generated.ts'

import type { WorkerPileupData } from './RenderAlignmentDataRPC/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

/** Registers the adapters `alignmentTables` reads through, BAM and CRAM. */
export function registerAlignmentsAdapters(pluginManager: PluginManager) {
  BamAdapterF(pluginManager)
  CramAdapterF(pluginManager)
}

export interface AlignmentTablesArgs {
  adapterConfig: Record<string, unknown>
  /** The assembly's sequence adapter, for CRAM and for reads without MD. */
  sequenceAdapter?: Record<string, unknown>
  region: { refName: string; start: number; end: number }
  filterBy?: RpcExecuteArgs<'RenderAlignmentData'>['filterBy']
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

/**
 * One section's reads as the alignments display draws them, as columns. Every
 * coordinate is 0-based genomic; `read` in the other tables is a 0-based index
 * into `reads`.
 */
function sectionTables(d: WorkerPileupData, readYs: ArrayLike<number>) {
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
  }
}

export type AlignmentTables = ReturnType<typeof sectionTables>

/**
 * #api
 * A region's reads as the alignments display fetches and lays them out, as
 * tables: the worker's reads, mismatches, gaps and coverage, each read placed
 * on the row the display's pileup layout gives it. For a host that draws them
 * itself, such as R through V8. The adapters must be registered on
 * `pluginManager` (`registerAlignmentsAdapters`).
 */
export async function alignmentTables(
  pluginManager: PluginManager,
  {
    adapterConfig,
    sequenceAdapter,
    region,
    filterBy,
    byteLimit = DEFAULT_BYTE_LIMIT,
  }: AlignmentTablesArgs,
): Promise<AlignmentTables> {
  const args: RpcExecuteArgs<'RenderAlignmentData'> = {
    sessionId: 'tables',
    adapterConfig,
    sequenceAdapter,
    regions: [{ assemblyName: '', ...region }],
    filterBy,
    colorBy: { type: 'normal' },
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
  return sectionTables(data, laid.readYs)
}
