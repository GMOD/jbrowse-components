import { getContainingView, getSession } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import { getSnpViewportX } from './snpViewportX.ts'

import type { SharedLDModel } from '../shared.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const VariantLabels = observer(function VariantLabels({
  model,
}: {
  model: SharedLDModel
}) {
  const theme = useTheme()
  const { assemblyManager } = getSession(model)
  const view = getContainingView(model) as LinearGenomeViewModel
  const { snps, showLabels } = model
  const { assemblyNames } = view
  const assembly = assemblyManager.get(assemblyNames[0]!)

  if (!assembly || snps.length === 0 || !showLabels) {
    return null
  }

  return (
    <>
      {snps.map((snp, i) => {
        const genomicX = getSnpViewportX(view, assembly, snp)
        return (
          <text
            // eslint-disable-next-line @eslint-react/no-array-index-key -- snp.id may be missing or duplicated (multi-allelic sites share a position); idx only breaks ties
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
