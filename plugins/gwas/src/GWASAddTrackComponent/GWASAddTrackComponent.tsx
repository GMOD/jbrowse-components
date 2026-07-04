import { useEffect } from 'react'

import { isAlive } from '@jbrowse/mobx-state-tree'
import { TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { DEFAULT_SCORE_COLUMN } from '../GWASAdapter/configSchema.ts'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

interface GWASAddTrackComponentProps {
  model: IAnyStateTreeNode & {
    mixinData: { adapter?: { scoreColumn?: string } }
    setMixinData: (data: Record<string, unknown>) => void
  }
}

// The default lives in the GWASAdapter schema, so accepting defaults still
// produces a working track; mixinData is only written once the user actually
// overrides the column name. It's retracted on unmount so switching to a
// non-GWAS adapter isn't left with a stale scoreColumn.
const GWASAddTrackComponent = observer(function ({
  model,
}: GWASAddTrackComponentProps) {
  useEffect(() => {
    return () => {
      if (isAlive(model)) {
        model.setMixinData({})
      }
    }
  }, [model])

  const scoreColumn = model.mixinData.adapter?.scoreColumn ?? DEFAULT_SCORE_COLUMN
  return (
    <TextField
      label="Score column"
      helperText="Name of the column to use as the score for the Manhattan plot (e.g., 'neg_log_pvalue', 'pvalue')"
      value={scoreColumn}
      onChange={e => {
        model.setMixinData({ adapter: { scoreColumn: e.target.value } })
      }}
      fullWidth
    />
  )
})

export default GWASAddTrackComponent
