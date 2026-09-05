import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { makeRefChrFilter } from '../BgzipTaffyAdapter/taiIndex.ts'
import MafFeature from '../MafFeature.ts'
import { buildSampleFilter } from './getSamples.ts'
import { makeSourceResolver } from './parseAssemblyName.ts'
import { readTaiSlice } from './taiSlice.ts'

import type {
  AlignmentRecord,
  EmptyRecord,
  MafAdapterOptions,
} from '../types.ts'
import type { SourceResolver } from './parseAssemblyName.ts'
import type { TaiIndex } from './taiSlice.ts'
import type { Feature, FileLocation, Region } from '@jbrowse/core/util'

/**
 * What either `.tai` parser yields. `empties` is MAF's alone — TAF has no `e`
 * line — and `MafFeature` already defaults it to `{}`.
 */
export interface TaiBlockFeature {
  uniqueId: string
  /**
   * The reference row's unresolved source token (`hg38.chr1`). Carried so the
   * caller can drop a block belonging to another chromosome — the read reaches
   * past the queried contig's end by design, see `makeRefChrFilter`.
   */
  refSrc: string
  start: number
  end: number
  strand: number
  alignments: Record<string, AlignmentRecord>
  seq: string
  empties?: Record<string, EmptyRecord>
}

/**
 * The whole of a `.tai`-indexed adapter's `getFeatures` except the parse.
 *
 * `BgzipMafAdapter` and `BgzipTaffyAdapter` had the same eight steps written
 * out twice — resolve the setup, build the sample filter and the source
 * resolver, build the chromosome guard, read the slice, loop the parsed blocks
 * under one overlap test, emit a `MafFeature`, report the unmatched sources and
 * clear the status. The index describes bgzf virtual offsets against reference
 * coordinates and does not care which text format sits inside, so the parse is
 * the only thing that ever differed.
 *
 * The overlap test is the part worth having once: overlapping the query span is
 * *not* enough, because the read runs past the chromosome's end by design and a
 * block of the next chromosome can overlap numerically. Written twice, the
 * second copy is one `onQueriedChr` away from drawing another chromosome's
 * alignment at these coordinates, with nothing on screen saying so.
 */
export function taiBlockFeatures<SETUP extends TaiIndex>({
  configure,
  location,
  query,
  opts,
  parse,
}: {
  configure: (opts?: MafAdapterOptions) => Promise<SETUP>
  location: FileLocation
  query: Region
  opts: MafAdapterOptions | undefined
  parse: (
    slice: Uint8Array,
    setup: SETUP,
    resolve: SourceResolver,
  ) => Iterable<TaiBlockFeature>
}) {
  const { statusCallback } = opts ?? {}
  return ObservableCreate<Feature>(async observer => {
    const setup = await configure(opts)
    const resolver = makeSourceResolver(buildSampleFilter(opts))
    const onQueriedChr = makeRefChrFilter(query.refName)

    const slice = await readTaiSlice({
      index: setup.index,
      fileSize: setup.fileSize,
      refName: query.refName,
      start: query.start,
      end: query.end,
      location,
      statusCallback,
    })
    if (!slice) {
      observer.complete()
      return
    }

    for (const feat of parse(slice, setup, resolver.resolve)) {
      if (
        feat.end > query.start &&
        feat.start < query.end &&
        onQueriedChr(feat.refSrc)
      ) {
        observer.next(
          new MafFeature(
            feat.uniqueId,
            feat.start,
            feat.end,
            query.refName,
            feat.strand,
            feat.alignments,
            feat.seq,
            feat.empties,
          ),
        )
      }
    }

    resolver.reportUnmatched()
    statusCallback?.('')
    observer.complete()
    // The stop token, like the tabix and bigMaf adapters pass: without it a
    // cancelled fetch (any pan or zoom) kept delivering into a subscriber whose
    // result was already discarded, and the abort never reached the rxjs chain
    // at all. The body's own errors need no try/catch either — ObservableCreate
    // forwards a rejected promise to `observer.error`.
  }, opts?.stopToken)
}
