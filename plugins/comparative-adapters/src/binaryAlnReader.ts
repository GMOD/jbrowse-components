// Reader for binary aln.bin + aln.idx files.
//
// aln.bin: sorted binary alignment records (by chrom, refStart)
// aln.idx: header with genome/chrom name tables + per-chrom linear index

import type { GenericFilehandle } from 'generic-filehandle2'

const ALN_RECORD_FIXED = 25
const BIN_SIZE = 16384

export interface AlnBinRecord {
  refStart: number
  refEnd: number
  queryGenomeIdx: number
  mateChromIdx: number
  mateStart: number
  mateEnd: number
  strand: number // +1 or -1
  identity: number // 0-1
  csData: Uint8Array
}

export interface AlnIndex {
  genomeNames: string[]
  chromNames: string[]
  chromSections: Map<
    number,
    {
      chromLen: number
      binOffsets: BigUint64Array
    }
  >
}

function readU16(buf: Uint8Array, offset: number) {
  return buf[offset]! | (buf[offset + 1]! << 8)
}

function readU32(buf: Uint8Array, offset: number) {
  return (
    buf[offset]! |
    (buf[offset + 1]! << 8) |
    (buf[offset + 2]! << 16) |
    ((buf[offset + 3]! << 24) >>> 0)
  )
}

function readLengthPrefixedString(buf: Uint8Array, offset: number) {
  const len = readU16(buf, offset)
  const strBytes = buf.slice(offset + 2, offset + 2 + len)
  const str = new TextDecoder().decode(strBytes)
  return { str, bytesRead: 2 + len }
}

export async function loadAlnIndex(
  idxFile: GenericFilehandle,
): Promise<AlnIndex> {
  const buf = await idxFile.readFile()
  const data = new Uint8Array(
    buf.buffer,
    buf.byteOffset,
    buf.byteLength,
  )

  // Verify magic
  if (
    data[0] !== 0x41 || // A
    data[1] !== 0x4c || // L
    data[2] !== 0x4e || // N
    data[3] !== 0x49 // I
  ) {
    throw new Error('Invalid aln.idx magic bytes')
  }

  const version = data[4]!
  if (version !== 1) {
    throw new Error(`Unsupported aln.idx version: ${version}`)
  }

  let pos = 5

  // Read genome names
  const numGenomes = readU16(data, pos)
  pos += 2
  const genomeNames: string[] = []
  for (let i = 0; i < numGenomes; i++) {
    const { str, bytesRead } = readLengthPrefixedString(data, pos)
    genomeNames.push(str)
    pos += bytesRead
  }

  // Read chrom names
  const numChroms = readU16(data, pos)
  pos += 2
  const chromNames: string[] = []
  for (let i = 0; i < numChroms; i++) {
    const { str, bytesRead } = readLengthPrefixedString(data, pos)
    chromNames.push(str)
    pos += bytesRead
  }

  // Read per-chrom index sections
  const chromSections = new Map<
    number,
    { chromLen: number; binOffsets: BigUint64Array }
  >()

  while (pos < data.length) {
    const chromIdx = readU16(data, pos)
    pos += 2
    const chromLen = readU32(data, pos)
    pos += 4
    const numBins = readU32(data, pos)
    pos += 4

    const offsetCount = numBins + 1
    const offsetBytes = offsetCount * 8
    // Need aligned buffer for BigUint64Array
    const aligned = new ArrayBuffer(offsetBytes)
    new Uint8Array(aligned).set(data.slice(pos, pos + offsetBytes))
    const binOffsets = new BigUint64Array(aligned)
    pos += offsetBytes

    chromSections.set(chromIdx, { chromLen, binOffsets })
  }

  console.log(
    '[loadAlnIndex]',
    'genomes:', genomeNames.length,
    'chroms:', chromNames.length,
    'sections:', chromSections.size,
  )
  for (const [ci, sec] of chromSections) {
    console.log(
      `[loadAlnIndex] section ${ci} (${chromNames[ci]}):`,
      'chromLen:', sec.chromLen,
      'bins:', sec.binOffsets.length - 1,
      'firstOffset:', Number(sec.binOffsets[0]),
      'lastOffset:', Number(sec.binOffsets[sec.binOffsets.length - 1]),
    )
  }
  return { genomeNames, chromNames, chromSections }
}

