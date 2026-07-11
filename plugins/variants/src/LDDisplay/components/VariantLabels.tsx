import { getContainingView, getSession } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import type { SharedLDModel } from '../shared.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// SNP position in viewport-canvas-x: bpToPx returns the absolute genome pixel,
// subtract the raw view.offsetPx to get viewport-relative (0 = view left edge).
// Matches the connector lines' getGenomicX; the `left` gap when offsetPx < 0
// lives in the render frame (renderTransform.viewOffsetX / the export group's
// origin), not here — clamping it here would double-count in one frame.
function getGenomicX(
  view: LinearGenomeViewModel,
  assembly: { getCanonicalRefName2: (refName: string) => string },
  snp: { refName: string; start: number },
) {
  return (
    (view.bpToPx({
      refName: assembly.getCanonicalRefName2(snp.refName),
      coord: snp.start,
    })?.offsetPx ?? 0) - view.offsetPx
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
  const { assemblyNames } = view
  const assembly = assemblyManager.get(assemblyNames[0]!)

  if (!assembly || snps.length === 0 || !showLabels) {
    return null
  }

  return (
    <>
      {snps.map((snp, i) => {
        const genomicX = getGenomicX(view, assembly, snp)
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
