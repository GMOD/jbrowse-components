import type { GenericFilehandle } from 'generic-filehandle2'

// Adapter pairs the FASTA with a 12-bytes-per-ordinal binary `.idx`
// (u64 little-endian sequence byte offset + u32 little-endian length).
// The samtools-faidx-compatible `.fai` is shipped alongside for CLI
// compatibility but is never parsed at runtime — at HPRC scale the .fai
// grows into the tens of MB and parsing is wasted work for a per-viewport
// query that touches a few hundred ordinals.
export interface SeqShard {
  fastaFile: GenericFilehandle
  idxFile: GenericFilehandle
  idxPromise?: Promise<Uint8Array>
}

const SEQ_IDX_RECORD_SIZE = 12

export async function loadSeqIdx(shard: SeqShard) {
  shard.idxPromise ??= shard.idxFile.readFile()
  return shard.idxPromise
}

function readEntry(idx: Uint8Array, ord: number) {
  const off = ord * SEQ_IDX_RECORD_SIZE
  if (off + SEQ_IDX_RECORD_SIZE > idx.byteLength) {
    return undefined
  }
  const dv = new DataView(idx.buffer, idx.byteOffset + off, SEQ_IDX_RECORD_SIZE)
  const length = dv.getUint32(8, true)
  if (length === 0) {
    return undefined
  }
  const offsetLo = dv.getUint32(0, true)
  const offsetHi = dv.getUint32(4, true)
  const offset = offsetHi * 0x1_0000_0000 + offsetLo
  return { offset, length }
}

const MERGE_GAP = 65_000
const MAX_MERGED_BYTES = 20 * 1024 * 1024

// Batch-fetch sequences for a list of ordinals. Mirrors the range-merging
// pattern in getSegmentsForOrdinalsFromShard so a viewport of ~hundreds of
// adjacent ordinals collapses into one HTTP range request.
export async function getSequencesForOrdinals(
  shard: SeqShard,
  ordinals: number[],
): Promise<Map<number, Uint8Array>> {
  const idx = await loadSeqIdx(shard)
  const result = new Map<number, Uint8Array>()
  const ranges: { ord: number; start: number; end: number }[] = []

  for (const ord of ordinals) {
    const entry = readEntry(idx, ord)
    if (entry) {
      ranges.push({
        ord,
        start: entry.offset,
        end: entry.offset + entry.length,
      })
    }
  }

  if (ranges.length === 0) {
    return result
  }

  ranges.sort((a, b) => a.start - b.start)
  const batched: { start: number; end: number; ords: { ord: number; start: number; end: number }[] }[] = []
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
      const bytes = await shard.fastaFile.read(
        batch.end - batch.start,
        batch.start,
      )
      for (const r of batch.ords) {
        const sliceStart = r.start - batch.start
        const sliceEnd = r.end - batch.start
        result.set(r.ord, bytes.subarray(sliceStart, sliceEnd))
      }
    }),
  )

  return result
}