export function parseAlnBinRecords(buf: Uint8Array) {
  const records: AlnBinRecord[] = []
  let pos = 0

  while (pos + ALN_RECORD_FIXED <= buf.length) {
    const refStart = readU32(buf, pos)
    const refEnd = readU32(buf, pos + 4)
    const queryGenomeIdx = readU16(buf, pos + 8)
    const mateChromIdx = readU16(buf, pos + 10)
    const mateStart = readU32(buf, pos + 12)
    const mateEnd = readU32(buf, pos + 16)
    const strandByte = buf[pos + 20]!
    const identityU16 = readU16(buf, pos + 21)
    const csLen = readU16(buf, pos + 23)

    if (pos + ALN_RECORD_FIXED + csLen > buf.length) {
      break
    }

    const csData = buf.slice(pos + ALN_RECORD_FIXED, pos + ALN_RECORD_FIXED + csLen)

    records.push({
      refStart,
      refEnd,
      queryGenomeIdx,
      mateChromIdx,
      mateStart,
      mateEnd,
      strand: strandByte === 0x2d ? -1 : 1,
      identity: identityU16 / 10000,
      csData,
    })

    pos += ALN_RECORD_FIXED + csLen
  }

  return records
}

export async function queryAlnBin(
  binFile: GenericFilehandle,
  index: AlnIndex,
  chromName: string,
  start: number,
  end: number,
) {
  const chromIdx = index.chromNames.indexOf(chromName)
  if (chromIdx < 0) {
    console.log('[queryAlnBin] chromName not found:', chromName)
    return []
  }

  const section = index.chromSections.get(chromIdx)
  if (!section) {
    console.log('[queryAlnBin] No section for chromIdx:', chromIdx)
    return []
  }

  const startBin = Math.floor(start / BIN_SIZE)
  const endBin = Math.floor(end / BIN_SIZE)

  const firstBin = Math.max(0, startBin)
  const lastBin = Math.min(endBin, Number(section.binOffsets.length) - 2)

  console.log(
    '[queryAlnBin]',
    chromName, `${start}-${end}`,
    'bins:', firstBin, '-', lastBin,
    'chromLen:', section.chromLen,
    'numBinOffsets:', section.binOffsets.length,
  )

  if (firstBin > lastBin) {
    console.log('[queryAlnBin] firstBin > lastBin, returning empty')
    return []
  }

  const byteStart = Number(section.binOffsets[firstBin]!)
  const byteEnd = Number(section.binOffsets[lastBin + 1]!)

  console.log(
    '[queryAlnBin] byte range:',
    byteStart, '-', byteEnd,
    'length:', byteEnd - byteStart,
  )

  if (byteEnd <= byteStart) {
    console.log('[queryAlnBin] byteEnd <= byteStart, returning empty')
    return []
  }

  const length = byteEnd - byteStart
  const buf = await binFile.read(length, byteStart)
  console.log('[queryAlnBin] fetched', buf.length, 'bytes, parsing records...')
  const allRecords = parseAlnBinRecords(buf)

  // Filter to records that overlap [start, end)
  const filtered = allRecords.filter(r => r.refEnd > start && r.refStart < end)
  console.log(
    '[queryAlnBin] parsed:', allRecords.length,
    'records, overlapping:', filtered.length,
    allRecords.length > 0
      ? `first record: ${allRecords[0]!.refStart}-${allRecords[0]!.refEnd}`
      : '',
  )
  return filtered
}

