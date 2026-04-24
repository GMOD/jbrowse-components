export type SyriType = 'SYN' | 'INV' | 'TRANS' | 'DUP'

interface AlignmentRecord {
  qname: string
  qstart: number
  qend: number
  tname: string
  tstart: number
  tend: number
  strand: number
}

export interface DupConflict {
  tname: string
  tstart: number
  tend: number
}

export interface SyriClassification {
  types: SyriType[]
  // For DUP features: the target-coords of the SYN alignment they overlap
  dupConflicts: (DupConflict | undefined)[]
}

// Classifies PAF alignments into SyRI-style structural types.
// Algorithm:
// 1. Group alignments by (query chromosome, target chromosome)
// 2. Within each group, sort by target start
// 3. Detect inversions (negative strand), translocations (different
//    chromosome from primary mapping), and duplications (overlapping
//    regions on the same chromosome)
// 4. Everything else is syntenic (SYN)
// Only SYN alignments participate in duplication detection; INV/TRANS are
// already classified and are not overwritten.
export function computeSyriTypes(records: AlignmentRecord[]): SyriClassification {
  const types = new Array<SyriType>(records.length).fill('SYN')
  const dupConflicts: (DupConflict | undefined)[] = new Array(records.length).fill(undefined)

  // Build a map of query chromosome -> target chromosome with most coverage
  const queryCoverage = new Map<string, Map<string, number>>()
  for (const r of records) {
    let targets = queryCoverage.get(r.qname)
    if (!targets) {
      targets = new Map()
      queryCoverage.set(r.qname, targets)
    }
    const existing = targets.get(r.tname) ?? 0
    targets.set(r.tname, existing + (r.tend - r.tstart))
  }

  // For each query chromosome, find the primary target chromosome
  const primaryTarget = new Map<string, string>()
  for (const [qname, targets] of queryCoverage) {
    let best = ''
    let bestCov = 0
    for (const [tname, cov] of targets) {
      if (cov > bestCov) {
        best = tname
        bestCov = cov
      }
    }
    primaryTarget.set(qname, best)
  }

  // Track target coverage for duplication detection
  // Group records by target chromosome
  const targetGroups = new Map<
    string,
    { idx: number; rec: AlignmentRecord }[]
  >()
  for (let i = 0; i < records.length; i++) {
    const r = records[i]!
    let group = targetGroups.get(r.tname)
    if (!group) {
      group = []
      targetGroups.set(r.tname, group)
    }
    group.push({ idx: i, rec: r })
  }

  // Sort each group by target start position
  for (const group of targetGroups.values()) {
    group.sort((a, b) => a.rec.tstart - b.rec.tstart)
  }

  // Classify each alignment
  for (let i = 0; i < records.length; i++) {
    const r = records[i]!

    // Inversions: negative strand on the primary target chromosome
    if (r.strand === -1 && primaryTarget.get(r.qname) === r.tname) {
      types[i] = 'INV'
      continue
    }

    // Translocations: mapped to a non-primary target chromosome
    if (primaryTarget.get(r.qname) !== r.tname) {
      types[i] = 'TRANS'
      continue
    }
  }

  // Duplication detection: sweep SYN alignments only.
  // INV/TRANS are already classified and must not be overwritten — an
  // inversion's target coords are typically nested inside the surrounding
  // syntenic block, which would otherwise trigger a false DUP.
  for (const group of targetGroups.values()) {
    let maxEndRec: AlignmentRecord | undefined
    for (const { idx, rec } of group) {
      if (types[idx] !== 'SYN') {
        continue
      }
      if (maxEndRec && rec.tstart < maxEndRec.tend) {
        types[idx] = 'DUP'
        dupConflicts[idx] = {
          tname: maxEndRec.tname,
          tstart: maxEndRec.tstart,
          tend: maxEndRec.tend,
        }
      }
      if (!maxEndRec || rec.tend > maxEndRec.tend) {
        maxEndRec = rec
      }
    }
  }

  return { types, dupConflicts }
}
