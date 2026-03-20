import readline from 'readline'

import { getReadline } from '../file-utils.ts'

// SyRI output format (.syri.out):
// refChr refStart refEnd qryChr qryStart qryEnd ... type parent
// The type column contains: SYNAL, INVAL, TRANS, DUPAL, etc.
// Parent column links sub-alignments to their structural block

const SYRI_TYPE_MAP: Record<string, string> = {
  SYNAL: 'SYN',
  SYN: 'SYN',
  INVAL: 'INV',
  INV: 'INV',
  TRANS: 'TRANS',
  TRANSAL: 'TRANS',
  DUPAL: 'DUP',
  DUP: 'DUP',
  INVTR: 'TRANS',
  INVDP: 'DUP',
  NOTAL: 'SYN',
}

export interface PAFLikeRecord {
  qname: string
  qlen: string
  qstart: number
  qend: number
  strand: string
  tname: string
  tlen: string
  tstart: number
  tend: number
  numMatches: number
  blockLen: number
  cigar?: string
  syriType?: string
}

export async function parseSyriOutput(
  filename: string,
): Promise<PAFLikeRecord[]> {
  const rl = getReadline(filename)
  const records: PAFLikeRecord[] = []

  for await (const line of rl) {
    if (line.startsWith('#') || line.trim() === '') {
      continue
    }

    const parts = line.split('\t')
    if (parts.length < 10) {
      continue
    }

    const [refChr, refStartStr, refEndStr, qryChr, qryStartStr, qryEndStr, , , , typeStr] = parts
    const refStart = +refStartStr!
    const refEnd = +refEndStr!
    const qryStart = +qryStartStr!
    const qryEnd = +qryEndStr!
    const typeTag = typeStr!.trim()

    // Only include alignment-level entries (SYNAL, INVAL, etc.)
    // Skip structural parent entries and non-alignment entries
    if (!typeTag.endsWith('AL') && typeTag !== 'NOTAL') {
      continue
    }

    const syriType = SYRI_TYPE_MAP[typeTag] ?? 'SYN'
    const strand = qryStart <= qryEnd ? '+' : '-'
    const actualQStart = Math.min(qryStart, qryEnd)
    const actualQEnd = Math.max(qryStart, qryEnd)
    const blockLen = Math.max(refEnd - refStart, 1)

    records.push({
      qname: qryChr!,
      qlen: '0',
      qstart: actualQStart,
      qend: actualQEnd,
      strand,
      tname: refChr!,
      tlen: '0',
      tstart: refStart,
      tend: refEnd,
      numMatches: blockLen,
      blockLen,
      syriType,
    })
  }

  rl.close()
  return records
}
