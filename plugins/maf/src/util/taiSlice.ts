import { unzip } from '@gmod/bgzf-filehandle'
import { updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import { parseTaiIndex, queryBlockSpan } from '../BgzipTaffyAdapter/taiIndex.ts'

import type { IndexData } from '../BgzipTaffyAdapter/types.ts'
import type { FileLocation, Region, StatusCallback } from '@jbrowse/core/util'

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
