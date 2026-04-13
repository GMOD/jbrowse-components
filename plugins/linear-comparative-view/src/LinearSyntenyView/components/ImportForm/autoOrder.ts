interface PairwiseRecord {
  qname: string
  tname: string
  alignmentLength: number
}

// Computes optimal genome ordering by maximizing syntenic coverage
// between adjacent pairs using a greedy nearest-neighbor traversal.
// Returns ordered assembly name list.
export function computeGenomeOrdering(records: PairwiseRecord[]): string[] {
  // Build syntenic coverage matrix
  const coverage = new Map<string, Map<string, number>>()
  const genomeSet = new Set<string>()

  for (const r of records) {
    genomeSet.add(r.qname)
    genomeSet.add(r.tname)

    let qMap = coverage.get(r.qname)
    if (!qMap) {
      qMap = new Map()
      coverage.set(r.qname, qMap)
    }
    qMap.set(r.tname, (qMap.get(r.tname) ?? 0) + r.alignmentLength)

    let tMap = coverage.get(r.tname)
    if (!tMap) {
      tMap = new Map()
      coverage.set(r.tname, tMap)
    }
    tMap.set(r.qname, (tMap.get(r.qname) ?? 0) + r.alignmentLength)
  }

  const genomes = [...genomeSet]
  if (genomes.length <= 2) {
    return genomes
  }

  // Greedy nearest-neighbor: start from the genome with most total coverage
  const totalCoverage = new Map<string, number>()
  for (const [name, targets] of coverage) {
    let total = 0
    for (const cov of targets.values()) {
      total += cov
    }
    totalCoverage.set(name, total)
  }

  let startGenome = genomes[0]!
  let maxCov = 0
  for (const [name, cov] of totalCoverage) {
    if (cov > maxCov) {
      maxCov = cov
      startGenome = name
    }
  }

  const ordered: string[] = [startGenome]
  const remaining = new Set(genomes.filter(g => g !== startGenome))

  while (remaining.size > 0) {
    const current = ordered[ordered.length - 1]!
    const currentCov = coverage.get(current)

    let bestNext = ''
    let bestCovVal = -1

    for (const candidate of remaining) {
      const cov = currentCov?.get(candidate) ?? 0
      if (cov > bestCovVal) {
        bestCovVal = cov
        bestNext = candidate
      }
    }

    if (!bestNext) {
      bestNext = remaining.values().next().value!
    }

    ordered.push(bestNext)
    remaining.delete(bestNext)
  }

  return ordered
}
