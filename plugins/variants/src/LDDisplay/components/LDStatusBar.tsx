import { observer } from 'mobx-react'

import type { SharedLDModel } from '../shared.ts'

// Compact readout of how many variants survived filtering, so an empty or
// sparse triangle is explained rather than silently blank. Only shown for
// VCF-computed LD (pre-computed adapters carry no per-variant filter counts).
const LDStatusBar = observer(function LDStatusBar({
  model,
}: {
  model: SharedLDModel
}) {
  const { filterStats, isPrecomputedLD } = model
  if (isPrecomputedLD || !filterStats) {
    return null
  }
  const { totalVariants, passedVariants } = filterStats
  const dropped = [
    ['MAF', filterStats.filteredByMaf],
    ['multiallelic', filterStats.filteredByMultiallelic],
    ['HWE', filterStats.filteredByHwe],
    ['call rate', filterStats.filteredByCallRate],
    ['length', filterStats.filteredByLength],
  ].filter(([, n]) => (n as number) > 0)

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
        ? ` (${dropped.map(([label, n]) => `${n} ${label}`).join(', ')})`
        : ''}
    </div>
  )
})

export default LDStatusBar
