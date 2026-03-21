import fs from 'fs'
import readline from 'readline'
import { createGunzip } from 'zlib'

import type { PAFLikeRecord } from './syri-parser.ts'

interface MafSequence {
  src: string
  start: number
  size: number
  strand: '+' | '-'
  srcSize: number
  text: string
}

// Parses MAF alignment blocks and extracts pairwise alignments.
// MAF files can be very large (100+ GB) so this streams block by block.
export async function parseMaf(
  filename: string,
  assemblies?: string[],
): Promise<PAFLikeRecord[]> {
  const stream = fs.createReadStream(filename)
  const input = filename.endsWith('.gz') ? stream.pipe(createGunzip()) : stream
  const rl = readline.createInterface({ input })

  const records: PAFLikeRecord[] = []
  let currentBlock: MafSequence[] = []
  const assemblySet = assemblies ? new Set(assemblies) : undefined

  const flushBlock = () => {
    if (currentBlock.length < 2) {
      currentBlock = []
      return
    }

    // Extract pairwise alignments from this block
    const seqs = assemblySet
      ? currentBlock.filter(s => {
          const species = s.src.split('.')[0]!
          return assemblySet.has(species)
        })
      : currentBlock

    for (let i = 0; i < seqs.length; i++) {
      for (let j = i + 1; j < seqs.length; j++) {
        const a = seqs[i]!
        const b = seqs[j]!
        const pafRecord = mafPairToRecord(a, b)
        if (pafRecord) {
          records.push(pafRecord)
        }
      }
    }

    currentBlock = []
  }

  for await (const line of rl) {
    if (line.startsWith('a')) {
      flushBlock()
    } else if (line.startsWith('s')) {
      const parts = line.split(/\s+/)
      if (parts.length >= 7) {
        currentBlock.push({
          src: parts[1]!,
          start: +parts[2]!,
          size: +parts[3]!,
          strand: parts[4] as '+' | '-',
          srcSize: +parts[5]!,
          text: parts[6]!,
        })
      }
    }
  }
  flushBlock()

  rl.close()
  return records
}

function mafPairToRecord(
  a: MafSequence,
  b: MafSequence,
): PAFLikeRecord | undefined {
  if (a.size === 0 && b.size === 0) {
    return undefined
  }

  // Count matches from aligned text
  let matches = 0
  const blockLen = Math.max(a.size, b.size)
  const minLen = Math.min(a.text.length, b.text.length)
  for (let k = 0; k < minLen; k++) {
    if (
      a.text[k] !== '-' &&
      b.text[k] !== '-' &&
      a.text[k]!.toUpperCase() === b.text[k]!.toUpperCase()
    ) {
      matches++
    }
  }

  // Convert MAF coordinates to forward-strand coordinates
  const aStart = a.strand === '+' ? a.start : a.srcSize - a.start - a.size
  const aEnd = aStart + a.size
  const bStart = b.strand === '+' ? b.start : b.srcSize - b.start - b.size
  const bEnd = bStart + b.size

  const strand = a.strand === b.strand ? '+' : '-'

  // Build a simplified CIGAR from the column alignment
  const cigar = mafAlignmentToCigar(a.text, b.text)

  return {
    qname: b.src,
    qlen: String(b.srcSize),
    qstart: bStart,
    qend: bEnd,
    strand,
    tname: a.src,
    tlen: String(a.srcSize),
    tstart: aStart,
    tend: aEnd,
    numMatches: matches,
    blockLen,
    cigar: cigar || undefined,
  }
}

function mafAlignmentToCigar(textA: string, textB: string): string {
  const ops: string[] = []
  let currentOp = ''
  let currentLen = 0

  const flush = () => {
    if (currentLen > 0 && currentOp) {
      ops.push(`${currentLen}${currentOp}`)
    }
    currentLen = 0
  }

  for (let i = 0; i < textA.length; i++) {
    const a = textA[i]!
    const b = textB[i]!

    let op: string
    if (a === '-') {
      op = 'I'
    } else if (b === '-') {
      op = 'D'
    } else {
      op = 'M'
    }

    if (op !== currentOp) {
      flush()
      currentOp = op
    }
    currentLen++
  }
  flush()

  return ops.join('')
}
