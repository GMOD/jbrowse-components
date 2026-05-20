const cigarRegex = new RegExp(/([MIDNSHPX=])/)

export function parseCigar(cigar = ''): string[] {
  return cigar.split(cigarRegex).slice(0, -1)
}

export function flipCigar(cigar: string[]): string[] {
  const arr: string[] = []
  for (let i = cigar.length - 2; i >= 0; i -= 2) {
    arr.push(cigar[i]!)
    const op = cigar[i + 1]!
    if (op === 'D') {
      arr.push('I')
    } else if (op === 'I') {
      arr.push('D')
    } else {
      arr.push(op)
    }
  }
  return arr
}

export function swapIndelCigar(cigar: string): string {
  return cigar.replaceAll('D', 'K').replaceAll('I', 'D').replaceAll('K', 'I')
}

// Gap-compressed per-base divergence (minimap2 `de` tag). Returns undefined
// for empty CIGARs or CIGARs that only use `M` (which conflates matches and
// mismatches). Counts each insertion / deletion run as a single event.
// Formula: 1 - matches / (matches + mismatches + insertionEvents + deletionEvents)
export function computeDeFromCigar(cigarStr: string): number | undefined {
  const ops = parseCigar(cigarStr)
  if (ops.length === 0) {
    return undefined
  }
  let matches = 0
  let mismatches = 0
  let insertionEvents = 0
  let deletionEvents = 0
  let hasEqOrX = false
  for (let i = 0; i < ops.length; i += 2) {
    const len = +ops[i]!
    const op = ops[i + 1]!
    if (op === '=') {
      matches += len
      hasEqOrX = true
    } else if (op === 'X') {
      mismatches += len
      hasEqOrX = true
    } else if (op === 'I') {
      insertionEvents += 1
    } else if (op === 'D' || op === 'N') {
      deletionEvents += 1
    }
  }
  if (!hasEqOrX) {
    return undefined
  }
  const denom = matches + mismatches + insertionEvents + deletionEvents
  if (denom === 0) {
    return undefined
  }
  return 1 - matches / denom
}

// Extracts large indels from a CIGAR string and encodes them as absolute
// positions. This avoids the need to sequentially decode the full CIGAR to
// find where structural events are. Format:
// "id:Z:<op><refPos>,<queryPos>,<len>;..."
// e.g. "id:Z:D1500,2000,500;I5000,4800,300"
export function extractLargeIndels(
  cigarStr: string,
  minIndelSize: number,
  refStart: number,
  queryStart: number,
): string {
  const ops = parseCigar(cigarStr)
  if (ops.length === 0) {
    return ''
  }

  const indels: string[] = []
  let refPos = refStart
  let queryPos = queryStart

  for (let i = 0; i < ops.length; i += 2) {
    const len = +ops[i]!
    const op = ops[i + 1]!
    if (op === 'M' || op === '=' || op === 'X') {
      refPos += len
      queryPos += len
    } else if (op === 'D' || op === 'N') {
      if (len >= minIndelSize) {
        indels.push(`${op}${refPos},${queryPos},${len}`)
      }
      refPos += len
    } else if (op === 'I') {
      if (len >= minIndelSize) {
        indels.push(`I${refPos},${queryPos},${len}`)
      }
      queryPos += len
    }
  }

  if (indels.length === 0) {
    return ''
  }
  return `id:Z:${indels.join(';')}`
}

// Splits a PAF alignment into multiple sub-alignments at large indels.
// columns: [qname, qlen, qstart, qend, strand, tname, tlen, tstart, tend, ...rest]
// Returns array of column arrays (one per sub-alignment).
export function splitAlignmentByCigar(
  columns: string[],
  threshold: number,
): string[][] {
  const [qname, qlen, qstart, , strand, tname, tlen, tstart, , ...rest] =
    columns
  const cigarIdx = rest.findIndex(f => f.startsWith('cg:Z:'))
  if (cigarIdx === -1) {
    return [columns]
  }

  const cigarStr = rest[cigarIdx]!.slice(5)
  const ops = parseCigar(cigarStr)

  // Check if any op >= threshold
  let hasLargeIndel = false
  for (let i = 0; i < ops.length; i += 2) {
    const len = +ops[i]!
    const op = ops[i + 1]!
    if ((op === 'D' || op === 'I' || op === 'N') && len >= threshold) {
      hasLargeIndel = true
      break
    }
  }

  if (!hasLargeIndel) {
    return [columns]
  }

  const results: string[][] = []
  let queryPos = +qstart!
  let refPos = +tstart!
  let blockQueryStart = queryPos
  let blockRefStart = refPos
  let blockCigarOps: string[] = []

  const flushBlock = () => {
    if (blockCigarOps.length === 0) {
      return
    }
    const newRest = [...rest]
    newRest[cigarIdx] = `cg:Z:${blockCigarOps.join('')}`
    results.push([
      qname!,
      qlen!,
      String(blockQueryStart),
      String(queryPos),
      strand!,
      tname!,
      tlen!,
      String(blockRefStart),
      String(refPos),
      ...newRest,
    ])
    blockCigarOps = []
  }

  for (let i = 0; i < ops.length; i += 2) {
    const len = +ops[i]!
    const op = ops[i + 1]!

    if ((op === 'D' || op === 'I' || op === 'N') && len >= threshold) {
      flushBlock()
      if (op === 'D' || op === 'N') {
        refPos += len
      } else {
        queryPos += len
      }
      blockQueryStart = queryPos
      blockRefStart = refPos
    } else {
      blockCigarOps.push(ops[i]!, op)
      if (op === 'M' || op === '=' || op === 'X') {
        queryPos += len
        refPos += len
      } else if (op === 'D' || op === 'N') {
        refPos += len
      } else if (op === 'I') {
        queryPos += len
      }
    }
  }
  flushBlock()

  return results
}
