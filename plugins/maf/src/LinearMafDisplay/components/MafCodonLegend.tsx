import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import MafLegend from './MafLegend.tsx'

import type { LinearMafDisplayModel } from '../stateModel.ts'

/**
 * Legend for the codon view: what the codon-cell colors mean (nonsynonymous /
 * synonymous / stop; conserved codons are left unfilled). Uses the solid theme
 * colors so each category reads clearly. Renders only in codon view.
 */
const MafCodonLegend = observer(function MafCodonLegend({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  const theme = useTheme()
  if (model.activeRowRendering !== 'codon') {
    return null
  }
  return (
    <MafLegend
      entries={[
        { label: 'Nonsynonymous', color: theme.palette.codonNonsynonymous },
        { label: 'Synonymous', color: theme.palette.codonSynonymous },
        { label: 'Stop', color: theme.palette.codonStop },
      ]}
    />
  )
})

export default MafCodonLegend
