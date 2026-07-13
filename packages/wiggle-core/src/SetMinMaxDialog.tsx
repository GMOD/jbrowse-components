import { useState } from 'react'

import { NumberTextField, SubmitDialog } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

export default observer(function SetMinMaxDialog(props: {
  model: {
    minScore: number
    maxScore: number
    scaleType: string
    setMinScore: (arg?: number) => void
    setMaxScore: (arg?: number) => void
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const { minScore, maxScore, scaleType } = model

  const [min, setMin] = useState(
    minScore === Number.MIN_VALUE ? undefined : minScore,
  )
  const [max, setMax] = useState(
    maxScore === Number.MAX_VALUE ? undefined : maxScore,
  )

  const rangeOk = min === undefined || max === undefined || max > min
  const logOk = !(scaleType === 'log' && min !== undefined && min <= 0)

  return (
    <SubmitDialog
      open
      title="Set min/max score for track"
      submitDisabled={!rangeOk || !logOk}
      onCancel={handleClose}
      onSubmit={() => {
        model.setMinScore(min)
        model.setMaxScore(max)
        handleClose()
      }}
    >
      <Typography>Enter min/max score: </Typography>
      {!rangeOk ? (
        <Typography color="error">Max must be greater than min</Typography>
      ) : null}
      {!logOk ? (
        <Typography color="error">
          Min score should be greater than 0 for log scale
        </Typography>
      ) : null}
      <NumberTextField
        defaultValue={min}
        onValueChange={setMin}
        placeholder="Enter min score"
      />
      <NumberTextField
        defaultValue={max}
        onValueChange={setMax}
        placeholder="Enter max score"
      />
    </SubmitDialog>
  )
})
