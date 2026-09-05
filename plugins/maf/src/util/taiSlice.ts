import { unzip } from '@gmod/bgzf-filehandle'
import { updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import {
  makeRefChrFilter,
  parseTaiIndex,
  queryBlockSpan,
} from '../BgzipTaffyAdapter/taiIndex.ts'
import MafFeature from '../MafFeature.ts'
import { buildSampleFilter } from './getSamples.ts'
import { makeSourceResolver } from './parseAssemblyName.ts'

import type { IndexData } from '../BgzipTaffyAdapter/types.ts'
import type {
  AlignmentRecord,
  EmptyRecord,
  MafAdapterOptions,
} from '../types.ts'
import type { SourceResolver } from './parseAssemblyName.ts'
import type {
  Feature,
  FileLocation,
  Region,
  StatusCallback,
} from '@jbrowse/core/util'

/** A parsed `.tai` plus the size of the bgzf file it indexes. */
export interface TaiIndex {
  index: IndexData
  /**
   * What bounds a read past the last chromosome's last sparse entry.
   * Undefined when the handle cannot report one — `RemoteFile.stat` answers 0
   * when CORS hides `Content-Range` — and that read falls back to one block.
   */
  fileSize: number | undefined
}

export async function readTaiIndex(
  taiLocation: FileLocation,
  gzLocation: FileLocation,
): Promise<TaiIndex> {
  const [text, { size }] = await Promise.all([
    openLocation(taiLocation).readFile('utf8'),
    openLocation(gzLocation).stat(),
  ])
  return { index: parseTaiIndex(text), fileSize: size > 0 ? size : undefined }
}

/**
 * Read the bytes a region occupies in a bgzf file carrying a Taffy `.tai`.
 *
 * Shared by the two adapters that read one — TAF and MAF — because the index
 * describes bgzf virtual offsets against reference coordinates and has no
 * opinion about the text inside. Only the parse of the returned bytes differs.
 *
 * Shared rather than copied specifically because of the trimming below.
 * `queryBlockSpan`'s own comment records two bugs from the read and the byte
 * estimate drifting apart, and a second copy of `!ranPastEnd && endBlock ===
 * startBlock && nextOffset > startOffset` is how a third would arrive: it is
 * four conditions with no obvious symptom when wrong, since a slice trimmed one
 * bracket short still parses and still draws.
 *
 * Returns undefined when the chromosome is not in the index — no span, nothing
 * to read.
 */
export async function readTaiSlice({
  index,
  fileSize,
  refName,
  start,
  end,
  location,
  statusCallback,
}: {
  index: IndexData
  fileSize?: number
  refName: string
  start: number
  end: number
  location: FileLocation
  statusCallback?: StatusCallback
}) {
  const span = queryBlockSpan(index, refName, start, end, fileSize)
  if (!span) {
    return undefined
  }
  const {
    firstEntry,
    nextEntry,
    ranPastEnd,
    startBlock,
    endBlock,
    readLength,
  } = span

  const file = openLocation(location)
  const buffer = await unzip(
    await updateStatus('Downloading alignments', statusCallback, () =>
      file.read(readLength, startBlock),
    ),
  )

  const startOffset = firstEntry.virtualOffset.dataPosition
  const nextOffset = nextEntry?.virtualOffset.dataPosition ?? 0
  // Trim to the cushion entry only for interior reads sharing the start block;
  // a past-the-end read keeps everything decoded to the chromosome end.
  const endOffset =
    !ranPastEnd && endBlock === startBlock && nextOffset > startOffset
      ? nextOffset
      : buffer.length

  // subarray (not slice) — TextDecoder.decode handles either, and subarray
  // avoids a Uint8Array copy of what can be a sizable chunk.
  return buffer.subarray(startOffset, endOffset)
}

/**
 * Byte budget for a region set from the `.tai` alone: exactly the `readLength`
 * {@link readTaiSlice} passes to `file.read`, through the same
 * `queryBlockSpan`. No block download. A chromosome absent from the index
 * resolves no span and so costs nothing, which is the only case reporting 0.
 */
export function taiRegionByteSize(
  { index, fileSize }: TaiIndex,
  regions: Region[],
) {
  let bytes = 0
  for (const region of regions) {
    const span = queryBlockSpan(
      index,
      region.refName,
      region.start,
      region.end,
      fileSize,
    )
    if (span) {
      bytes += span.readLength
    }
  }
  return bytes
}

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
