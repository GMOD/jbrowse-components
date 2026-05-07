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

// Classifies PAF alignments into SyRI-style structural types.
// Standalone copy for CLI use; classification logic mirrors
// plugins/comparative-adapters/src/syriUtils.ts but returns SyriType[]
// directly (no DupConflict info needed by the CLI path).
export function computeSyriTypes(records: AlignmentRecord[]): SyriType[] {
  const types = new Array<SyriType>(records.length).fill('SYN')

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

  for (const group of targetGroups.values()) {
    group.sort((a, b) => a.rec.tstart - b.rec.tstart)
  }

  for (let i = 0; i < records.length; i++) {
    const r = records[i]!
    if (r.strand === -1 && primaryTarget.get(r.qname) === r.tname) {
      types[i] = 'INV'
      continue
    }
    if (primaryTarget.get(r.qname) !== r.tname) {
      types[i] = 'TRANS'
      continue
    }
  }

  // Only SYN alignments participate in duplication detection; INV/TRANS must
  // not be overwritten — an inversion's target coords are typically nested
  // inside the surrounding syntenic block, which would otherwise trigger a
  // false DUP.
  for (const group of targetGroups.values()) {
    let maxEndRec: AlignmentRecord | undefined
    for (const { idx, rec } of group) {
      if (types[idx] !== 'SYN') {
        continue
      }
      if (maxEndRec && rec.tstart < maxEndRec.tend) {
        types[idx] = 'DUP'
      }
      if (!maxEndRec || rec.tend > maxEndRec.tend) {
        maxEndRec = rec
      }
    }
  }

  return types
}
