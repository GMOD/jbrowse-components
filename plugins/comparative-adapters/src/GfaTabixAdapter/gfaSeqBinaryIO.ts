import type { GenericFilehandle } from 'generic-filehandle2'

// Binary sequence tier reader. Format pinned in
// agent-docs/GRAPH_INDEX_FORMAT.md ("segments.seq.bin"):
//   .bin: SEQB magic (4) + version u32 + per-segment records of
//         len:u32 LE | 2bit_pack:ceil(len/4) | n_bitmap:ceil(len/8)
//   .idx: SEQI magic (4) + version u32 + (numSegments+1) u64 LE byte
//         offsets pointing into .bin. idx[ord] = start of ordinal's
//         record; idx[numSegments] = file size sentinel.
//
// At HPRC chr20 scale this tier is ~25 MB vs ~91 MB plaintext FASTA
// (73% reduction) per the Phase 1 spike. Decode is a single pass per
// segment — bit-twiddle cost is dwarfed by the HTTP range fetch.
export interface SeqBinaryShard {
  binFile: GenericFilehandle
  idxFile: GenericFilehandle
  idxPromise?: Promise<BigUint64Array>
}

const SEQB_MAGIC = 0x42514553 // 'SEQB' little-endian
const SEQI_MAGIC = 0x49514553 // 'SEQI' little-endian
const HEADER_BYTES = 8
const SUPPORTED_VERSION = 1

const TWOBIT_TO_BASE = new Uint8Array([
  0x41, // 'A'
  0x43, // 'C'
  0x47, // 'G'
  0x54, // 'T'
])
const N_BYTE = 0x4e

const MERGE_GAP = 65_000
const MAX_MERGED_BYTES = 20 * 1024 * 1024

// Validate the SEQI magic + version, then return the offset table as a
// BigUint64Array (entries past the header). Throws on mismatch with the
// expected vs found bytes — old indexes silently producing garbage is the
// failure mode we're guarding against.
async function loadSeqBinaryIdx(shard: SeqBinaryShard) {
  shard.idxPromise ??= shard.idxFile.readFile().then(buf => {
    if (buf.byteLength < HEADER_BYTES) {
      throw new Error(
        `seq.bin.idx truncated: ${buf.byteLength} bytes < 8-byte header`,
      )
    }
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    const magic = dv.getUint32(0, true)
    const version = dv.getUint32(4, true)
    if (magic !== SEQI_MAGIC) {
      throw new Error(
        `seq.bin.idx magic mismatch: expected 'SEQI' (${SEQI_MAGIC.toString(16)}), found 0x${magic.toString(16)}`,
      )
    }
    if (version !== SUPPORTED_VERSION) {
      throw new Error(
        `seq.bin.idx version mismatch: expected ${SUPPORTED_VERSION}, found ${version}`,
      )
    }
    // BigUint64Array requires 8-byte alignment; copy the post-header bytes
    // into a fresh ArrayBuffer to guarantee it.
    const tableBytes = buf.byteLength - HEADER_BYTES
    if (tableBytes % 8 !== 0) {
      throw new Error(
        `seq.bin.idx table not 8-byte aligned: ${tableBytes} bytes after header`,
      )
    }
    const aligned = new ArrayBuffer(tableBytes)
    new Uint8Array(aligned).set(buf.subarray(HEADER_BYTES))
    return new BigUint64Array(aligned)
  })
  return shard.idxPromise
}

// Decode one segment record (sliced from .bin starting at the segment's
// idx offset). Substitutes 'N' at every N-bitmap-flagged position
// regardless of the 2-bit pack value — the encoder doesn't reserve a
// 2-bit code for N, so the bitmap is the source of truth for ambiguity.
export function decodeSeqRecord(record: Uint8Array): Uint8Array {
  if (record.byteLength < 4) {
    return new Uint8Array(0)
  }
  const dv = new DataView(record.buffer, record.byteOffset, record.byteLength)
  const len = dv.getUint32(0, true)
  if (len === 0) {
    return new Uint8Array(0)
  }
  const packBytes = (len + 3) >> 2
  const nbitmapBytes = (len + 7) >> 3
  const out = new Uint8Array(len)
  const packStart = 4
  for (let i = 0; i < len; i++) {
    const byte = record[packStart + (i >> 2)]!
    const shift = 6 - ((i & 3) << 1)
    out[i] = TWOBIT_TO_BASE[(byte >> shift) & 0x03]!
  }
  const bitmapStart = packStart + packBytes
  if (record.byteLength >= bitmapStart + nbitmapBytes) {
    for (let i = 0; i < len; i++) {
      const bm = record[bitmapStart + (i >> 3)]!
      if ((bm >> (i & 7)) & 1) {
        out[i] = N_BYTE
      }
    }
  }
  return out
}

// Magic-byte sniff for cooperative dispatch — the adapter calls this on
// the .bin head bytes when both tiers are configured to confirm SEQB
// before routing through the binary reader. Returns true if the buffer
// starts with the SEQB magic + supported version, false otherwise.
export function looksLikeSeqBinary(head: Uint8Array) {
  if (head.byteLength < HEADER_BYTES) {
    return false
  }
  const dv = new DataView(head.buffer, head.byteOffset, head.byteLength)
  return (
    dv.getUint32(0, true) === SEQB_MAGIC &&
    dv.getUint32(4, true) === SUPPORTED_VERSION
  )
}

// Batch-fetch decoded sequences for the requested ordinals. Mirrors the
// range-merging in gfaSeqIO.getSequencesForOrdinals so a viewport of
// adjacent ordinals collapses into a single HTTP range request.
export async function getSequencesForOrdinalsBinary(
  shard: SeqBinaryShard,
  ordinals: number[],
): Promise<Map<number, Uint8Array>> {
  const result = new Map<number, Uint8Array>()
  if (ordinals.length === 0) {
    return result
  }
  const idx = await loadSeqBinaryIdx(shard)
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
  if (ranges.length === 0) {
    return result
  }

  ranges.sort((a, b) => a.start - b.start)
  const batched: {
    start: number
    end: number
    ords: { ord: number; start: number; end: number }[]
  }[] = []
  for (const r of ranges) {
    const prev = batched.length > 0 ? batched[batched.length - 1]! : undefined
    if (
      prev &&
      r.start - prev.end < MERGE_GAP &&
      r.end - prev.start < MAX_MERGED_BYTES
    ) {
      prev.end = Math.max(prev.end, r.end)
      prev.ords.push(r)
    } else {
      batched.push({ start: r.start, end: r.end, ords: [r] })
    }
  }

  await Promise.all(
    batched.map(async batch => {
      const bytes = await shard.binFile.read(
        batch.end - batch.start,
        batch.start,
      )
      for (const r of batch.ords) {
        const sliceStart = r.start - batch.start
        const sliceEnd = r.end - batch.start
        result.set(r.ord, decodeSeqRecord(bytes.subarray(sliceStart, sliceEnd)))
      }
    }),
  )

  return result
}
