import { getReadline } from '../file-utils.ts'

import type { PAFLikeRecord } from './syri-parser.ts'

// BEDPE format:
// chr1 start1 end1 chr2 start2 end2 name score strand1 strand2 [type] ...
// The type column (optional) contains structural annotation: SYN, INV, TRA, DUP, INVTR, INVDP

const BEDPE_TYPE_MAP: Record<string, string> = {
  SYN: 'SYN',
  INV: 'INV',
  TRA: 'TRANS',
  TRANS: 'TRANS',
  DUP: 'DUP',
  INVTR: 'TRANS',
  INVDP: 'DUP',
}

export async function parseBedpe(filename: string): Promise<PAFLikeRecord[]> {
  const rl = getReadline(filename)
  const records: PAFLikeRecord[] = []

  for await (const line of rl) {
    if (line.startsWith('#') || line.trim() === '') {
      continue
    }

    const parts = line.split('\t')
    if (parts.length < 6) {
      continue
    }

    const chr1 = parts[0]!
    const start1 = +parts[1]!
    const end1 = +parts[2]!
    const chr2 = parts[3]!
    const start2 = +parts[4]!
    const end2 = +parts[5]!

    // Type can be at column 6 (7-col format) or column 10 (full BEDPE)
    // Try to find a type string in the remaining columns
    let typeStr: string | undefined
    for (let i = 6; i < parts.length; i++) {
      const trimmed = parts[i]!.trim()
      if (BEDPE_TYPE_MAP[trimmed] !== undefined) {
        typeStr = trimmed
        break
      }
    }

    const strand1 = parts[8] || '+'
    const strand2 = parts[9] || '+'
    const strand = strand1 === strand2 ? '+' : '-'
    const syriType = typeStr ? (BEDPE_TYPE_MAP[typeStr] ?? 'SYN') : undefined
    const blockLen = Math.max(end1 - start1, 1)

    records.push({
      qname: chr2,
      qlen: '0',
      qstart: start2,
      qend: end2,
      strand,
      tname: chr1,
      tlen: '0',
      tstart: start1,
      tend: end1,
      numMatches: blockLen,
      blockLen,
      syriType,
    })
  }

  rl.close()
  return records
}
