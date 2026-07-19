import { observer } from 'mobx-react'

import { LD_FILTER_CATEGORIES } from '../../shared/ldFilterCategories.ts'

import type { SharedLDModel } from '../shared.ts'

// Compact readout of how many variants survived filtering, so an empty or
// sparse triangle is explained rather than silently blank. Only shown for
// VCF-computed LD (pre-computed adapters carry no per-variant filter counts).
const LDStatusBar = observer(function LDStatusBar({
  model,
}: {
  model: SharedLDModel
}) {
  const { filterStats, isPrecomputedLD, ldMethod } = model
  if (isPrecomputedLD || !filterStats) {
    return null
  }
  const { totalVariants, passedVariants } = filterStats
  const dropped = LD_FILTER_CATEGORIES.filter(c => filterStats[c.key] > 0)
  // Name the estimator so an approximate (composite) matrix isn't mistaken for
  // exact haplotypic LD.
  const methodLabel =
    ldMethod === 'phased'
      ? 'phased (exact)'
      : ldMethod === 'composite'
        ? 'composite (unphased)'
        : ''

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 2,
        left: 4,
        fontSize: 10,
        color: '#555',
        background: 'rgba(255,255,255,0.75)',
        padding: '1px 4px',
        borderRadius: 3,
        pointerEvents: 'none',
      }}
    >
      {passedVariants} / {totalVariants} variants shown
      {dropped.length > 0
        ? ` (${dropped.map(c => `${filterStats[c.key]} ${c.label}`).join(', ')})`
        : ''}
      {methodLabel ? ` · LD: ${methodLabel}` : ''}
    </div>
  )
})

export default LDStatusBar
