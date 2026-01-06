/**
 * SyRI-style classification utilities for make-pif command.
 * Computes syriType (SYN, INV, TRANS, DUP) for PAF records.
 */

export type SyriType = 'SYN' | 'INV' | 'TRANS' | 'DUP'

export interface PAFRecord {
  qname: string
  qstart: number
  qend: number
  tname: string
  tstart: number
  tend: number
  strand: number
  index: number
}

/**
 * Parse a PAF line into a record for syri computation.
 */
export function parsePAFLineForSyri(line: string, index: number): PAFRecord {
  const fields = line.split('\t')
  return {
    qname: fields[0]!,
    qstart: +fields[2]!,
    qend: +fields[3]!,
    tname: fields[5]!,
    tstart: +fields[7]!,
    tend: +fields[8]!,
    strand: fields[4] === '-' ? -1 : 1,
    index,
  }
}

/**
 * Build a mapping from query chromosomes to their primary target chromosome
 * based on total alignment coverage.
 */
function buildChromosomeMapping(records: PAFRecord[]): Map<string, string> {
  const coverageMap = new Map<string, Map<string, number>>()

  for (const r of records) {
    const { qname, tname, qstart, qend } = r
    const alignmentLength = Math.abs(qend - qstart)

    if (!coverageMap.has(qname)) {
      coverageMap.set(qname, new Map())
    }
    const targetMap = coverageMap.get(qname)!
    const currentCoverage = targetMap.get(tname) || 0
    targetMap.set(tname, currentCoverage + alignmentLength)
  }

  const mapping = new Map<string, string>()
  for (const [qname, targetMap] of coverageMap) {
    let bestTarget = ''
    let bestCoverage = 0
    for (const [tname, coverage] of targetMap) {
      if (coverage > bestCoverage) {
        bestCoverage = coverage
        bestTarget = tname
      }
    }
    if (bestTarget) {
      mapping.set(qname, bestTarget)
    }
  }

  return mapping
}

/**
 * Detect duplications by finding query regions that map to multiple
 * non-collinear locations on the same target chromosome.
 */
function detectDuplications(
  records: PAFRecord[],
  chromosomeMapping: Map<string, string>,
): Set<number> {
  const duplicateIndices = new Set<number>()

  // Group records by query chromosome
  const recordsByQuery = new Map<string, PAFRecord[]>()
  for (const record of records) {
    const { qname } = record
    if (!recordsByQuery.has(qname)) {
      recordsByQuery.set(qname, [])
    }
    recordsByQuery.get(qname)!.push(record)
  }

  // For each query chromosome, check for non-collinear mappings
  for (const [qname, queryRecords] of recordsByQuery) {
    const expectedTarget = chromosomeMapping.get(qname)
    if (!expectedTarget) {
      continue
    }

    // Get records that map to the expected target
    const recordsToExpectedTarget = queryRecords.filter(
      r => r.tname === expectedTarget,
    )

    if (recordsToExpectedTarget.length <= 1) {
      continue
    }

    // Sort by query position
    recordsToExpectedTarget.sort((a, b) => a.qstart - b.qstart)

    // Check for non-monotonic target positions
    for (let i = 1; i < recordsToExpectedTarget.length; i++) {
      const prev = recordsToExpectedTarget[i - 1]!
      const curr = recordsToExpectedTarget[i]!

      const queryGap = curr.qstart - prev.qend
      const prevTargetEnd = Math.max(prev.tstart, prev.tend)
      const currTargetStart = Math.min(curr.tstart, curr.tend)
      const targetGap = Math.abs(currTargetStart - prevTargetEnd)

      // If target gap is much larger than query gap, might be duplication
      if (queryGap >= 0 && queryGap < 50000 && targetGap > queryGap * 10 && targetGap > 100000) {
        duplicateIndices.add(prev.index)
        duplicateIndices.add(curr.index)
      }
    }
  }

  return duplicateIndices
}

/**
 * Classify a single record as SYN, INV, TRANS, or DUP.
 */
function classifySyriType(
  record: PAFRecord,
  chromosomeMapping: Map<string, string>,
  isDuplicate: boolean,
): SyriType {
  if (isDuplicate) {
    return 'DUP'
  }

  const { qname, tname, strand } = record
  const expectedTarget = chromosomeMapping.get(qname)

  if (expectedTarget && tname && expectedTarget !== tname) {
    return 'TRANS'
  }

  if (strand === -1) {
    return 'INV'
  }

  return 'SYN'
}

/**
 * Compute SyRI types for all records.
 * Call this once with all records, then use the returned Map to look up types.
 */
export function computeSyriTypesMap(records: PAFRecord[]): Map<number, SyriType> {
  const chromosomeMapping = buildChromosomeMapping(records)
  const duplicateIndices = detectDuplications(records, chromosomeMapping)

  const syriTypes = new Map<number, SyriType>()
  for (const record of records) {
    const isDuplicate = duplicateIndices.has(record.index)
    syriTypes.set(record.index, classifySyriType(record, chromosomeMapping, isDuplicate))
  }

  return syriTypes
}
