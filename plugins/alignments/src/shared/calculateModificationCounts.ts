export const complementBase: Record<string, string> = {
  C: 'G',
  G: 'C',
  A: 'T',
  T: 'A',
}

export function calculateModificationCounts({
  base,
  isSimplex,
  refbase: _refbase,
  baseCounts,
  strandBaseCounts,
}: {
  base: string
  isSimplex: boolean
  refbase: string
  baseCounts: Record<string, number>
  strandBaseCounts: Record<string, { fwd: number; rev: number }>
}) {
  if (base === 'N') {
    const total = Object.values(baseCounts).reduce((a, b) => a + b, 0)
    return { modifiable: total, detectable: total }
  }
  const cmp = complementBase[base] ?? 'N'
  const baseCount = baseCounts[base] ?? 0
  const complCount = baseCounts[cmp] ?? 0
  const modifiable = baseCount + complCount

  if (isSimplex) {
    const baseFwd = strandBaseCounts[base]?.fwd ?? 0
    const complRev = strandBaseCounts[cmp]?.rev ?? 0
    return { modifiable, detectable: baseFwd + complRev }
  }
  return { modifiable, detectable: modifiable }
}
