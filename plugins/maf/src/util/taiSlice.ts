import { unzip } from '@gmod/bgzf-filehandle'
import { updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import { parseTaiIndex, queryBlockSpan } from './taiIndex.ts'

import type { IndexData } from './taiIndex.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { FileLocation, Region, StatusCallback } from '@jbrowse/core/util'

/** A parsed `.tai` */
export interface TaiIndex {
  index: IndexData
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
 * estimate drifting apart, and a second copy of `nextEntry && endBlock ===
 * startBlock && nextOffset > startOffset` is how a third would arrive: it is
 * four conditions with no obvious symptom when wrong, since a slice trimmed one
 * bracket short still parses and still draws.
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
  const { firstEntry, nextEntry, startBlock, endBlock, readLength, toEnd } =
    span

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

  const startOffset = firstEntry.virtualOffset.dataPosition
  const nextOffset = nextEntry?.virtualOffset.dataPosition ?? 0
  // Trim to the cushion entry only for interior reads sharing the start block;
  // a past-the-end read keeps everything decoded to the chromosome end.
  const endOffset =
    nextEntry && endBlock === startBlock && nextOffset > startOffset
      ? nextOffset
      : buffer.length

  // subarray (not slice) — TextDecoder.decode handles either, and subarray
  // avoids a Uint8Array copy of what can be a sizable chunk.
  const slice = buffer.subarray(startOffset, endOffset)
  const atFileEnd =
    endOffset === buffer.length && (toEnd || compressed.length < readLength)
  return atFileEnd ? endingInNewline(slice) : slice
}

const NEWLINE = 10

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
