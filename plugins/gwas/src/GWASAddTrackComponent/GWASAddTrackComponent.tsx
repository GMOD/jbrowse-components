import React, { useEffect, useState } from 'react'

import { TextField } from '@mui/material'
import { observer } from 'mobx-react'

interface GWASAddTrackComponentProps {
  model: {
    setMixinData: (data: { adapter: { scoreColumn: string } }) => void
  }
}

const GWASAddTrackComponent = observer(function ({
  model,
}: GWASAddTrackComponentProps) {
  const [scoreColumn, setScoreColumn] = useState('neg_log_pvalue')

  useEffect(() => {
    model.setMixinData({
      adapter: {
        scoreColumn,
      },
    })
  }, [model, scoreColumn])

  return (
    <TextField
      label="Score column"
      helperText="Name of the column to use as the score for the Manhattan plot (e.g., 'neg_log_pvalue', 'pvalue')"
      value={scoreColumn}
      onChange={e => {
        setScoreColumn(e.target.value)
      }}
      fullWidth
    />
  )
})

export default GWASAddTrackComponent
