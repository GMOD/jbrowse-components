import { useState } from 'react'

import { TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { DEFAULT_SCORE_COLUMN } from '../GWASAdapter/configSchema.ts'

interface GWASAddTrackComponentProps {
  model: {
    setMixinData: (data: { adapter: { scoreColumn: string } }) => void
  }
}

// The default lives in the GWASAdapter schema so accepting defaults still
// produces a working track. This input only matters when the user wants to
// override the column name — mixinData is only pushed once they actually
// change it.
const GWASAddTrackComponent = observer(function ({
  model,
}: GWASAddTrackComponentProps) {
  const [scoreColumn, setScoreColumn] = useState(DEFAULT_SCORE_COLUMN)
  return (
    <TextField
      label="Score column"
      helperText="Name of the column to use as the score for the Manhattan plot (e.g., 'neg_log_pvalue', 'pvalue')"
      value={scoreColumn}
      onChange={e => {
        const value = e.target.value
        setScoreColumn(value)
        model.setMixinData({ adapter: { scoreColumn: value } })
      }}
      fullWidth
    />
  )
})

export default GWASAddTrackComponent
