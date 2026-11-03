import { scanBgzfBlocks, unzip } from '@gmod/bgzf-filehandle'
import { getFileName, updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import { NEWLINE, byteOffsetsOf } from './taiBlocks.ts'
import { lowerBound, parseTaiIndex, queryBlockSpan } from './taiIndex.ts'

import type { ByteRange, IndexData } from './taiIndex.ts'
import type { BgzfBlockInfo } from '@gmod/bgzf-filehandle'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { FileLocation, Region, StatusCallback } from '@jbrowse/core/util'

/** A parsed `.tai` */
export interface TaiIndex {
  index: IndexData
}

export interface TaiSlice {
  text: string
  blockIdAt: (textOffset: number) => string
}

export async function readTaiIndex(
  taiLocation: FileLocation,
  pluginManager?: PluginManager,
  signal?: AbortSignal,
): Promise<TaiIndex> {
  const text = await openLocation(taiLocation, pluginManager).readFile({
    encoding: 'utf8',
    signal,
  })
  return { index: parseTaiIndex(text) }
}

/**
 * Read from `start` to the end of the file, `first` bytes and then twice as
 * many each time, until a read comes back short.
 */
export async function readToEnd(
  file: ReturnType<typeof openLocation>,
  start: number,
  first: number,
  signal?: AbortSignal,
) {
  const parts: Uint8Array[] = []
  let at = start
  let step = first
  for (;;) {
    const bytes = await file.read(step, at, { signal })
    parts.push(bytes)
    at += bytes.length
    if (bytes.length < step) {
      break
    }
    step *= 2
  }
  const result = new Uint8Array(at - start)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
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
 * estimate drifting apart, and a trim that is wrong still parses and still
 * draws.
 *
 * The slice always ends at the span's `boundEntry` virtual offset when there is
 * one — the first entry at or past the query end, or past a chromosome's last
 * sparse entry the next chromosome's first entry — wherever its bgzf block sits
 * in the read. A TAF block has no terminator, so the last block overlapping the
 * query is complete only once the bounding coordinate line arrives or the slice
 * ends on a line break; a slice that kept everything decoded ended wherever the
 * read's last bgzf block did, cut that line, and dropped the block before it
 * with no error. Only the last chromosome has no bound and reads to the end of
 * the file. A bound whose bgzf block is not in the read means the `.tai` does
 * not match the file, and throws rather than guess where to cut.
 *
 * Returns undefined when the chromosome is not in the index — no span, nothing
 * to read.
 */
export async function readTaiSlice({
  index,
  refName,
  start,
  end,
  location,
  pluginManager,
  statusCallback,
  signal,
}: {
  index: IndexData
  refName: string
  start: number
  end: number
  location: FileLocation
  pluginManager?: PluginManager
  statusCallback?: StatusCallback
  signal?: AbortSignal
}) {
  const span = queryBlockSpan(index, refName, start, end)
  if (!span) {
    return undefined
  }
  const { firstEntry, boundEntry, startBlock, readLength, toEnd } = span

  const file = openLocation(location, pluginManager)
  const compressed = await updateStatus(
    'Downloading alignments',
    statusCallback,
    () =>
      toEnd
        ? readToEnd(file, startBlock, readLength, signal)
        : file.read(readLength, startBlock, { signal }),
    signal,
  )
  const buffer = await unzip(compressed)
  const blocks = scanBgzfBlocks(compressed, startBlock, Infinity)

  const starts = decompressedStarts(blocks)

  const startOffset = firstEntry.virtualOffset.dataPosition
  const endOffset = boundEntry
    ? boundOffset(boundEntry, blocks, starts, refName, getFileName(location))
    : buffer.length

  // subarray (not slice) — TextDecoder.decode handles either, and subarray
  // avoids a Uint8Array copy of what can be a sizable chunk.
  const slice = buffer.subarray(startOffset, endOffset)
  const atFileEnd =
    endOffset === buffer.length && (toEnd || compressed.length < readLength)
  const bytes = atFileEnd ? endingInNewline(slice) : slice
  const text = new TextDecoder().decode(bytes)
  const virtualOffsetAt = virtualOffsetIds(
    blocks,
    starts,
    startBlock,
    startOffset,
  )
  const byteOffsetAt = byteOffsetsOf(text, bytes)
  return {
    text,
    blockIdAt: (textOffset: number) =>
      virtualOffsetAt(byteOffsetAt(textOffset)),
  }
}

function boundOffset(
  boundEntry: ByteRange,
  blocks: BgzfBlockInfo[],
  starts: number[],
  refName: string,
  fileName: string,
) {
  const { blockPosition, dataPosition } = boundEntry.virtualOffset
  const boundBlock = blocks.findIndex(
    block => block.filePosition === blockPosition,
  )
  if (boundBlock === -1) {
    throw new Error(
      `The .tai index does not match ${fileName}: the read of ${refName} is bounded at the bgzf block at byte ${blockPosition}, which the file does not have`,
    )
  }
  return starts[boundBlock]! + dataPosition
}

/** Where each block's bytes start in the decompressed buffer. */
function decompressedStarts(blocks: BgzfBlockInfo[]) {
  const starts: number[] = []
  let decompressed = 0
  for (const block of blocks) {
    starts.push(decompressed)
    decompressed += block.decompressedSize
  }
  return starts
}

/** A tabix line's file offset is its id; this is the bgzf equivalent. */
function virtualOffsetIds(
  blocks: BgzfBlockInfo[],
  starts: number[],
  startBlock: number,
  sliceStart: number,
) {
  return (offset: number) => {
    const at = sliceStart + offset
    const i = lowerBound(starts, at + 1, start => start) - 1
    const block = blocks[i]
    return block
      ? `${block.filePosition}-${at - starts[i]!}`
      : `${startBlock}-${at}`
  }
}

/**
 * The parsers drop a block whose last line has no newline, as a read cut it.
 * At the end of the file nothing cut it, so a file whose last line has none
 * gets one.
 */
function endingInNewline(slice: Uint8Array) {
  if (slice.length === 0 || slice.at(-1) === NEWLINE) {
    return slice
  }
  const ended = new Uint8Array(slice.length + 1)
  ended.set(slice)
  ended[slice.length] = NEWLINE
  return ended
}

/**
 * Byte budget for a region set from the `.tai` alone: exactly the `readLength`
 * {@link readTaiSlice} passes to `file.read`, through the same
 * `queryBlockSpan`, or its first step for a read to the end of the file. No
 * block download. A chromosome absent from the index resolves no span and so
 * costs nothing, which is the only case reporting 0.
 */
export function taiRegionByteSize({ index }: TaiIndex, regions: Region[]) {
  let bytes = 0
  for (const region of regions) {
    const span = queryBlockSpan(index, region.refName, region.start, region.end)
    if (span) {
      bytes += span.readLength
    }
  }
  return bytes
}
