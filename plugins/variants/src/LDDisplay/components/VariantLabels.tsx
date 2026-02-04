import { getContainingView, getSession } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import type { SharedLDModel } from '../shared.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

function getGenomicX(
  view: LinearGenomeViewModel,
  assembly: { getCanonicalRefName2: (refName: string) => string },
  snp: { refName: string; start: number },
  offsetAdjustment: number,
) {
  return (
    (view.bpToPx({
      refName: assembly.getCanonicalRefName2(snp.refName),
      coord: snp.start,
    })?.offsetPx || 0) - offsetAdjustment
  )
}

const VariantLabels = observer(function VariantLabels({
  model,
}: {
  model: SharedLDModel
}) {
  const theme = useTheme()
  const { assemblyManager } = getSession(model)
  const view = getContainingView(model) as LinearGenomeViewModel
  const { snps, showLabels } = model
  const { offsetPx, assemblyNames } = view
  const assembly = assemblyManager.get(assemblyNames[0]!)
  const offsetAdj = Math.max(offsetPx, 0)

  if (!assembly || snps.length === 0 || !showLabels) {
    return null
  }

  return (
    <>
      {snps.map((snp, i) => {
        const genomicX = getGenomicX(view, assembly, snp, offsetAdj)
        return (
          <text
            key={`${snp.id}-${i}`}
            x={genomicX}
            y={0}
            transform={`rotate(-90, ${genomicX}, 0)`}
            fontSize={10}
            textAnchor="end"
            dominantBaseline="middle"
            fill={theme.palette.text.primary}
            style={{ pointerEvents: 'none' }}
          >
            {snp.id || 'NOLABEL'}
          </text>
        )
      })}
    </>
  )
})

export default VariantLabels
