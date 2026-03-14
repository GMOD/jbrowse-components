function pct(n: number, total = 1) {
  return `${((n / (total || 1)) * 100).toFixed(1)}%`
}

describe('tooltip deletion ratio', () => {
  it('computes ratio using total coverage (depth + deletions)', () => {
    const depth = 5
    const deletionCount = 3
    const totalCoverage = depth + deletionCount

    const result = pct(deletionCount, totalCoverage)
    expect(result).toBe('37.5%')
  })

  it('shows 100% when all reads at position are deletions', () => {
    const depth = 0
    const deletionCount = 5
    const totalCoverage = depth + deletionCount

    expect(pct(deletionCount, totalCoverage)).toBe('100.0%')
  })

  it('shows 0% when no deletions', () => {
    const depth = 10
    const deletionCount = 0
    const totalCoverage = depth + deletionCount

    expect(pct(deletionCount, totalCoverage)).toBe('0.0%')
  })

  it('handles zero total coverage gracefully', () => {
    expect(pct(0, 0)).toBe('0.0%')
  })

  it('old formula overestimates ratio (documents the bug)', () => {
    const depth = 5
    const deletionCount = 3

    const oldRatio = pct(deletionCount, depth)
    const newRatio = pct(deletionCount, depth + deletionCount)

    expect(oldRatio).toBe('60.0%')
    expect(newRatio).toBe('37.5%')
  })
})
