/**
 * SyRI-style classification utilities for synteny features.
 * Classifies alignments as SYN (syntenic), INV (inversion), TRANS (translocation), or DUP (duplication).
 *
 * Based on the syri/plotsr color scheme from schneebergerlab.
 */

export type SyriType = 'SYN' | 'INV' | 'TRANS' | 'DUP'

interface SyntenyRecord {
  qname: string
  qstart: number
  qend: number
  tname: string
  tstart: number
  tend: number
  strand: number
}

/**
 * Build a mapping from query chromosomes to their primary target chromosome
 * based on total alignment coverage. For each query chromosome, finds the
 * target chromosome where it has the most aligned bases.
 */
export function buildChromosomeMapping(
  records: SyntenyRecord[],
): Map<string, string> {
  // Track alignment coverage: queryChrom -> targetChrom -> totalBases
  const coverageMap = new Map<string, Map<string, number>>()

  for (const r of records) {
    const { qname, tname, qstart, qend } = r
    if (!qname || !tname) {
      continue
    }

    const alignmentLength = Math.abs(qend - qstart)

    if (!coverageMap.has(qname)) {
      coverageMap.set(qname, new Map())
    }
    const targetMap = coverageMap.get(qname)!
    const currentCoverage = targetMap.get(tname) || 0
    targetMap.set(tname, currentCoverage + alignmentLength)
  }

  // For each query chromosome, find the target with highest coverage
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
 *
 * Returns a Set of record indices that are classified as duplications.
 */
export function detectDuplications(
  records: SyntenyRecord[],
  chromosomeMapping: Map<string, string>,
): Set<number> {
  const duplicateIndices = new Set<number>()

  // Group records by query chromosome, keeping track of indices
  const recordsByQuery = new Map<string, { record: SyntenyRecord; index: number }[]>()
  for (let i = 0; i < records.length; i++) {
    const record = records[i]!
    const { qname } = record
    if (!recordsByQuery.has(qname)) {
      recordsByQuery.set(qname, [])
    }
    recordsByQuery.get(qname)!.push({ record, index: i })
  }

  // For each query chromosome, check for non-collinear mappings
  for (const [qname, queryRecords] of recordsByQuery) {
    const expectedTarget = chromosomeMapping.get(qname)
    if (!expectedTarget) {
      continue
    }

    // Get records that map to the expected target
    const recordsToExpectedTarget = queryRecords.filter(
      ({ record }) => record.tname === expectedTarget,
    )

    if (recordsToExpectedTarget.length <= 1) {
      continue
    }

    // Sort by query position
    recordsToExpectedTarget.sort((a, b) => a.record.qstart - b.record.qstart)

    // Check for non-monotonic target positions (indicates duplication/rearrangement)
    for (let i = 1; i < recordsToExpectedTarget.length; i++) {
      const prev = recordsToExpectedTarget[i - 1]!
      const curr = recordsToExpectedTarget[i]!

      const prevQueryEnd = prev.record.qend
      const currQueryStart = curr.record.qstart
      const queryGap = currQueryStart - prevQueryEnd

      const prevTargetEnd = Math.max(prev.record.tstart, prev.record.tend)
      const currTargetStart = Math.min(curr.record.tstart, curr.record.tend)
      const targetGap = Math.abs(currTargetStart - prevTargetEnd)

      // If target gap is much larger than query gap, might be duplication
      // Threshold: target jumps > 10x the query gap and > 100kb
      if (queryGap >= 0 && queryGap < 50000 && targetGap > queryGap * 10 && targetGap > 100000) {
        duplicateIndices.add(prev.index)
        duplicateIndices.add(curr.index)
      }
    }
  }

  return duplicateIndices
}

/**
 * Classify a single synteny record as SYN, INV, TRANS, or DUP.
 */
export function classifySyriType(
  record: SyntenyRecord,
  chromosomeMapping: Map<string, string>,
  isDuplicate: boolean,
): SyriType {
  // Check for duplication first
  if (isDuplicate) {
    return 'DUP'
  }

  const { qname, tname, strand } = record

  // Use coverage-based mapping to determine if this is a translocation
  const expectedTarget = chromosomeMapping.get(qname)

  // If the target doesn't match the expected target, it's a translocation
  if (expectedTarget && tname && expectedTarget !== tname) {
    return 'TRANS'
  }

  // Same/matching chromosome - check strand for inversion
  if (strand === -1) {
    return 'INV'
  }

  return 'SYN'
}

/**
 * Compute SyRI types for all records at once.
 * This is the main entry point - call this on the full dataset.
 *
 * @param records - Array of synteny records
 * @returns Array of SyriType classifications, one per record
 */
export function computeSyriTypes(records: SyntenyRecord[]): SyriType[] {
  // Build chromosome mapping from full dataset
  const chromosomeMapping = buildChromosomeMapping(records)

  // Detect duplications
  const duplicateIndices = detectDuplications(records, chromosomeMapping)

  // Classify each record
  const syriTypes: SyriType[] = []
  for (let i = 0; i < records.length; i++) {
    const record = records[i]!
    const isDuplicate = duplicateIndices.has(i)
    syriTypes.push(classifySyriType(record, chromosomeMapping, isDuplicate))
  }

  return syriTypes
}
