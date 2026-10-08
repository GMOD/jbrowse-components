import { makeRefChrFilter } from '../BgzipTaffyAdapter/taiIndex.ts'
import { makeSourceResolver } from './parseAssemblyName.ts'
import { readTaiSlice } from './taiSlice.ts'

import type { AlignmentRecord, EmptyRecord } from '../types.ts'
import type { MafBlockSink } from './mafBlockSink.ts'
import type { SourceResolver } from './parseAssemblyName.ts'
import type { TaiIndex } from './taiSlice.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { FileLocation, Region } from '@jbrowse/core/util'

/** What either `.tai` parser yields. `empties` is MAF's alone: TAF has no `e` line. */
export interface TaiBlockFeature {
  uniqueId: string
  /**
   * The reference row's unresolved source name (`hg38.chr1`). Carried so the
   * caller can drop a block belonging to another chromosome — the read reaches
   * past the queried contig's end by design, see `makeRefChrFilter`.
   */
  refSrc: string
  /** the row `refSrc` resolves to, where the sample set gives it one */
  refSampleId: string | undefined
  start: number
  end: number
  strand: number
  alignments: Record<string, AlignmentRecord>
  seq: string
  empties?: Record<string, EmptyRecord>
}

/**
 * The lines of a `.tai` slice that the byte range did not cut. A slice that
 * does not end on a newline had its last line truncated, and neither that line
 * nor the block holding it can be trusted: emitting the block puts a short
 * sequence at real coordinates. `endsClean` is false there, so a parser leaves
 * its open block unemitted.
 */
export function wholeLines(text: string) {
  const endsClean = text.endsWith('\n')
  const lines = text.split('\n')
  if (!endsClean) {
    lines.pop()
  }
  return { lines, endsClean }
}

/**
 * The whole of a `.tai`-indexed adapter's `readBlocks` except the parse. The
 * index describes bgzf virtual offsets against reference coordinates and does
 * not care which text format sits inside, so the parse is all that differs
 * between `BgzipMafAdapter` and `BgzipTaffyAdapter`.
 *
 * Overlapping the query span is not enough to keep a block: the read runs past
 * the chromosome's end by design, and a block of the next chromosome can
 * overlap numerically.
 */
export async function readTaiBlocks<SETUP extends TaiIndex>({
  configure,
  sampleIds,
  location,
  pluginManager,
  query,
  sink,
  opts,
  parse,
}: {
  configure: (opts?: BaseOptions) => Promise<SETUP>
  sampleIds: (opts?: BaseOptions) => Promise<Set<string> | undefined>
  location: FileLocation
  pluginManager?: PluginManager
  query: Region
  sink: MafBlockSink
  opts: BaseOptions | undefined
  parse: (
    slice: Uint8Array,
    setup: SETUP,
    resolve: SourceResolver,
  ) => Iterable<TaiBlockFeature>
}) {
  const { statusCallback, signal } = opts ?? {}
  const setup = await configure(opts)
  const resolver = makeSourceResolver(await sampleIds(opts))
  const onQueriedChr = makeRefChrFilter(query.refName)

  const slice = await readTaiSlice({
    index: setup.index,
    fileSize: setup.fileSize,
    refName: query.refName,
    start: query.start,
    end: query.end,
    location,
    pluginManager,
    statusCallback,
    signal,
  })
  if (!slice) {
    return
  }

  for (const block of parse(slice, setup, resolver.resolve)) {
    if (
      block.end > query.start &&
      block.start < query.end &&
      onQueriedChr(block.refSrc)
    ) {
      const { alignments, empties, seq } = block
      sink.startBlock(
        block.uniqueId,
        block.start,
        block.end,
        block.strand,
        seq,
        0,
        seq.length,
        block.refSampleId,
      )
      for (const sampleId in alignments) {
        const a = alignments[sampleId]!
        sink.addRow(
          sampleId,
          a.seq,
          0,
          a.seq.length,
          a.chr,
          a.srcStart,
          a.strand ?? 1,
          a.srcSize,
          a.context,
        )
      }
      for (const sampleId in empties) {
        sink.addEmpty(sampleId, empties[sampleId]!)
      }
    }
  }

  resolver.reportUnmatched()
}
