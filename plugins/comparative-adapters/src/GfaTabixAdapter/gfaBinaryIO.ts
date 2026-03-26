import type { GenericFilehandle } from 'generic-filehandle2'

export interface SegRecord {
  segOrd: number
  pathNameIdx: number
  offset: number
  segLen: number
  orient: number // char code: 0x2B '+' or 0x2D '-'
}

export interface IndexedBinaryShard {
  filehandle: GenericFilehandle
  idxFile: GenericFilehandle
  idxPromise?: Promise<BigUint64Array>
}

export interface EdgeRecord {
  targetOrd: number
  srcOrient: number
  tgtOrient: number
  tgtLen: number
}

export const ORIENT_FWD = 0x2b // '+'

const RECORD_SIZE = 15
const EDGE_RECORD_SIZE = 10
const MERGE_GAP = 65_000
const MAX_MERGED_BYTES = 20 * 1024 * 1024

export function parseGfaPathName(path: string) {
  const parts = path.split('#')
  if (parts.length >= 3) {
    return {
      genome: parts.slice(0, -1).join('#'),
      refName: parts[parts.length - 1]!,
    }
  }
  return { genome: parts[0]!, refName: parts[1] ?? parts[0]! }
}

export function parseSegmentsBinary(buf: Uint8Array) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const count = Math.floor(buf.byteLength / RECORD_SIZE)
  const records = new Array<SegRecord>(count)
  for (let i = 0; i < count; i++) {
    const off = i * RECORD_SIZE
    records[i] = {
      segOrd: dv.getUint32(off, true),
      pathNameIdx: dv.getUint16(off + 4, true),
      offset: dv.getUint32(off + 6, true),
      segLen: dv.getUint32(off + 10, true),
      orient: buf[buf.byteOffset + off + 14]!,
    }
  }
  return records
}

export function parseEdgesBinary(buf: Uint8Array) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const count = Math.floor(buf.byteLength / EDGE_RECORD_SIZE)
  const records = new Array<EdgeRecord>(count)
  for (let i = 0; i < count; i++) {
    const off = i * EDGE_RECORD_SIZE
    records[i] = {
      targetOrd: dv.getUint32(off, true),
      srcOrient: buf[buf.byteOffset + off + 4]!,
      tgtOrient: buf[buf.byteOffset + off + 5]!,
      tgtLen: dv.getUint32(off + 6, true),
    }
  }
  return records
}

export async function loadBinaryIndex(shard: IndexedBinaryShard) {
  if (!shard.idxPromise) {
    shard.idxPromise = shard.idxFile.readFile().then(buf => {
      const aligned = new ArrayBuffer(buf.byteLength)
      new Uint8Array(aligned).set(buf)
      return new BigUint64Array(aligned)
    })
  }
  return shard.idxPromise
}

export async function getSegmentsForOrdinalsFromShard(
  shard: IndexedBinaryShard,
  ordinalRanges: [number, number][],
) {
  const idx = await loadBinaryIndex(shard)

  const merged: { start: number; end: number }[] = []
  for (const [lo, hi] of ordinalRanges) {
    if (lo >= 0 && hi + 1 < idx.length) {
      const start = Number(idx[lo]!)
      const end = Number(idx[hi + 1]!)
      if (end > start) {
        const prev = merged.length > 0 ? merged[merged.length - 1]! : undefined
        if (
          prev &&
          start - prev.end < MERGE_GAP &&
          end - prev.start < MAX_MERGED_BYTES
        ) {
          prev.end = Math.max(prev.end, end)
        } else {
          merged.push({ start, end })
        }
      }
    }
  }

  const results = await Promise.all(
    merged.map(async range => {
      const length = range.end - range.start
      const bytes = await shard.filehandle.read(length, range.start)
      return parseSegmentsBinary(bytes)
    }),
  )
  return results.flat()
}

export async function getEdgesForOrdinals(
  shard: IndexedBinaryShard,
  ordinals: number[],
) {
  const idx = await loadBinaryIndex(shard)
  const result = new Map<number, EdgeRecord[]>()
  const ranges: { ord: number; start: number; end: number }[] = []

  for (const ord of ordinals) {
    if (ord >= 0 && ord + 1 < idx.length) {
      const start = Number(idx[ord]!)
      const end = Number(idx[ord + 1]!)
      if (end > start) {
        ranges.push({ ord, start, end })
      }
    }
  }

  ranges.sort((a, b) => a.start - b.start)
  const batched: { start: number; end: number; ords: number[] }[] = []
  for (const r of ranges) {
    const prev = batched.length > 0 ? batched[batched.length - 1]! : undefined
    if (prev && r.start - prev.end < 4096) {
      prev.end = Math.max(prev.end, r.end)
      prev.ords.push(r.ord)
    } else {
      batched.push({ start: r.start, end: r.end, ords: [r.ord] })
    }
  }

  await Promise.all(
    batched.map(async batch => {
      const bytes = await shard.filehandle.read(
        batch.end - batch.start,
        batch.start,
      )
      for (const ord of batch.ords) {
        const ordStart = Number(idx[ord]!) - batch.start
        const ordEnd = Number(idx[ord + 1]!) - batch.start
        if (ordEnd > ordStart) {
          const slice = bytes.subarray(ordStart, ordEnd)
          result.set(ord, parseEdgesBinary(slice))
        }
      }
    }),
  )

  return result
}

export function parsePosLineOrdinals(line: string, out: [number, number][]) {
  let t = 0
  for (let n = 0; n < 3; n++) {
    t = line.indexOf('\t', t) + 1
  }
  const t5 = line.indexOf('\t', t)
  const col4 = line.slice(t, t5 !== -1 ? t5 : undefined)

  if (t5 !== -1) {
    out.push([+col4, +line.slice(t5 + 1)])
  } else if (col4.includes('-') || col4.includes(',')) {
    let i = 0
    while (i < col4.length) {
      let j = col4.indexOf(',', i)
      if (j === -1) {
        j = col4.length
      }
      const token = col4.slice(i, j)
      const dash = token.indexOf('-')
      if (dash > 0) {
        out.push([+token.slice(0, dash), +token.slice(dash + 1)])
      } else {
        out.push([+token, +token])
      }
      i = j + 1
    }
  } else {
    out.push([+col4, +col4])
  }
}

export function mergeOrdinalRanges(rawRanges: [number, number][]) {
  rawRanges.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const [lo, hi] of rawRanges) {
    const prev = merged.length > 0 ? merged[merged.length - 1]! : undefined
    if (prev && lo <= prev[1] + 1) {
      prev[1] = Math.max(prev[1], hi)
    } else {
      merged.push([lo, hi])
    }
  }
  return merged
}
