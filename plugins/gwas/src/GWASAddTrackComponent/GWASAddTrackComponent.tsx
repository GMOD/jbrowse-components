import React, { useState } from 'react'

import { TextField } from '@mui/material'
import { observer } from 'mobx-react'

interface GWASAddTrackComponentProps {
  model: {
    setMixinData: (data: { adapter: { scoreColumn: string } }) => void
  }
}

const DEFAULT_SCORE_COLUMN = 'neg_log_pvalue'

const GWASAddTrackComponent = observer(function ({
  model,
}: GWASAddTrackComponentProps) {
  const [scoreColumn, setScoreColumn] = useState(() => {
    model.setMixinData({ adapter: { scoreColumn: DEFAULT_SCORE_COLUMN } })
    return DEFAULT_SCORE_COLUMN
  })

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
