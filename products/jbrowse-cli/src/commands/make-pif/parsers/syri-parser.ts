import { getReadline } from '../file-utils.ts'

// SyRI output format (.syri.out), 12 columns:
// refChr refStart refEnd - - qryChr qryStart qryEnd ID parent type -

const SYRI_TYPE_MAP: Record<string, string> = {
  SYNAL: 'SYN',
  INVAL: 'INV',
  TRANSAL: 'TRANS',
  DUPAL: 'DUP',
  INVTRAL: 'TRANS',
  INVDPAL: 'DUP',
  HDR: 'SYN',
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
  segmentId?: string
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
    if (parts.length < 11) {
      continue
    }

    // Columns: 0=refChr 1=refStart 2=refEnd 3=- 4=- 5=qryChr 6=qryStart 7=qryEnd 8=ID 9=parent 10=type 11=-
    const refChr = parts[0]
    const refStart = +parts[1]!
    const refEnd = +parts[2]!
    const qryChr = parts[5]
    const qryStart = +parts[6]!
    const qryEnd = +parts[7]!
    const typeTag = parts[10]!.trim()

    // Only include alignment-level entries (SYNAL, INVAL, TRANSAL, DUPAL, HDR)
    // Skip structural parent entries (SYN, INV, TRANS, DUP without AL suffix)
    // and NOTAL (no query mapping)
    const syriType = SYRI_TYPE_MAP[typeTag]
    if (!syriType) {
      continue
    }
    // Skip entries without a query chromosome (e.g. NOTAL)
    if (!qryChr || qryChr === '-') {
      continue
    }
    const strand = qryStart <= qryEnd ? '+' : '-'
    const actualQStart = Math.min(qryStart, qryEnd)
    const actualQEnd = Math.max(qryStart, qryEnd)
    const blockLen = Math.max(refEnd - refStart, 1)

    records.push({
      qname: qryChr,
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
