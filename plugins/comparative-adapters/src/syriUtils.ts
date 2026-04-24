export type SyriType = 'SYN' | 'INV' | 'TRANS' | 'DUP'

export interface AlignmentRecord {
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
  // For DUP features: the target coords of the prior SYN they overlap
  dupConflicts: (DupConflict | undefined)[]
}

// Classifies PAF alignments into SyRI-style structural types.
// Only SYN alignments participate in DUP detection — INV/TRANS are already
// classified and must not be overwritten (an inversion's target coords are
// typically nested inside the surrounding syntenic block).
export function computeSyriTypes(records: AlignmentRecord[]): SyriClassification {
  const types = new Array<SyriType>(records.length).fill('SYN')
  const dupConflicts: (DupConflict | undefined)[] = new Array(records.length).fill(undefined)

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

  const targetGroups = new Map<string, { idx: number; rec: AlignmentRecord }[]>()
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

  // DUP detection sweeps only SYN records — INV/TRANS must not be overwritten.
  // An inversion's target coords are typically nested inside the surrounding
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
